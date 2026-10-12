import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStats, formatMinutes, timeSummary, groupMeals, mealRatings, ratingIsStale, recipeRatings } from './stats.js'

const at = (time) => `2026-10-01T${time}:00.000Z`

test('ratings use each cook’s latest rating, then average', () => {
  const cookLog = [
    { id: 'l1', recipe_id: 'r1', cooked_on: '2026-09-01' },
    { id: 'l2', recipe_id: 'r1', cooked_on: '2026-10-01' },
  ]
  const ratings = [
    { cook_log_id: 'l1', member_id: 'erin', stars: 2 },
    { cook_log_id: 'l2', member_id: 'erin', stars: 5 },
    { cook_log_id: 'l1', member_id: 'sam', stars: 4 },
  ]
  const { byMember, average } = recipeRatings('r1', cookLog, ratings)
  assert.deepEqual(byMember, { erin: 5, sam: 4 })
  assert.equal(average, 4.5)
})

test('kitchen stats from the cook log', () => {
  const recipes = [
    { id: 'r1', title: 'Mochi', cuisine: 'Japanese', meal_type: 'dessert' },
    { id: 'r2', title: 'Tacos', cuisine: 'Mexican', meal_type: 'dinner' },
    { id: 'r3', title: 'Gone', cuisine: 'Thai', meal_type: 'dinner', deleted_at: '2026-10-05' },
  ]
  const ingredients = [
    { recipe_id: 'r1', item: 'soy sauce' },
    { recipe_id: 'r1', item: 'salt' },
    { recipe_id: 'r2', item: 'onions' },
    { recipe_id: 'r2', item: 'large onion' }, // same ingredient twice counts once per meal
  ]
  const cookLog = [
    { id: 'a', recipe_id: 'r1', cooked_on: '2026-10-01' },
    { id: 'b', recipe_id: 'r2', cooked_on: '2026-10-02' },
    { id: 'c', recipe_id: 'r2', cooked_on: '2026-10-03' },
    { id: 'd', recipe_id: 'r3', cooked_on: '2026-10-04' },
  ]
  const stats = computeStats({ recipes, ingredients, cookLog, ratings: [] })
  assert.equal(stats.mealsLogged, 4)
  assert.deepEqual(stats.mostMade.map((r) => [r.title, r.count]), [['Tacos', 2], ['Mochi', 1]])
  assert.deepEqual(stats.cuisines[0], { name: 'Mexican', count: 2 })
  assert.equal(stats.cuisinesTried, 3)
  assert.deepEqual(stats.topIngredients, [{ name: 'onions', count: 2 }, { name: 'soy sauce', count: 1 }])
  assert.ok(stats.milestones.find((m) => m.kind === 'meals' && m.threshold === 1).reached)
  assert.ok(stats.milestones.find((m) => m.kind === 'cuisines' && m.threshold === 3).reached)
  assert.deepEqual(stats.next.find((n) => n.kind === 'meals'), { kind: 'meals', threshold: 5, label: '5 meals cooked', current: 4 })
})

test('both cooks logging the same dinner count as one meal with both ratings', () => {
  const cookLog = [
    { id: 'erin-log', recipe_id: 'r1', cooked_on: '2026-10-10', created_by: 'erin', created_at: '2026-10-11T08:10:00Z' },
    { id: 'brian-log', recipe_id: 'r1', cooked_on: '2026-10-10', created_by: 'brian', created_at: '2026-10-11T08:05:00Z' },
    { id: 'older', recipe_id: 'r1', cooked_on: '2026-09-01', created_by: 'erin', created_at: '2026-09-01T20:00:00Z' },
  ]
  const ratings = [
    { cook_log_id: 'erin-log', member_id: 'erin', stars: 4 },
    { cook_log_id: 'brian-log', member_id: 'brian', stars: 3 },
  ]
  const meals = groupMeals(cookLog)
  assert.deepEqual(meals.map((m) => m.ids), [['brian-log', 'erin-log'], ['older']])
  const both = mealRatings(meals[0], ratings)
  assert.deepEqual([...both].map(([m, r]) => [m, r.stars]), [['erin', 4], ['brian', 3]])
  const stats = computeStats({
    recipes: [{ id: 'r1', title: 'Isobe mochi', cuisine: 'Japanese', meal_type: 'snack' }],
    ingredients: [],
    cookLog,
    ratings,
  })
  assert.equal(stats.mealsLogged, 2)
  assert.equal(stats.mostMade[0].count, 2)
  assert.equal(stats.topRated[0].average, 3.5)
})

test('a rating carries over until the recipe is edited after it', () => {
  const cookLog = [
    { id: 'l1', recipe_id: 'r1', cooked_on: '2026-10-10' },
    { id: 'l2', recipe_id: 'r1', cooked_on: '2026-11-02' }, // made again, not re-rated
  ]
  const ratings = [{ cook_log_id: 'l1', member_id: 'erin', stars: 4, created_at: '2026-10-11T08:00:00Z' }]
  const { byMember, ratedAt } = recipeRatings('r1', cookLog, ratings)
  assert.deepEqual(byMember, { erin: 4 })
  assert.equal(ratingIsStale(ratedAt.erin, null), false)
  assert.equal(ratingIsStale(ratedAt.erin, '2026-10-01T00:00:00Z'), false)
  assert.equal(ratingIsStale(ratedAt.erin, '2026-10-20T00:00:00Z'), true)
})


test('time together adds the recipe time once per meal', () => {
  const recipes = [
    { id: 'a', title: 'A', total_time_minutes: 30 },
    { id: 'b', title: 'B', total_time_minutes: null },
  ]
  const cookLog = [
    { id: '1', recipe_id: 'a', cooked_on: '2026-10-10', created_by: 'u1' },
    { id: '2', recipe_id: 'a', cooked_on: '2026-10-10', created_by: 'u2' },
    { id: '3', recipe_id: 'a', cooked_on: '2026-10-11', created_by: 'u1' },
    { id: '4', recipe_id: 'b', cooked_on: '2026-10-11', created_by: 'u1' },
  ]
  const stats = computeStats({ recipes, ingredients: [], cookLog, ratings: [] })
  assert.equal(stats.hours, 1)
  assert.equal(stats.mealsWithoutTime, 1)
})

test('formatMinutes', () => {
  assert.equal(formatMinutes(25), '25 min')
  assert.equal(formatMinutes(75), '1 hr 15 min')
  assert.equal(formatMinutes(120), '2 hr')
})

test('time summary shows prep, cook, and a total that differs', () => {
  assert.equal(timeSummary({ prep_minutes: 10, cook_minutes: 20, total_time_minutes: 30 }), 'Prep 10 min · Cook 20 min')
  assert.equal(timeSummary({ prep_minutes: 10, cook_minutes: 20, total_time_minutes: 45 }), 'Prep 10 min · Cook 20 min · Total 45 min')
  assert.equal(timeSummary({ total_time_minutes: 40 }), 'About 40 min')
  assert.equal(timeSummary({}), '')
})

test('meals per week, Monday to Sunday, oldest first', async () => {
  const { mealsByWeek } = await import('./stats.js')
  // Sunday Oct 11, 2026: that week started Monday Oct 5.
  const meals = [{ cooked_on: '2026-10-11' }, { cooked_on: '2026-10-05' }, { cooked_on: '2026-10-04' }, { cooked_on: '2026-08-01' }]
  const weeks = mealsByWeek(meals, '2026-10-11', 3)
  assert.deepEqual(weeks.map((w) => w.count), [0, 1, 2])
  assert.equal(weeks[2].start.getDate(), 5)
  assert.equal(weeks[1].start.getDate(), 28)
})
