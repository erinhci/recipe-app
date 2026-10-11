import { supabase } from './supabase.js'
import { blobToBase64, compressImage } from './images.js'
import { ingredientToLine } from './ingredients.js'
import { normalizeUnit } from './units.js'
import { splitRecipeText } from './textRecipe.js'

const MAX_PDF_BYTES = 8 * 1024 * 1024

// Calls the import-recipe Edge Function. Returns
// { ok: true, draft, method } or { ok: false, status, message }.
async function callImport(body) {
  const { data, error } = await supabase.functions.invoke('import-recipe', { body })
  if (!error) return { ok: true, draft: data.draft, method: data.method }

  let status = 0
  let message = error.message
  // HTTP errors carry the function's response; read its message.
  if (error.context && typeof error.context.json === 'function') {
    status = error.context.status
    try {
      const payload = await error.context.json()
      if (payload?.error) message = payload.error
    } catch {
      // Not JSON; keep the generic message.
    }
  }
  return { ok: false, status, message }
}

export async function prepareImages(files) {
  return Promise.all([...files].map((file) => compressImage(file)))
}

export async function importImages(blobs) {
  const images = await Promise.all(
    blobs.map(async (blob) => ({ mimeType: blob.type || 'image/jpeg', data: await blobToBase64(blob) })),
  )
  return callImport({ kind: 'images', images })
}

export async function importPdf(file) {
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, status: 413, message: 'That PDF is over 8 MB. Try a screenshot of the recipe page instead.' }
  }
  return callImport({ kind: 'pdf', pdf: { mimeType: 'application/pdf', data: await blobToBase64(file) } })
}

export async function importUrl(url) {
  return callImport({ kind: 'url', url })
}

// Turns a draft from the function into the review form's fields.
export function draftToForm(draft) {
  const ingredientLines = draft.ingredients
    ? draft.ingredients.map((ing) =>
        ingredientToLine({
          quantity: typeof ing.quantity === 'number' ? ing.quantity : null,
          unit: normalizeUnit(ing.unit),
          item: ing.item,
          prep_note: ing.prep || null,
        }),
      )
    : (draft.ingredient_lines ?? [])
  return {
    title: draft.title ?? '',
    servings: draft.servings ? String(draft.servings) : '',
    cuisine: draft.cuisine ?? '',
    mealType: draft.meal_type ?? '',
    totalTime: draft.total_time_minutes ?? null,
    sourceUrl: draft.source_url ?? '',
    sourceName: draft.source_name ?? '',
    ingredientText: ingredientLines.join('\n'),
    stepText: (draft.steps ?? []).join('\n\n'),
  }
}

// On-phone reading: raw text split into a draft by line shapes and headers.
export function textToForm(text, sourceUrl = '') {
  const { title, servings, ingredientLines, steps } = splitRecipeText(text)
  return {
    title,
    servings: servings ? String(servings) : '',
    cuisine: '',
    mealType: '',
    totalTime: null,
    sourceUrl,
    ingredientText: ingredientLines.join('\n'),
    stepText: steps.join('\n\n'),
  }
}
