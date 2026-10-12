// Kitchen stats, worked out on the phone from the local copy so they
// show offline too. Pure functions; the Stats screen passes in the tables.

import { keyWords } from './cooking.js'

// Staples that would top the ingredient list for every kitchen.
const STAPLES = new Set(['salt', 'water', 'pepper', 'black pepper', 'kosher salt', 'ice'])

export const MILESTONES = [
  { kind: 'meals', thresholds: [1, 5, 10, 25, 50, 100], label: (n) => (n === 1 ? 'First meal logged' : `${n} meals cooked`) },
  { kind: 'cuisines', thresholds: [3, 5, 10], label: (n) => `${n} cuisines tried` },
  { kind: 'hours', thresholds: [5, 10, 25, 50], label: (n) => `${n} hours cooking together` },
]

// "Prep 10 min · Cook 20 min", plus the total when it isn't just the two
// added up (or when it's the only time given). Empty when no times.
export function timeSummary(recipe) {
  const prep = recipe?.prep_minutes > 0 ? recipe.prep_minutes : null
  const cook = recipe?.cook_minutes > 0 ? recipe.cook_minutes : null
  const total = recipe?.total_time_minutes > 0 ? recipe.total_time_minutes : null
  const parts = []
  if (prep) parts.push(`Prep ${formatMinutes(prep)}`)
  if (cook) parts.push(`Cook ${formatMinutes(cook)}`)
  if (total && total !== (prep ?? 0) + (cook ?? 0)) parts.push(`${parts.length ? 'Total' : 'About'} ${formatMinutes(total)}`)
  return parts.join(' · ')
}

// 25 -> "25 min", 75 -> "1 hr 15 min", 120 -> "2 hr"
export function formatMinutes(minutes) {
  if (minutes < 1) return 'under a minute'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (!h) return `${m} min`
  return m ? `${h} hr ${m} min` : `${h} hr`
}

// One meal = one recipe on one date. When both cooks log the same dinner
// on their own phones, the two entries count as one meal and their
// ratings sit together. Newest first.
export function groupMeals(cookLog) {
  const groups = new Map()
  for (const entry of cookLog) {
    const key = `${entry.recipe_id}|${entry.cooked_on}`
    if (!groups.has(key)) groups.set(key, { key, recipe_id: entry.recipe_id, cooked_on: entry.cooked_on, entries: [] })
    groups.get(key).entries.push(entry)
  }
  for (const group of groups.values()) {
    group.entries.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
    group.ids = group.entries.map((e) => e.id)
  }
  return [...groups.values()].sort(
    (a, b) => b.cooked_on.localeCompare(a.cooked_on) || (b.entries[0].created_at ?? '').localeCompare(a.entries[0].created_at ?? ''),
  )
}

// Each cook's rating for one meal (the newest, if there's more than one).
export function mealRatings(group, ratings) {
  const ids = new Set(group.ids)
  const byMember = new Map()
  for (const rating of ratings) {
    if (!ids.has(rating.cook_log_id)) continue
    const previous = byMember.get(rating.member_id)
    if (!previous || (rating.created_at ?? '') > (previous.created_at ?? '')) byMember.set(rating.member_id, rating)
  }
  return byMember
}

// Each cook's most recent rating of a recipe, averaged across cooks.
export function recipeRatings(recipeId, cookLog, ratings) {
  const logs = new Map(cookLog.filter((c) => c.recipe_id === recipeId).map((c) => [c.id, c]))
  const latest = new Map() // member_id -> { stars, cooked_on, created_at }
  for (const rating of ratings) {
    const log = logs.get(rating.cook_log_id)
    if (!log) continue
    const previous = latest.get(rating.member_id)
    const newer =
      !previous ||
      log.cooked_on > previous.cooked_on ||
      (log.cooked_on === previous.cooked_on && (rating.created_at ?? '') > (previous.created_at ?? ''))
    if (newer) latest.set(rating.member_id, { stars: Number(rating.stars), cooked_on: log.cooked_on, created_at: rating.created_at })
  }
  const byMember = Object.fromEntries([...latest].map(([member, r]) => [member, r.stars]))
  const ratedAt = Object.fromEntries([...latest].map(([member, r]) => [member, r.created_at ?? null]))
  const values = Object.values(byMember)
  const average = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null
  return { byMember, ratedAt, average }
}

// A rating belongs to the recipe and carries over to every later meal.
// It only goes stale when the recipe is edited after it was given.
// lastChangedAt: when the recipe's newest saved version was made (an edit).
export function ratingIsStale(ratedAt, lastChangedAt) {
  return Boolean(ratedAt && lastChangedAt && lastChangedAt > ratedAt)
}

function countBy(items, keyFor) {
  const counts = new Map()
  for (const item of items) {
    const key = keyFor(item)
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

export function computeStats({ recipes, ingredients, cookLog, ratings }) {
  const recipeById = new Map(recipes.map((r) => [r.id, r]))
  // Meals whose recipe was deleted for good aren't on the phone anymore.
  const entries = cookLog.filter((c) => recipeById.has(c.recipe_id))
  const meals = groupMeals(entries)
  const live = (id) => !recipeById.get(id)?.deleted_at

  const mostMade = countBy(meals.filter((c) => live(c.recipe_id)), (c) => c.recipe_id)
    .slice(0, 5)
    .map(({ name: id, count }) => ({ id, title: recipeById.get(id).title, count }))

  const topRated = [...new Set(meals.map((c) => c.recipe_id))]
    .filter(live)
    .map((id) => ({ id, title: recipeById.get(id).title, ...recipeRatings(id, entries, ratings) }))
    .filter((r) => r.average !== null)
    .sort((a, b) => b.average - a.average || a.title.localeCompare(b.title))
    .slice(0, 5)

  const cuisines = countBy(meals, (c) => recipeById.get(c.recipe_id).cuisine || 'Other')
  const mealTypes = countBy(meals, (c) => recipeById.get(c.recipe_id).meal_type || 'other')

  // Count each ingredient once per meal it was in.
  // "Onions" and "large onion" group together; the list shows the first
  // way it was written.
  const ingredientsByRecipe = new Map()
  const labels = new Map()
  for (const ing of ingredients) {
    const name = keyWords(ing.item).join(' ')
    if (!name || STAPLES.has(name)) continue
    if (!labels.has(name)) labels.set(name, String(ing.item).trim().toLowerCase())
    if (!ingredientsByRecipe.has(ing.recipe_id)) ingredientsByRecipe.set(ing.recipe_id, new Set())
    ingredientsByRecipe.get(ing.recipe_id).add(name)
  }
  const ingredientUses = meals.flatMap((c) => [...(ingredientsByRecipe.get(c.recipe_id) ?? [])])
  const topIngredients = countBy(ingredientUses, (name) => name)
    .slice(0, 8)
    .map((item) => ({ ...item, name: labels.get(item.name) }))

  // Time together: each meal adds its recipe's total time once, even when
  // both cooks logged it. Meals of recipes with no time add nothing.
  const timed = meals.filter((c) => recipeById.get(c.recipe_id).total_time_minutes > 0)
  const hours = timed.reduce((sum, c) => sum + recipeById.get(c.recipe_id).total_time_minutes, 0) / 60
  const mealsWithoutTime = meals.length - timed.length
  const cuisinesTried = cuisines.filter((c) => c.name !== 'Other').length
  const totals = { meals: meals.length, cuisines: cuisinesTried, hours }

  const milestones = MILESTONES.flatMap(({ kind, thresholds, label }) =>
    thresholds.map((n) => ({ kind, threshold: n, label: label(n), reached: totals[kind] >= n })),
  )
  const next = MILESTONES.map(({ kind, thresholds, label }) => {
    const n = thresholds.find((t) => totals[kind] < t)
    return n ? { kind, threshold: n, label: label(n), current: totals[kind] } : null
  }).filter(Boolean)

  return {
    mealsLogged: meals.length,
    recipesCooked: new Set(meals.map((c) => c.recipe_id)).size,
    hours,
    mealsWithoutTime,
    cuisinesTried,
    mostMade,
    topRated,
    cuisines,
    mealTypes,
    topIngredients,
    milestones,
    next,
  }
}
