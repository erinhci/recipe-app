import { test } from 'node:test'
import assert from 'node:assert/strict'
import { filterAndSort, filterOptions } from './library.js'

const recipes = [
  {
    id: 'a',
    title: 'Egg Bites',
    cuisine: 'American',
    meal_type: 'breakfast',
    timesMade: 2,
    average: 3.5,
    total_time_minutes: 28,
    created_at: '2026-10-01',
    ingredientNames: ['large eggs', 'broccoli'],
  },
  {
    id: 'b',
    title: 'Soondubu Jjigae',
    cuisine: 'Korean',
    meal_type: 'dinner',
    timesMade: 0,
    average: null,
    total_time_minutes: 30,
    created_at: '2026-10-05',
    ingredientNames: ['soft tofu'],
  },
  {
    id: 'c',
    title: 'Kimchi Fried Rice',
    cuisine: 'Korean',
    meal_type: 'dinner',
    timesMade: 3,
    average: 4.5,
    total_time_minutes: 25,
    created_at: '2026-10-03',
    ingredientNames: ['kimchi', 'large eggs'],
  },
  { id: 'd', title: 'Isobe Mochi', cuisine: 'Japanese', meal_type: 'snack', timesMade: 1, average: 3.5, created_at: '2026-10-02' },
]
const ids = (list) => list.map((r) => r.id).join('')

test('search matches titles, cuisines, and ingredients', () => {
  assert.equal(ids(filterAndSort(recipes, { query: 'eggs' })), 'ca')
  assert.equal(ids(filterAndSort(recipes, { query: 'korean' })), 'bc')
})

test('chips in one group widen, across groups narrow', () => {
  assert.equal(ids(filterAndSort(recipes, { filters: ['cuisine:Korean', 'cuisine:Japanese'] })), 'bcd')
  assert.equal(ids(filterAndSort(recipes, { filters: ['cuisine:Korean', 'new'] })), 'b')
})

test('sorts', () => {
  assert.equal(ids(filterAndSort(recipes, { sort: 'added' })), 'bcda')
  assert.equal(ids(filterAndSort(recipes, { sort: 'made' })), 'cadb')
  assert.equal(ids(filterAndSort(recipes, { sort: 'rated' })), 'cadb')
  assert.equal(ids(filterAndSort(recipes, { sort: 'quick' })), 'cabd')
  assert.equal(
    ids(filterAndSort(recipes, { sort: 'az' })),
    'adbc'
      .split('')
      .sort((x, y) => recipes.find((r) => r.id === x).title.localeCompare(recipes.find((r) => r.id === y).title))
      .join(''),
  )
})

test('chips list what this library has, with counts', () => {
  const options = filterOptions(recipes)
  assert.deepEqual(
    options.map((o) => `${o.label}:${o.count}`),
    ['Not made yet:1', 'Breakfast:1', 'Dinner:2', 'Snack:1', 'American:1', 'Japanese:1', 'Korean:2'],
  )
})
