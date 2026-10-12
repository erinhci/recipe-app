// Nutrition estimates. Gemini (the estimate-nutrition function) estimates
// each ingredient line; this file adds them up, divides by servings, and
// tells when the estimate no longer matches the recipe.

import { invokeFunction } from './functions.js'
import { ingredientToLine } from './ingredients.js'

export const NUTRIENTS = [
  { key: 'calories', label: 'Calories', unit: '' },
  { key: 'protein_g', label: 'Protein', unit: 'g' },
  { key: 'carbs_g', label: 'Carbs', unit: 'g' },
  { key: 'fat_g', label: 'Fat', unit: 'g' },
]

// What the estimate was made from. If this changes, the estimate is stale.
export function nutritionBasis(recipe, ingredients) {
  return `${recipe.base_servings}|${ingredients.map(ingredientToLine).join('\n')}`
}

// The servings and ingredient lines an estimate was made from.
export function estimateBasis(nutrition) {
  const basis = String(nutrition?.based_on ?? '')
  const bar = basis.indexOf('|')
  if (bar < 0) return { servings: null, lines: [] }
  return { servings: Number(basis.slice(0, bar)) || null, lines: basis.slice(bar + 1).split('\n').filter(Boolean) }
}

export function isNutritionStale(nutrition, recipe, ingredients) {
  return Boolean(nutrition) && nutrition.based_on !== nutritionBasis(recipe, ingredients)
}

export async function estimateNutrition(recipe, ingredients, member) {
  const result = await invokeFunction('estimate-nutrition', {
    title: recipe.title,
    base_servings: recipe.base_servings,
    ingredients: ingredients.map(ingredientToLine),
  })
  if (!result.ok) return result
  return {
    ok: true,
    nutrition: {
      items: result.data.items,
      notes: result.data.notes ?? null,
      based_on: nutritionBasis(recipe, ingredients),
      estimated_at: new Date().toISOString(),
      estimated_by: member.user_id,
    },
  }
}

// Totals for the whole recipe as written, and per serving.
export function nutritionTotals(nutrition, baseServings) {
  const total = Object.fromEntries(NUTRIENTS.map((n) => [n.key, 0]))
  for (const item of nutrition?.items ?? []) {
    for (const n of NUTRIENTS) total[n.key] += Number(item[n.key]) || 0
  }
  const servings = Number(baseServings) > 0 ? Number(baseServings) : 1
  const perServing = Object.fromEntries(NUTRIENTS.map((n) => [n.key, total[n.key] / servings]))
  return { total, perServing }
}

// Per-serving numbers times how many servings someone ate.
export function forPortion(perServing, servingsEaten) {
  return Object.fromEntries(NUTRIENTS.map((n) => [n.key, perServing[n.key] * servingsEaten]))
}

export function formatNutrient(key, value) {
  const rounded = Math.round(value)
  return key === 'calories' ? `${rounded}` : `${rounded} g`
}

// --- One cook: what was actually made -------------------------------------

const changesBasis = (texts) => texts.join('\n')

// Asks Gemini to estimate the changes made while cooking ("2 more eggs"),
// each as its own line. Returns { ok, nutrition } to save on the meal.
export async function estimateChanges(recipe, changeTexts) {
  const result = await invokeFunction('estimate-nutrition', {
    title: `Changes made while cooking ${recipe.title}`,
    base_servings: 1,
    ingredients: changeTexts,
  })
  if (!result.ok) return result
  return {
    ok: true,
    nutrition: { changes: result.data.items, based_on: changesBasis(changeTexts), estimated_at: new Date().toISOString() },
  }
}

// Whether the saved estimate of a meal's changes still matches them.
export const changesEstimated = (mealNutrition, changeTexts) =>
  changeTexts.length === 0 || mealNutrition?.based_on === changesBasis(changeTexts)

// Totals for one cook: the recipe's estimate scaled to the servings made,
// plus the estimated changes. Null without a recipe estimate.
export function mealTotals(recipe, servingsMade, mealNutrition, includeChanges = true) {
  if (!recipe.nutrition?.items?.length || !(servingsMade > 0)) return null
  const { perServing } = nutritionTotals(recipe.nutrition, recipe.base_servings)
  const total = forPortion(perServing, servingsMade)
  if (includeChanges) {
    for (const item of mealNutrition?.changes ?? []) {
      for (const n of NUTRIENTS) total[n.key] += Number(item[n.key]) || 0
    }
  }
  const per = Object.fromEntries(NUTRIENTS.map((n) => [n.key, total[n.key] / servingsMade]))
  return { total, perServing: per }
}
