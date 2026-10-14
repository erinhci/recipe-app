import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseIngredientText } from './ingredients.js'
import { prepFor, prepSuggestions, withPrepSteps } from './prepSteps.js'

const texts = (ingredientText, steps) => prepSuggestions(parseIngredientText(ingredientText), steps).map((s) => s.text)

test('prep after a comma becomes a step, ignoring "divided"', () => {
  assert.deepEqual(texts('2 green onion, chopped, divided'), ['Chop the green onion.'])
})

test('the same prep is combined', () => {
  assert.deepEqual(texts('1/2 onion, diced\n1/2 zucchini, diced'), ['Dice the onion and zucchini.'])
})

test('optional ingredients keep the word optional', () => {
  assert.deepEqual(texts('2 chili pepper, chopped, optional'), ['Chop the chili pepper (optional).'])
  assert.deepEqual(texts('1/2 onion, diced\n2 chili pepper, diced, optional'), ['Dice the onion.', 'Dice the chili pepper (optional).'])
})

test('the soondubu ingredient list', () => {
  const list = [
    '1 tube silken tofu',
    '2 green onion, chopped, divided',
    '1/2 onion, diced',
    '1/2 zucchini, diced',
    '2 chili pepper, chopped, optional',
    '1 tbsp gochugaru',
    'salt, to taste',
  ].join('\n')
  assert.deepEqual(texts(list), ['Chop the green onion.', 'Dice the onion and zucchini.', 'Chop the chili pepper (optional).'])
})

test('adverbs, several actions, and how to cut', () => {
  assert.deepEqual(texts('1 cup carrots, finely chopped'), ['Finely chop the carrots.'])
  assert.deepEqual(texts('2 potatoes, peeled and cut into 1-inch pieces'), ['Peel and cut the potatoes into 1-inch pieces.'])
  assert.deepEqual(texts('1 lemon, zested and juiced'), ['Zest and juice the lemon.'])
  assert.deepEqual(texts('1 cup parsley, freshly chopped'), ['Chop the parsley.'])
  assert.deepEqual(texts('1 onion, chopped or sliced'), ['Chop the onion.'])
})

test('prep at the front of the name', () => {
  assert.deepEqual(texts('1/2 cup finely chopped onion'), ['Finely chop the onion.'])
  assert.deepEqual(texts('3 minced garlic cloves'), ['Mince the garlic cloves.'])
})

test('things usually bought prepped are left alone', () => {
  assert.deepEqual(texts('1 can diced tomatoes\n1 cup shredded cheddar\n1 lb ground beef'), [])
  // After a comma, it's the cook's job.
  assert.deepEqual(texts('1/2 cup parmesan, grated'), ['Grate the parmesan.'])
})

test('notes that are not prep make no step', () => {
  assert.deepEqual(texts('salt, to taste\n1 cup broth, divided\n2 tbsp butter, at room temperature\nsesame seeds, for garnish'), [])
})

test('prep a step already does is skipped', () => {
  assert.deepEqual(texts('3 cloves garlic, minced\n1 onion, diced', ['Mince the garlic.', 'Add the diced onion.']), ['Dice the onion.'])
  assert.deepEqual(texts('2 green onions, chopped', ['Chop the green onions, keeping the tops for garnish.']), [])
  assert.deepEqual(texts('1 onion, diced', ['Dicing the onion small helps it melt.']), [])
})

test('the same ingredient twice is named once', () => {
  assert.deepEqual(texts('2 green onion, chopped\nSauce:\n1 green onion, chopped'), ['Chop the green onion.'])
})

test('prepFor returns null with no prep', () => {
  assert.equal(prepFor({ item: 'silken tofu', prep_note: null }), null)
})

test('withPrepSteps puts prep first, one per line', () => {
  assert.equal(withPrepSteps('Boil water.\n\nAdd tofu.', ['Dice the onion.', 'Chop the green onion.']), 'Dice the onion.\n\nChop the green onion.\n\nBoil water.\n\nAdd tofu.')
  assert.equal(withPrepSteps('Boil water.\nAdd tofu.', ['Dice the onion.']), 'Dice the onion.\nBoil water.\nAdd tofu.')
  assert.equal(withPrepSteps('', ['Dice the onion.']), 'Dice the onion.')
  assert.equal(withPrepSteps('Boil water.', []), 'Boil water.')
})
