// Turning a note into a recipe change. Gemini (the suggest-edit function)
// returns numbered changes; this file applies them to the recipe on the
// phone so the cooks can see before and after, then approve.

import { invokeFunction } from './functions.js'
import { ingredientToLine, parseIngredientLine } from './ingredients.js'
import { DEFAULT_SERVINGS } from './constants.js'

export async function suggestEdit({ recipe, ingredients, steps }, noteBody) {
  const result = await invokeFunction('suggest-edit', {
    title: recipe.title,
    base_servings: recipe.base_servings,
    usual_servings: DEFAULT_SERVINGS,
    ingredients: ingredients.map(ingredientToLine),
    steps: steps.map((s) => s.text),
    note: noteBody,
  })
  return result.ok ? { ok: true, ...result.data } : result
}

// Applies changes to one list. Every number refers to the list as it was
// before any change, so the order Gemini lists them in doesn't matter.
function applyToList(items, changes, makeChanged, makeAdded) {
  const removed = new Set()
  const replaced = new Map()
  const addsAfter = new Map()
  for (const c of changes) {
    if (c.action === 'remove') removed.add(c.number)
    else if (c.action === 'change') replaced.set(c.number, c.text)
    else if (c.action === 'add') addsAfter.set(c.number, [...(addsAfter.get(c.number) ?? []), c.text])
  }
  const out = []
  const pushAdds = (n) => (addsAfter.get(n) ?? []).forEach((text) => out.push(makeAdded(text)))
  pushAdds(0)
  items.forEach((item, i) => {
    const n = i + 1
    if (!removed.has(n)) out.push(replaced.has(n) ? makeChanged(item, replaced.get(n)) : item)
    pushAdds(n)
  })
  return out
}

function valid(change, count) {
  const n = change.number
  if (!Number.isInteger(n)) return false
  if (change.action === 'add') return Boolean(change.text?.trim())
  if (change.action === 'change') return n >= 1 && n <= count && Boolean(change.text?.trim())
  return change.action === 'remove' && n >= 1 && n <= count
}

// Returns the changed ingredients and steps (ready for saveRecipe; kept and
// changed lines keep their ids) and a list of before/after items to show.
export function applyChanges({ ingredients, steps }, changes) {
  // An add past the end goes at the end.
  const clamp = (c, count) => (c.action === 'add' ? { ...c, number: Math.min(Math.max(c.number, 0), count) } : c)
  const ingChanges = changes
    .filter((c) => c.target === 'ingredient' && valid(c, ingredients.length))
    .map((c) => clamp(c, ingredients.length))
  const stepChanges = changes.filter((c) => c.target === 'step' && valid(c, steps.length)).map((c) => clamp(c, steps.length))
  const skipped = changes.length - ingChanges.length - stepChanges.length

  const newIngredients = applyToList(
    ingredients,
    ingChanges,
    (old, text) => ({ ...parseIngredientLine(text), id: old.id, section: old.section ?? null }),
    (text) => parseIngredientLine(text),
  )
  const newSteps = applyToList(
    steps,
    stepChanges,
    (old, text) => ({ id: old.id, text }),
    (text) => ({ text }),
  )

  const describe = (target, list, toText) => (c) => {
    const after = c.action === 'remove' ? null : target === 'ingredient' ? parseIngredientLine(c.text) : null
    return {
      target,
      action: c.action,
      number: c.number,
      before: c.action === 'add' ? null : toText(list[c.number - 1]),
      after: c.action === 'remove' ? null : c.text,
      reason: c.reason ?? null,
      atEnd: c.action === 'add' && c.number === list.length && list.length > 0,
      needsReview: Boolean(after?.needs_review),
    }
  }
  const order = (a, b) => a.number - b.number
  const items = [
    ...ingChanges.map(describe('ingredient', ingredients, ingredientToLine)).sort(order),
    ...stepChanges.map(describe('step', steps, (s) => s.text)).sort(order),
  ]
  return { ingredients: newIngredients, steps: newSteps, items, skipped }
}
