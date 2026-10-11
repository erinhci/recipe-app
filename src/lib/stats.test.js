import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeStats, hoursTogether, recipeRatings } from './stats.js'

const at = (time) => `2026-10-01T${time}:00.000Z`

test('overlapping sessions from both phones count once', () => {
  const sessions = [
    { started_at: at('18:00'), ended_at: at('19:00') },
    { started_at: at('18:30'), ended_at: at('19:30') }, // other phone, same meal
    { started_at: at('20:00'), ended_at: at('20:30') },
  ]
  assert.equal(hoursTogether(sessions), 2)
})

test('open sessions count nothing and long ones stop at 4 hours', () => {
  const sessions = [
    { started_at: at('08:00'), ended_at: null },
    { started_at: '2026-10-02T08:00:00.000Z', ended_at: '2026-10-02T20:00:00.000Z' },
  ]
  assert.equal(hoursTogether(sessions), 4)
})

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
  const stats = computeStats({ recipes, ingredients, cookLog, ratings: [], sessions: [] })
  assert.equal(stats.mealsLogged, 4)
  assert.deepEqual(stats.mostMade.map((r) => [r.title, r.count]), [['Tacos', 2], ['Mochi', 1]])
  assert.deepEqual(stats.cuisines[0], { name: 'Mexican', count: 2 })
  assert.equal(stats.cuisinesTried, 3)
  assert.deepEqual(stats.topIngredients, [{ name: 'onions', count: 2 }, { name: 'soy sauce', count: 1 }])
  assert.ok(stats.milestones.find((m) => m.kind === 'meals' && m.threshold === 1).reached)
  assert.ok(stats.milestones.find((m) => m.kind === 'cuisines' && m.threshold === 3).reached)
  assert.deepEqual(stats.next.find((n) => n.kind === 'meals'), { kind: 'meals', threshold: 5, label: '5 meals cooked', current: 4 })
})
