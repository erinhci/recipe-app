import { getMeta, setMeta } from './db.js'
import { invokeFunction } from './functions.js'

// Likely questions for each step ("How do I know the oven is ready?"),
// suggested once per version of a recipe's steps and kept on this phone.

// A short fingerprint of the steps, so new steps get new questions.
export function stepsBasis(steps) {
  let hash = 0
  for (const char of steps.map((s) => s.text).join('\n')) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return `${steps.length}:${hash}`
}

const key = (recipeId) => `step-questions:${recipeId}`

export async function savedQuestions(recipeId, steps) {
  const saved = await getMeta(key(recipeId))
  return saved?.basis === stepsBasis(steps) ? saved.questions : null
}

// Asks Gemini for 2 likely questions per step. Returns an array (one list
// per step) or null if they couldn't be fetched.
export async function fetchQuestions(recipe, steps, ingredientLines) {
  const result = await invokeFunction('ask-step', {
    mode: 'suggest',
    title: recipe.title,
    servings: recipe.base_servings,
    base_servings: recipe.base_servings,
    ingredients: ingredientLines,
    steps: steps.map((s) => s.text),
  })
  const questions = result.ok ? result.data?.questions : null
  if (!Array.isArray(questions) || questions.length !== steps.length) return null
  await setMeta(key(recipe.id), { basis: stepsBasis(steps), questions })
  return questions
}
