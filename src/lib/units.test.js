import { test } from 'node:test'
import assert from 'node:assert/strict'
import { displayIngredient, formatNumber, normalizeUnit, parseQuantity, scaleFactor } from './units.js'

const show = (quantity, unit, item, factor, system) =>
  displayIngredient({ quantity, unit, item }, factor, system).text

test('parses common quantity formats', () => {
  assert.equal(parseQuantity('2'), 2)
  assert.equal(parseQuantity('1 1/2'), 1.5)
  assert.equal(parseQuantity('1½'), 1.5)
  assert.equal(parseQuantity('½'), 0.5)
  assert.equal(parseQuantity('2/3').toFixed(4), (2 / 3).toFixed(4))
  assert.equal(parseQuantity('1.25'), 1.25)
  assert.equal(parseQuantity('2-3'), 2)
  assert.equal(parseQuantity('2 to 3'), 2)
  assert.equal(parseQuantity('salt'), null)
  assert.equal(parseQuantity(''), null)
})

test('standardizes unit names', () => {
  assert.equal(normalizeUnit('Tablespoons'), 'tbsp')
  assert.equal(normalizeUnit('T'), 'tbsp')
  assert.equal(normalizeUnit('t'), 'tsp')
  assert.equal(normalizeUnit('cups'), 'cup')
  assert.equal(normalizeUnit('lbs'), 'lb')
  assert.equal(normalizeUnit('Grams'), 'g')
  assert.equal(normalizeUnit('clove'), 'clove')
  assert.equal(normalizeUnit('Cloves'), 'clove')
  assert.equal(normalizeUnit('bunches'), 'bunch')
  assert.equal(normalizeUnit('cans'), 'can')
  assert.equal(normalizeUnit(''), null)
})

test('a recipe for 6 scaled to 2 turns 1 tbsp into 1 tsp', () => {
  assert.equal(show(1, 'tbsp', 'soy sauce', scaleFactor(6, 2)), '1 tsp')
})

test('scaled amounts round to measurable fractions', () => {
  // 1 cup / 3 = 1/3 cup
  assert.equal(show(1, 'cup', 'rice', 1 / 3), '1/3 cup')
  // 3/4 cup / 2 = 6 tbsp
  assert.equal(show(0.75, 'cup', 'milk', 0.5), '6 tbsp')
  // 2 cups / 3 = 2/3 cup
  assert.equal(show(2, 'cup', 'flour', 1 / 3), '2/3 cup')
  // 1 tsp / 3 is a quarter teaspoon, the nearest measurable amount
  assert.equal(show(1, 'tsp', 'cumin', 1 / 3), '1/4 tsp')
  // tiny amounts become a pinch
  assert.equal(show(1 / 8, 'tsp', 'cayenne', 1 / 4), 'a pinch')
})

test('small spoon amounts step up when they grow', () => {
  // 1 tsp x 6 = 2 tbsp
  assert.equal(show(1, 'tsp', 'salt', 6), '2 tbsp')
  // 2 tbsp x 4 = 1/2 cup
  assert.equal(show(2, 'tbsp', 'oil', 4), '1/2 cup')
})

test('converts between US and metric', () => {
  assert.equal(show(1, 'cup', 'stock', 1, 'metric'), '240 ml')
  assert.equal(show(250, 'g', 'butter', 1, 'us'), '8 3/4 oz')
  assert.equal(show(2, 'lb', 'chicken', 1, 'metric'), '905 g')
  assert.equal(show(500, 'ml', 'milk', 1, 'us'), '2 cups')
  // spoons stay spoons in metric
  assert.equal(show(1, 'tbsp', 'oil', 1, 'metric'), '1 tbsp')
})

test('count items keep their words and use friendly fractions', () => {
  assert.equal(show(3, 'clove', 'garlic', 1 / 2), '1 1/2 cloves')
  assert.equal(show(1, 'clove', 'garlic', 1), '1 clove')
  assert.equal(show(1, 'bunch', 'cilantro', 2), '2 bunches')
  assert.equal(show(1, null, 'onion', 1 / 2), '1/2')
})

test('eggs that do not divide evenly get a practical note', () => {
  const egg = displayIngredient({ quantity: 2, unit: null, item: 'eggs' }, 1 / 3)
  assert.equal(egg.text, '2/3')
  assert.match(egg.note, /1 small egg/)
  const whole = displayIngredient({ quantity: 3, unit: null, item: 'eggs' }, 2 / 3)
  assert.equal(whole.text, '2')
  assert.equal(whole.note, null)
})

test('unquantified lines are left alone', () => {
  const salt = displayIngredient({ quantity: null, unit: null, item: 'salt to taste' }, 1 / 3)
  assert.equal(salt.text, '')
})

test('formats numbers as kitchen fractions or one decimal', () => {
  assert.equal(formatNumber(1.5), '1 1/2')
  assert.equal(formatNumber(0.25), '1/4')
  assert.equal(formatNumber(3), '3')
  assert.equal(formatNumber(1.7), '1.7')
})

test('scale factor guards bad servings', () => {
  assert.equal(scaleFactor(4, 2), 0.5)
  assert.equal(scaleFactor(0, 2), 1)
  assert.equal(scaleFactor(null, 2), 1)
})
