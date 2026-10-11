import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ingredientsForStep, keyWords } from './cooking.js'

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
