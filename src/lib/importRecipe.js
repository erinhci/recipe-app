import { supabase } from './supabase.js'
import { blobToBase64, compressImage } from './images.js'
import { ingredientsToText, sectionHeading } from './ingredients.js'

const sectionName = (name) => sectionHeading(`${name}:`) || null
import { normalizeUnit } from './units.js'
import { splitRecipeText } from './textRecipe.js'

// PDFs up to this size go to Gemini whole. Larger ones (usually a saved
// web page full of photos) are read on the phone first, and only the text,
// or a few page images for a scanned PDF, is sent.
const MAX_PDF_BYTES = 8 * 1024 * 1024

// The Supabase client's own wording when a function fails without a
// message of its own.
const GENERIC = /non-2xx|failed to send|functionsfetcherror|functionshttperror|failed to fetch|load failed/i
function friendly(status, message) {
  if (message && !GENERIC.test(message)) return message
  if (status === 413) return 'That file is too big to send. Try screenshots of the recipe instead.'
  if (status === 404) return "The import isn’t set up yet. Deploy the import-recipe function in Supabase."
  if (status >= 500) return `The import ran into a problem on the server (error ${status}). Try again in a minute.`
  if (status) return `The import didn’t work (error ${status}). Try again, or use screenshots instead.`
  return "Couldn’t reach the server. Check the connection and try again."
}

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
  return { ok: false, status, message: friendly(status, message) }
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

// onStep is told what's happening, for the loading message.
export async function importPdf(file, onStep) {
  if (file.size <= MAX_PDF_BYTES) {
    return callImport({ kind: 'pdf', pdf: { mimeType: 'application/pdf', data: await blobToBase64(file) } })
  }
  const { readPdfText, renderPdfPages } = await import('./readers.js')
  onStep?.("Reading the PDF on this phone first, since it’s a large file…")
  let text = null
  try {
    text = await readPdfText(file)
  } catch {
    return { ok: false, status: 0, message: "This phone couldn’t open that PDF. Try screenshots of the recipe instead." }
  }
  onStep?.('Gemini is reading the recipe…')
  if (text) return callImport({ kind: 'text', text: text.slice(0, 30000) })
  // A scanned PDF: send its first pages as images.
  const pages = await renderPdfPages(file)
  if (pages.length === 0) return { ok: false, status: 0, message: "This phone couldn’t read that PDF. Try screenshots instead." }
  const images = await Promise.all(pages.map((blob) => compressImage(blob)))
  return importImages(images)
}

export async function importUrl(url) {
  return callImport({ kind: 'url', url })
}

// Turns a draft from the function into the review form's fields.
export function draftToForm(draft) {
  // Gemini marks which part of the list each ingredient is in ("Sauce");
  // the text gets a "Sauce:" line where the part changes.
  const ingredientLines = draft.ingredients
    ? ingredientsToText(
        draft.ingredients.map((ing) => ({
          quantity: typeof ing.quantity === 'number' ? ing.quantity : null,
          unit: normalizeUnit(ing.unit),
          item: ing.item,
          prep_note: ing.prep || null,
          section: typeof ing.section === 'string' && ing.section.trim() ? sectionName(ing.section) : null,
        })),
      ).split('\n')
    : (draft.ingredient_lines ?? [])
  return {
    title: draft.title ?? '',
    servings: draft.servings ? String(draft.servings) : '',
    cuisine: draft.cuisine ?? '',
    mealType: draft.meal_type ?? '',
    totalTime: draft.total_time_minutes ?? null,
    prepTime: draft.prep_minutes ?? null,
    cookTime: draft.cook_minutes ?? null,
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
