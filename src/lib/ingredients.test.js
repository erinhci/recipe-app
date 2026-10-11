import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ingredientToLine, parseIngredientLine, parseSteps } from './ingredients.js'

const p = parseIngredientLine

test('reads amount, unit, item, and prep note', () => {
  assert.deepEqual(
    { ...p('1 1/2 cups flour, sifted'), raw_text: undefined },
    { quantity: 1.5, unit: 'cup', item: 'flour', prep_note: 'sifted', raw_text: undefined, needs_review: false },
  )
  const garlic = p('3 cloves garlic, minced')
  assert.equal(garlic.quantity, 3)
  assert.equal(garlic.unit, 'clove')
  assert.equal(garlic.item, 'garlic')
  assert.equal(garlic.prep_note, 'minced')
})

test('handles unicode fractions, abbreviations, and two-word units', () => {
  assert.equal(p('½ tsp salt').quantity, 0.5)
  assert.equal(p('½ tsp salt').unit, 'tsp')
  assert.equal(p('2 Tbsp. olive oil').unit, 'tbsp')
  assert.equal(p('8 fl oz cream').unit, 'fl_oz')
  assert.equal(p('8 fl oz cream').item, 'cream')
  assert.equal(p('1 can of chickpeas').item, 'chickpeas')
})

test('count items without a unit', () => {
  const eggs = p('2 large eggs')
  assert.equal(eggs.quantity, 2)
  assert.equal(eggs.unit, null)
  assert.equal(eggs.item, 'large eggs')
})

test('flags lines with no amount unless that is expected', () => {
  assert.equal(p('salt to taste').needs_review, false)
  assert.equal(p('fresh parsley, for garnish').needs_review, false)
  assert.equal(p('chicken thighs').needs_review, true)
})

test('strips bullets and skips blank lines', () => {
  assert.equal(p('- 1 onion, diced').item, 'onion')
  assert.equal(p('   '), null)
})

test('round-trips to an editable line', () => {
  assert.equal(ingredientToLine(p('1 1/2 cups flour, sifted')), '1 1/2 cups flour, sifted')
  assert.equal(ingredientToLine(p('3 cloves garlic')), '3 cloves garlic')
  assert.equal(ingredientToLine(p('salt to taste')), 'salt to taste')
})

test('splits steps and removes numbering', () => {
  assert.deepEqual(parseSteps('1. Heat oil\n\n2) Add onion\nStep 3: Simmer'), ['Heat oil', 'Add onion', 'Simmer'])
})
