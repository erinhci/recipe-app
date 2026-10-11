import { invokeFunction } from './functions.js'

// Sends a cooking question to the ask-step function. Returns
// { ok: true, answer } or { ok: false, message }.
export async function askStep({ recipe, servings, ingredientLines, steps, stepNumber, question }) {
  const result = await invokeFunction('ask-step', {
    title: recipe.title,
    servings,
    base_servings: recipe.base_servings,
    ingredients: ingredientLines,
    steps: steps.map((s) => s.text),
    step_number: stepNumber,
    question,
  })
  return result.ok ? { ok: true, answer: result.data.answer } : result
}
