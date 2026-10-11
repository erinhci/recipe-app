import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitRecipeText } from './textRecipe.js'

test('uses section headers when they exist', () => {
  const result = splitRecipeText(`Lemon Pasta
Serves 4

Ingredients
8 oz spaghetti
2 tbsp butter
1 lemon, zested

Instructions
1. Boil the pasta in salted
water until al dente.
2. Melt the butter and add the zest.`)
  assert.equal(result.title, 'Lemon Pasta')
  assert.equal(result.servings, 4)
  assert.deepEqual(result.ingredientLines, ['8 oz spaghetti', '2 tbsp butter', '1 lemon, zested'])
  assert.deepEqual(result.steps, [
    'Boil the pasta in salted water until al dente.',
    'Melt the butter and add the zest.',
  ])
})

test('falls back to line shapes without headers', () => {
  const result = splitRecipeText(`Quick Rice
1 cup rice
2 cups water
Bring the water to a boil, add the rice, and cover.
Simmer for 18 minutes, then rest 5 minutes.`)
  assert.equal(result.title, 'Quick Rice')
  assert.deepEqual(result.ingredientLines, ['1 cup rice', '2 cups water'])
  assert.equal(result.steps.length, 2)
})

test('accepts header variations', () => {
  const result = splitRecipeText(`Soup\nYou'll need:\n1 onion\nMethod:\nChop and simmer.`)
  assert.deepEqual(result.ingredientLines, ['1 onion'])
  assert.deepEqual(result.steps, ['Chop and simmer.'])
})

test('empty text gives an empty draft', () => {
  assert.deepEqual(splitRecipeText(''), { title: '', servings: null, ingredientLines: [], steps: [] })
})
