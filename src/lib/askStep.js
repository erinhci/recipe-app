import { supabase } from './supabase.js'

// Sends a cooking question to the ask-step function. Returns
// { ok: true, answer } or { ok: false, message }.
export async function askStep({ recipe, servings, ingredientLines, steps, stepNumber, question }) {
  const { data, error } = await supabase.functions.invoke('ask-step', {
    body: {
      title: recipe.title,
      servings,
      base_servings: recipe.base_servings,
      ingredients: ingredientLines,
      steps: steps.map((s) => s.text),
      step_number: stepNumber,
      question,
    },
  })
  if (!error) return { ok: true, answer: data.answer }

  let message = "Couldn't get an answer. Check the connection and try again."
  if (error.context?.status === 404) {
    message = "Step questions aren't set up yet. Deploy the ask-step function in Supabase."
  } else if (error.context && typeof error.context.json === 'function') {
    try {
      const payload = await error.context.json()
      if (payload?.error) message = payload.error
    } catch {
      // Not JSON; keep the general message.
    }
  }
  return { ok: false, message }
}
