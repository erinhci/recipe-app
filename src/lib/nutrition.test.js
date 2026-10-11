import { test } from 'node:test'
import assert from 'node:assert/strict'
import { estimateBasis, forPortion, isNutritionStale, nutritionBasis, nutritionTotals } from './nutrition.js'

const recipe = { base_servings: 4 }
const ingredients = [
  { quantity: 2, unit: 'cup', item: 'glutinous rice flour' },
  { quantity: 2, unit: 'tbsp', item: 'soy sauce' },
]
const nutrition = {
  items: [
    { number: 1, calories: 1200, protein_g: 20, carbs_g: 260, fat_g: 4 },
    { number: 2, calories: 20, protein_g: 4, carbs_g: 2, fat_g: 0 },
  ],
  based_on: nutritionBasis(recipe, ingredients),
}

test('totals add up the lines and divide by the recipe servings', () => {
  const { total, perServing } = nutritionTotals(nutrition, 4)
  assert.deepEqual(total, { calories: 1220, protein_g: 24, carbs_g: 262, fat_g: 4 })
  assert.deepEqual(perServing, { calories: 305, protein_g: 6, carbs_g: 65.5, fat_g: 1 })
  assert.deepEqual(forPortion(perServing, 1.5), { calories: 457.5, protein_g: 9, carbs_g: 98.25, fat_g: 1.5 })
})

test('the estimate goes stale when ingredients or servings change', () => {
  assert.equal(isNutritionStale(nutrition, recipe, ingredients), false)
  assert.equal(isNutritionStale(nutrition, { base_servings: 2 }, ingredients), true)
  const halved = [ingredients[0], { ...ingredients[1], quantity: 1 }]
  assert.equal(isNutritionStale(nutrition, recipe, halved), true)
  assert.equal(isNutritionStale(null, recipe, ingredients), false)
})

test('the estimate remembers what it was made from', () => {
  assert.deepEqual(estimateBasis(nutrition), { servings: 4, lines: ['2 cups glutinous rice flour', '2 tbsp soy sauce'] })
})
