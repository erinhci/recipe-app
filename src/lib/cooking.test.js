import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ingredientsForStep, keyWords, scaleStepText } from './cooking.js'

const ingredients = [
  { id: 1, item: 'silken tofu' },
  { id: 2, item: 'potato starch' },
  { id: 3, item: 'soy sauce' },
  { id: 4, item: 'mirin' },
  { id: 5, item: 'large yellow onions' },
  { id: 6, item: 'tomato sauce' },
]
const ids = (step) => ingredientsForStep(step, ingredients).map((i) => i.id)

test('key words drop sizes and preparation words', () => {
  assert.deepEqual(keyWords('2 large yellow onions'), ['yellow', 'onion'])
  assert.deepEqual(keyWords('fresh tomatoes'), ['tomato'])
  assert.deepEqual(keyWords('glutinous rice flour'), ['glutinous', 'rice', 'flour'])
})

test('finds ingredients named in a step', () => {
  assert.deepEqual(ids('Whisk tofu, add potato starch, try to get it smooth.'), [1, 2])
  assert.deepEqual(ids('Glaze with soy sauce and mirin.'), [3, 4])
  assert.deepEqual(ids('Dice the onion.'), [5])
})

test('a shared word like "sauce" only matches the full name', () => {
  assert.deepEqual(ids('Add the sauce.'), [])
  assert.deepEqual(ids('Stir in the tomato sauce.'), [6])
})

test('steps that mention nothing get no list', () => {
  assert.deepEqual(ids('Heat a pan on low.'), [])
})

// Egg bites, written for 6 servings.
const eggBites = [
  { id: 'e', quantity: 4, unit: null, item: 'large eggs' },
  { id: 'w', quantity: 2, unit: 'tbsp', item: 'water' },
  { id: 'gp', quantity: 0.25, unit: 'tsp', item: 'garlic powder' },
  { id: 'op', quantity: 0.25, unit: 'tsp', item: 'onion powder' },
  { id: 's', quantity: 0.25, unit: 'tsp', item: 'salt' },
  { id: 'bp', quantity: 0.125, unit: 'tsp', item: 'black pepper' },
  { id: 'go', quantity: 2, unit: 'tbsp', item: 'green onions' },
  { id: 'yo', quantity: 2, unit: 'tbsp', item: 'yellow or white onion' },
  { id: 'c', quantity: 1 / 3, unit: 'cup', item: 'diced chicken' },
]
const scaled = (text, factor) => scaleStepText(text, eggBites, factor, 'us').map((p) => p.text).join('')

test('amounts in a step match the scaled ingredient list', () => {
  assert.equal(
    scaled('In a bowl, whisk 4 large eggs, 2 tbsp water, 1/4 tsp garlic powder, 1/4 tsp onion powder, 1/4 tsp salt, 1/8 tsp black pepper for 30 seconds.', 2 / 6),
    'In a bowl, whisk 1 1/3 large eggs, 2 tsp water, 1/8 tsp garlic powder, 1/8 tsp onion powder, 1/8 tsp salt, a pinch black pepper for 30 seconds.',
  )
})

test('similar ingredients with the same amount go to the right one', () => {
  const parts = scaleStepText('Add 2 tbsp sliced green onions and 2 tbsp diced yellow onion.', eggBites, 3, 'us')
  assert.deepEqual(parts.filter((p) => p.scaled).map((p) => p.text), ['6 tbsp', '6 tbsp'])
})

test('counts, times, and ranges that are not ingredients stay as written', () => {
  const text = 'Divide among the 6 greased muffin cups. Bake for 18–20 minutes until 3/4 set.'
  assert.equal(scaled(text, 2 / 6), text)
})

test('nothing changes at the original servings', () => {
  const parts = scaleStepText('Whisk 4 large eggs and 1/3 cup diced chicken.', eggBites, 1, 'us')
  assert.equal(parts.some((p) => p.scaled), false)
  assert.equal(parts.map((p) => p.text).join(''), 'Whisk 4 large eggs and 1/3 cup diced chicken.')
})
