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
