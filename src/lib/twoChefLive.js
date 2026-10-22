import { supabase } from './supabase.js'

// The live two-chef cook shared by both phones (two_chef_cooks in
// Supabase). Every change goes through a database function, so two phones
// tapping at once can't overwrite each other. Each call returns
// { ok: true, cook } or { ok: false, message, offline }.

function failure(error) {
  const text = String(error?.message ?? error ?? '')
  if (/fetch|network|load failed/i.test(text)) {
    return { ok: false, offline: true, message: "Couldn’t reach the server. Your check-offs are kept on this phone." }
  }
  if (error?.code === 'PGRST202' || /could not find the function|does not exist/i.test(text)) {
    return { ok: false, message: 'Two-chef mode isn\'t set up yet. Run the newest migrations in Supabase (0007 and 0008).' }
  }
  return { ok: false, message: text || 'Something went wrong. Try again.' }
}

async function call(fn, args) {
  try {
    const { data, error } = await supabase.rpc(fn, args)
    if (error) return failure(error)
    return { ok: true, cook: data }
  } catch (error) {
    return failure(error)
  }
}

// Opens or joins the recipe's cook. The first phone's servings are shared.
// Before migration 0008, the function takes only the recipe.
export async function startCook(recipeId, servings) {
  const result = await call('start_two_chef', { p_recipe: recipeId, p_servings: servings })
  if (!result.ok && /set up yet/.test(result.message)) return call('start_two_chef', { p_recipe: recipeId })
  return result
}
export const setServings = (cookId, servings) => call('set_servings', { p_cook: cookId, p_servings: servings })
export const claimChef = (cookId, side) => call('claim_chef', { p_cook: cookId, p_side: side })
export const swapChefs = (cookId) => call('swap_chefs', { p_cook: cookId })
export const setStepDone = (cookId, stepId, done) => call('set_step_done', { p_cook: cookId, p_step: stepId, p_done: done })
// Several check-offs at once (catching up), sent one at a time. Stops at
// the first failure and returns it; otherwise the last result.
export async function setStepsDone(cookId, stepIds, done) {
  let result = { ok: true, cook: null }
  for (const stepId of stepIds) {
    result = await setStepDone(cookId, stepId, done)
    if (!result.ok) return result
  }
  return result
}
export const moveStep = (cookId, stepId, track) => call('move_step', { p_cook: cookId, p_step: stepId, p_track: track })
export const endCook = (cookId) => call('end_two_chef', { p_cook: cookId })

export async function fetchCook(cookId) {
  try {
    const { data, error } = await supabase.from('two_chef_cooks').select('*').eq('id', cookId).maybeSingle()
    if (error) return failure(error)
    return { ok: true, cook: data }
  } catch (error) {
    return failure(error)
  }
}

// Calls onChange with the new record whenever the other phone changes it.
// Returns a function that stops listening.
export function watchCook(cookId, onChange) {
  const channel = supabase
    .channel(`two-chef-${cookId}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'two_chef_cooks', filter: `id=eq.${cookId}` }, (payload) =>
      onChange(payload.new),
    )
    .subscribe()
  return () => supabase.removeChannel(channel)
}
