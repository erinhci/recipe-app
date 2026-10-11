// Supabase Edge Function: import-recipe
//
// Turns a screenshot, PDF, or link into a recipe draft for the review screen.
//   - Links: most recipe sites embed structured recipe data in the page
//     (schema.org JSON-LD). That's read directly, with no AI and no cost.
//   - Screenshots, PDFs, and pages without that data go to Gemini, which
//     must answer in a fixed JSON shape.
//
// The Gemini key is read from the GEMINI_API_KEY secret and never leaves
// the server. Only signed-in users can call this function (JWT
// verification stays on when it's deployed).
//
// Request body (JSON), one of:
//   { "kind": "images", "images": [{ "mimeType": "image/jpeg", "data": "<base64>" }] }
//   { "kind": "pdf", "pdf": { "mimeType": "application/pdf", "data": "<base64>" } }
//   { "kind": "url", "url": "https://..." }
//
// Response: { draft: { title, servings, cuisine, meal_type, total_time_minutes,
//   ingredients: [{ quantity, unit, item, prep }] | null,
//   ingredient_lines: string[] | null, steps: string[], source_url, source_name }, method }
//   source_name: who the recipe is credited to (a site, book, or person), if shown.

const CUISINES = [
  'American', 'Chinese', 'French', 'Indian', 'Italian', 'Japanese', 'Korean',
  'Mediterranean', 'Mexican', 'Middle Eastern', 'Thai', 'Vietnamese', 'Other',
]
const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'side', 'snack', 'dessert', 'drink']

// Tried in order; the second is used when the first hits its free limit.
const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite']

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

// ---------------------------------------------------------------------------
// Structured recipe data embedded in web pages (schema.org JSON-LD)
// ---------------------------------------------------------------------------

type Draft = {
  title: string
  servings: number | null
  cuisine: string | null
  meal_type: string | null
  total_time_minutes: number | null
  ingredients: { quantity: number | null; unit: string | null; item: string; prep: string | null }[] | null
  ingredient_lines: string[] | null
  steps: string[]
  source_url: string | null
  source_name: string | null
}

function decodeEntities(text: string) {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&frac12;/g, '½')
    .replace(/&frac14;/g, '¼')
    .replace(/&frac34;/g, '¾')
    .replace(/&deg;/g, '°')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
}

function clean(text: unknown): string {
  return decodeEntities(String(text ?? '').replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;:!?)])/g, '$1')
    .trim()
}

function isRecipe(node: any) {
  const type = node?.['@type']
  return type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe'))
}

function findRecipe(node: any): any {
  if (!node || typeof node !== 'object') return null
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findRecipe(child)
      if (found) return found
    }
    return null
  }
  if (isRecipe(node)) return node
  return findRecipe(node['@graph']) ?? findRecipe(node.mainEntity) ?? null
}

function parseServings(yieldValue: unknown): number | null {
  const values = Array.isArray(yieldValue) ? yieldValue : [yieldValue]
  for (const value of values) {
    const match = String(value ?? '').match(/\d+(\.\d+)?/)
    if (match) return Number(match[0])
  }
  return null
}

// ISO 8601 durations like "PT1H30M".
function parseMinutes(duration: unknown): number | null {
  const match = String(duration ?? '').match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/)
  if (!match || !match[0] || match[0] === 'P' || match[0] === 'PT') return null
  const [, d, h, m] = match
  const total = Number(d ?? 0) * 1440 + Number(h ?? 0) * 60 + Number(m ?? 0)
  return total || null
}

function flattenSteps(instructions: any): string[] {
  if (!instructions) return []
  if (typeof instructions === 'string') {
    return instructions.split(/<\/(?:p|li)>|<br\s*\/?>|\n+/i).map(clean).filter(Boolean)
  }
  if (Array.isArray(instructions)) return instructions.flatMap(flattenSteps)
  if (instructions['@type'] === 'HowToSection' || instructions.itemListElement) {
    return flattenSteps(instructions.itemListElement)
  }
  const text = clean(instructions.text ?? instructions.name)
  return text ? [text] : []
}

function matchCuisine(value: unknown): string | null {
  const values = Array.isArray(value) ? value : [value]
  for (const v of values) {
    const found = CUISINES.find((c) => c.toLowerCase() === String(v ?? '').trim().toLowerCase())
    if (found) return found
  }
  return null
}

// Who the page credits: the recipe's author, else the site that published it.
function creditFrom(recipe: any): string | null {
  const names = (value: any): string[] =>
    (Array.isArray(value) ? value : [value])
      .map((v) => (typeof v === 'string' ? v : v?.name))
      .map((v) => clean(v))
      .filter(Boolean)
  const author = names(recipe.author).join(', ')
  return (author || names(recipe.publisher)[0] || '').slice(0, 120) || null
}

export function recipeFromHtml(html: string, sourceUrl: string | null = null): Draft | null {
  const scripts = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  for (const [, body] of scripts) {
    let data: unknown
    try {
      data = JSON.parse(body.trim())
    } catch {
      continue
    }
    const recipe = findRecipe(data)
    if (!recipe) continue
    const lines = (Array.isArray(recipe.recipeIngredient) ? recipe.recipeIngredient : [])
      .map(clean)
      .filter(Boolean)
    if (lines.length === 0) continue
    return {
      title: clean(recipe.name) || 'Untitled recipe',
      servings: parseServings(recipe.recipeYield),
      cuisine: matchCuisine(recipe.recipeCuisine),
      meal_type: null,
      total_time_minutes: parseMinutes(recipe.totalTime) ?? parseMinutes(recipe.cookTime),
      ingredients: null,
      ingredient_lines: lines,
      steps: flattenSteps(recipe.recipeInstructions),
      source_url: sourceUrl,
      source_name: creditFrom(recipe),
    }
  }
  return null
}

export function pageText(html: string) {
  return clean(
    html
      .replace(/<(script|style|noscript|svg|header|footer|nav)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<\/(p|div|li|h\d|br|tr)>/gi, '\n'),
  ).slice(0, 30000)
}

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

const PROMPT = `You read recipes from screenshots, photos of cookbook pages, PDFs, and web page text.
Return the recipe exactly as written. Rules:
- Copy ingredient amounts as written. Do not convert units or scale.
- quantity is a number (convert fractions: 1 1/2 -> 1.5). Use null when there is no amount ("salt to taste").
- unit is the unit word as written ("cup", "tbsp", "g", "clove", "can"), or null when there is none ("2 eggs").
- item is the ingredient name. prep is preparation like "diced" or "room temperature", or null.
- steps are the instructions in order, one entry per step, without step numbers.
- servings is the number of servings the recipe makes as written, or null if not stated.
- cuisine must be one of the allowed values; use "Other" if none fits. meal_type must be one of the allowed values.
- If the image or text contains no recipe, return an empty title and empty lists.
- source_name is who the recipe is credited to if the image or text names it: a person, blog, website, cookbook, or social account. Use null if no one is credited. Do not guess.
- source_url is a web address printed with the recipe, or null.
- Ignore ads, comments, and life stories around the recipe.`

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    servings: { type: 'NUMBER', nullable: true },
    cuisine: { type: 'STRING', enum: CUISINES },
    meal_type: { type: 'STRING', enum: MEAL_TYPES },
    total_time_minutes: { type: 'INTEGER', nullable: true },
    ingredients: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          quantity: { type: 'NUMBER', nullable: true },
          unit: { type: 'STRING', nullable: true },
          item: { type: 'STRING' },
          prep: { type: 'STRING', nullable: true },
        },
        required: ['item'],
      },
    },
    steps: { type: 'ARRAY', items: { type: 'STRING' } },
    source_name: { type: 'STRING', nullable: true },
    source_url: { type: 'STRING', nullable: true },
  },
  required: ['title', 'ingredients', 'steps', 'cuisine', 'meal_type'],
}

class GeminiError extends Error {
  status: number
  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

const FUNCTION_NAME = 'import-recipe'

// How much the model "thinks" before answering. Less thinking answers
// sooner. Flash-Lite already uses the least by default, and older models
// don't take this setting, so it's only sent to Gemini 3 Flash models.
const THINKING_LEVEL: string | null = 'low'

export function thinkingFor(model: string) {
  if (!THINKING_LEVEL || model.includes('flash-lite') || !/^gemini-3/.test(model)) return null
  return { thinkingLevel: THINKING_LEVEL }
}

// One request to one model. If the model rejects the thinking setting,
// asks again without it. Logs how long it took (Supabase > Edge Functions > Logs).
export async function callGemini(model: string, apiKey: string, contents: unknown, generationConfig: Record<string, unknown>) {
  const send = (thinking: unknown) =>
    fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents, generationConfig: thinking ? { ...generationConfig, thinkingConfig: thinking } : generationConfig }),
    })
  const started = Date.now()
  const thinking = thinkingFor(model)
  let response = await send(thinking)
  if (response.status === 400 && thinking) response = await send(null)
  console.log(JSON.stringify({ fn: FUNCTION_NAME, model, status: response.status, ms: Date.now() - started }))
  return response
}

async function askGemini(parts: unknown[], apiKey: string, models: string[]): Promise<Draft> {
  let lastError: GeminiError | null = null
  for (const model of models) {
    const response = await callGemini(model, apiKey, [{ role: 'user', parts: [{ text: PROMPT }, ...parts] }], {
            responseMimeType: 'application/json',
            responseSchema: SCHEMA,
            temperature: 0,
          })
    if (response.status === 429 || response.status === 503) {
      // Free limit reached or model busy: try the next model.
      lastError = new GeminiError(`Gemini ${model} is over its limit right now.`, response.status)
      continue
    }
    if (!response.ok) {
      const detail = await response.text()
      throw new GeminiError(`Gemini error (${response.status}): ${detail.slice(0, 300)}`, response.status)
    }
    const result = await response.json()
    const text = result?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('')
    if (!text) throw new GeminiError('Gemini returned no recipe.', 502)
    const parsed = JSON.parse(text)
    return {
      title: String(parsed.title ?? '').trim(),
      servings: typeof parsed.servings === 'number' && parsed.servings > 0 ? parsed.servings : null,
      cuisine: CUISINES.includes(parsed.cuisine) ? parsed.cuisine : null,
      meal_type: MEAL_TYPES.includes(parsed.meal_type) ? parsed.meal_type : null,
      total_time_minutes: Number.isInteger(parsed.total_time_minutes) ? parsed.total_time_minutes : null,
      ingredients: (parsed.ingredients ?? []).filter((i: any) => i?.item),
      ingredient_lines: null,
      steps: (parsed.steps ?? []).map((s: unknown) => String(s).trim()).filter(Boolean),
      source_url: /^https?:\/\/\S+\.\S+$/.test(String(parsed.source_url ?? '').trim()) ? String(parsed.source_url).trim() : null,
      source_name: String(parsed.source_name ?? '').trim().slice(0, 120) || null,
    }
  }
  throw lastError ?? new GeminiError('No Gemini model available.', 503)
}

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

function isAllowedUrl(raw: string) {
  try {
    const url = new URL(raw)
    if (!['http:', 'https:'].includes(url.protocol)) return false
    const host = url.hostname
    // Keep the function from being pointed at private network addresses.
    if (/^(localhost|0\.0\.0\.0|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)) return false
    if (host.endsWith('.internal') || host === '[::1]') return false
    return true
  } catch {
    return false
  }
}

async function fetchPage(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; OurKitchenRecipeImport/1.0)',
      Accept: 'text/html,application/xhtml+xml',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
  })
  if (!response.ok) throw new GeminiError(`That page returned an error (${response.status}).`, 422)
  return await response.text()
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  const models = String(Deno.env.get('GEMINI_MODELS') ?? '').split(',').map((m: string) => m.trim()).filter(Boolean)
  const modelList = models.length ? models : DEFAULT_MODELS

  let body: any
  try {
    body = await request.json()
  } catch {
    return json({ error: 'The request was not valid JSON.' }, 400)
  }

  try {
    if (body.kind === 'url') {
      const url = String(body.url ?? '').trim()
      if (!isAllowedUrl(url)) return json({ error: 'That link is not a web address the app can open.' }, 400)
      const html = await fetchPage(url)
      const fromPage = recipeFromHtml(html, url)
      if (fromPage) return json({ draft: fromPage, method: 'page-data' })
      if (!apiKey) return json({ error: 'The Gemini key is not set up yet.' }, 500)
      const draft = await askGemini([{ text: `Web page text:\n${pageText(html)}` }], apiKey, modelList)
      return json({ draft: { ...draft, source_url: url }, method: 'gemini' })
    }

    if (!apiKey) return json({ error: 'The Gemini key is not set up yet.' }, 500)

    if (body.kind === 'images') {
      const images = Array.isArray(body.images) ? body.images.slice(0, 6) : []
      if (images.length === 0) return json({ error: 'No images were sent.' }, 400)
      const parts = images.map((img: any) => ({
        inline_data: { mime_type: String(img.mimeType || 'image/jpeg'), data: String(img.data) },
      }))
      const draft = await askGemini(parts, apiKey, modelList)
      return json({ draft, method: 'gemini' })
    }

    if (body.kind === 'pdf') {
      const pdf = body.pdf
      if (!pdf?.data) return json({ error: 'No PDF was sent.' }, 400)
      const draft = await askGemini(
        [{ inline_data: { mime_type: 'application/pdf', data: String(pdf.data) } }],
        apiKey,
        modelList,
      )
      return json({ draft, method: 'gemini' })
    }

    return json({ error: 'Unknown import type.' }, 400)
  } catch (error) {
    const status = error instanceof GeminiError ? error.status : 500
    // 429 and 503 tell the app to offer the on-phone fallback.
    return json({ error: error instanceof Error ? error.message : String(error) }, status)
  }
}

// Deno runs this as a server; tests import the helpers above in Node.
declare const Deno: any
if (typeof Deno !== 'undefined') Deno.serve(handle)
