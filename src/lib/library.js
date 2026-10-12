// Searching, filtering, and sorting the library. Pure functions; the
// Library screen passes in recipes with their stats and ingredient names.

export const SORTS = [
  { value: 'added', label: 'Recently added' },
  { value: 'made', label: 'Most made' },
  { value: 'rated', label: 'Top rated' },
  { value: 'quick', label: 'Quickest' },
  { value: 'az', label: 'A to Z' },
]

const words = (text) => String(text ?? '').toLowerCase()
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1)

// The filter chips that apply to this library: "Not made yet" when some
// are, then meal types, then cuisines, each with how many recipes have it.
export function filterOptions(recipes) {
  const count = (key, label, group, test) => ({ key, label, group, count: recipes.filter(test).length })
  const options = []
  if (recipes.some((r) => r.timesMade === 0) && recipes.some((r) => r.timesMade > 0)) {
    options.push(count('new', 'Not made yet', 'made', (r) => r.timesMade === 0))
  }
  for (const [group, field] of [
    ['meal', 'meal_type'],
    ['cuisine', 'cuisine'],
  ]) {
    const values = [...new Set(recipes.map((r) => r[field]).filter(Boolean))].sort((a, b) => a.localeCompare(b))
    for (const value of values) options.push(count(`${group}:${value}`, capitalize(value), group, (r) => r[field] === value))
  }
  return options
}

// Chips in the same group widen the results (Korean or Japanese); chips in
// different groups narrow them (Korean and dinner).
export function filterAndSort(recipes, { query = '', sort = 'added', filters = [] } = {}) {
  const q = words(query).trim()
  const groups = new Map()
  for (const key of filters) {
    const group = key === 'new' ? 'made' : key.split(':')[0]
    if (!groups.has(group)) groups.set(group, [])
    groups.get(group).push(key)
  }
  const matchesChip = (recipe, key) => {
    if (key === 'new') return recipe.timesMade === 0
    const [group, value] = [key.slice(0, key.indexOf(':')), key.slice(key.indexOf(':') + 1)]
    return recipe[group === 'meal' ? 'meal_type' : 'cuisine'] === value
  }
  const shown = recipes.filter(
    (recipe) =>
      (!q || [recipe.title, recipe.cuisine, recipe.meal_type, ...(recipe.ingredientNames ?? [])].some((t) => words(t).includes(q))) &&
      [...groups.values()].every((keys) => keys.some((key) => matchesChip(recipe, key))),
  )
  const byTitle = (a, b) => a.title.localeCompare(b.title)
  const time = (r) => r.total_time_minutes || (r.prep_minutes || 0) + (r.cook_minutes || 0) || Infinity
  const comparators = {
    added: (a, b) => String(b.created_at ?? b.updated_at ?? '').localeCompare(String(a.created_at ?? a.updated_at ?? '')),
    made: (a, b) => b.timesMade - a.timesMade || byTitle(a, b),
    rated: (a, b) => (b.average ?? -1) - (a.average ?? -1) || byTitle(a, b),
    quick: (a, b) => time(a) - time(b) || byTitle(a, b),
    az: byTitle,
  }
  return [...shown].sort(comparators[sort] ?? comparators.added)
}
