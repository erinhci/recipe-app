// Supabase Edge Function: estimate-nutrition
//
// Estimates calories, protein, carbs, and fat for each ingredient line of
// a recipe. The app adds the lines up and divides by servings itself, so
// the totals always match the breakdown shown to the cooks.
//
// The Gemini key is read from the GEMINI_API_KEY secret and never leaves
// the server. Only signed-in cooks in a kitchen listed in the AI_KITCHEN_IDS secret can
// use it (see checkCaller below).
//
// Request body (JSON): { title, base_servings, ingredients: string[] }
// Response: { items: [{ number, calories, protein_g, carbs_g, fat_g, assumption }], notes }
//   One item per ingredient line that could be estimated, numbered from 1.

const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite']
// No single ingredient line in a home recipe should be above this.
const MAX_LINE_CALORIES = 20000

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

type Input = { title: string; base_servings: number; ingredients: string[] }

type Item = {
  number: number
  calories: number
  protein_g: number
  carbs_g: number
  fat_g: number
  assumption: string | null
}

export function readInput(body: any): Input | string {
  const ingredients = Array.isArray(body?.ingredients)
    ? body.ingredients.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, 80)
    : []
  if (ingredients.length === 0) return 'This recipe has no ingredients to estimate.'
  return {
    title: String(body?.title ?? 'this recipe').slice(0, 200),
    base_servings: Number(body?.base_servings) > 0 ? Number(body.base_servings) : 2,
    ingredients,
  }
}

export function buildPrompt(input: Input) {
  return [
    'Estimate the nutrition of each ingredient line in this home recipe, for the full amount on that line.',
    'Rules:',
    '- Use standard USDA-style values. Treat ingredients as raw or as sold unless the line says cooked.',
    '- calories in kcal; protein_g, carbs_g, and fat_g in grams. Round to whole numbers.',
    '- Water, ice, salt, and plain spices with no amount count as 0.',
    '- If a line has no amount ("oil for frying", "cheese to taste"), assume a typical amount for this recipe and say what you assumed in assumption. For frying oil, count only what the food absorbs.',
    '- If you had to guess what an ingredient is or how big it is ("1 onion"), say what you assumed. Otherwise leave assumption empty.',
    '- Return one item for every line, using the line numbers below.',
    '- notes: one short sentence about anything that makes the whole estimate less reliable, or empty.',
    '',
    `Recipe: ${input.title} (serves ${input.base_servings})`,
    'Ingredients:',
    ...input.ingredients.map((line, i) => `${i + 1}. ${line}`),
  ].join('\n')
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    items: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          number: { type: 'INTEGER' },
          calories: { type: 'NUMBER' },
          protein_g: { type: 'NUMBER' },
          carbs_g: { type: 'NUMBER' },
          fat_g: { type: 'NUMBER' },
          assumption: { type: 'STRING', nullable: true },
        },
        required: ['number', 'calories', 'protein_g', 'carbs_g', 'fat_g'],
      },
    },
    notes: { type: 'STRING', nullable: true },
  },
  required: ['items'],
}

// Keeps one sensible item per real line.
export function cleanItems(raw: any, lineCount: number): Item[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<number>()
  const out: Item[] = []
  const amount = (v: unknown) => {
    const n = Number(v)
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
  }
  for (const r of raw) {
    const number = Number(r?.number)
    if (!Number.isInteger(number) || number < 1 || number > lineCount || seen.has(number)) continue
    const calories = amount(r?.calories)
    const protein_g = amount(r?.protein_g)
    const carbs_g = amount(r?.carbs_g)
    const fat_g = amount(r?.fat_g)
    if (calories === null || protein_g === null || carbs_g === null || fat_g === null) continue
    if (calories > MAX_LINE_CALORIES) continue
    const assumption = typeof r?.assumption === 'string' && r.assumption.trim() ? r.assumption.trim() : null
    seen.add(number)
    out.push({ number, calories, protein_g, carbs_g, fat_g, assumption })
  }
  return out.sort((a, b) => a.number - b.number)
}

const FUNCTION_NAME = 'estimate-nutrition'

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

async function askGemini(prompt: string, apiKey: string, models: string[]) {
  let overLimit = false
  for (const model of models) {
    const response = await callGemini(model, apiKey, [{ role: 'user', parts: [{ text: prompt }] }], { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 })
    if (response.status === 429 || response.status === 503) {
      // Free limit reached or model busy: try the next model.
      overLimit = true
      continue
    }
    if (!response.ok) {
      const detail = await response.text()
      return { status: 502, error: `Gemini error (${response.status}): ${detail.slice(0, 300)}` }
    }
    const result = await response.json()
    const text = result?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('')
    if (!text) return { status: 502, error: 'Gemini returned nothing. Try again.' }
    return { status: 200, parsed: JSON.parse(text) }
  }
  return {
    status: overLimit ? 429 : 503,
    error: 'Gemini is over the free limit right now. Try again in a minute.',
  }
}

// --- Who may spend the Gemini key (the same block is in every function) ---
// JWT verification alone isn't enough: the app's anon key ships in every
// page and also passes it, and anyone can create an account. So each call
// is checked here: the caller must be signed in (Supabase Auth confirms
// the token), and their kitchen must be listed in the AI_KITCHEN_IDS
// secret (kitchen ids, comma-separated). With that secret unset nobody
// gets through, so the key can't be spent by accident.
export const AI_OFF_MESSAGE = 'Gemini features are turned off for this kitchen. Everything else in the app still works.'

export function allowedKitchens(raw: unknown): Set<string> {
  return new Set(String(raw ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean))
}

export async function checkCaller(request: Request): Promise<Response | null> {
  const url = Deno.env.get('SUPABASE_URL')
  const apikey = request.headers.get('apikey') || Deno.env.get('SUPABASE_ANON_KEY')
  if (!url || !apikey) return json({ error: 'The server is missing its Supabase settings.' }, 500)
  const token = (request.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const signedOut = json({ error: 'Sign in to use this.', code: 'signed_out' }, 401)
  if (!token || token === apikey) return signedOut
  const headers = { apikey, Authorization: `Bearer ${token}` }
  const userResponse = await fetch(`${url}/auth/v1/user`, { headers })
  if (!userResponse.ok) return signedOut
  const user = await userResponse.json()
  if (!user?.id) return signedOut
  const allowed = allowedKitchens(Deno.env.get('AI_KITCHEN_IDS'))
  if (allowed.size === 0) return json({ error: AI_OFF_MESSAGE, code: 'ai_not_enabled' }, 403)
  const membersResponse = await fetch(
    `${url}/rest/v1/members?select=kitchen_id&removed_at=is.null&user_id=eq.${encodeURIComponent(user.id)}`,
    { headers },
  )
  const rows = membersResponse.ok ? await membersResponse.json() : []
  const ok = Array.isArray(rows) && rows.some((row) => allowed.has(String(row?.kitchen_id ?? '').toLowerCase()))
  return ok ? null : json({ error: AI_OFF_MESSAGE, code: 'ai_not_enabled' }, 403)
}
// --- end of the shared access block ---

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const denied = await checkCaller(request)
  if (denied) return denied

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'The Gemini key is not set up yet.' }, 500)
  const models = String(Deno.env.get('GEMINI_MODELS') ?? '').split(',').map((m: string) => m.trim()).filter(Boolean)

  let body: any
  try {
    body = await request.json()
  } catch {
    return json({ error: 'The request was not valid JSON.' }, 400)
  }

  const input = readInput(body)
  if (typeof input === 'string') return json({ error: input }, 400)

  try {
    const result = await askGemini(buildPrompt(input), apiKey, models.length ? models : DEFAULT_MODELS)
    if (result.status !== 200) return json({ error: result.error }, result.status)
    const items = cleanItems(result.parsed?.items, input.ingredients.length)
    if (items.length === 0) return json({ error: 'Gemini could not estimate this recipe. Try again.' }, 502)
    const notes = typeof result.parsed?.notes === 'string' && result.parsed.notes.trim() ? result.parsed.notes.trim() : null
    return json({ items, notes })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
}

// Deno runs this as a server; tests import the helpers above in Node.
declare const Deno: any
if (typeof Deno !== 'undefined') Deno.serve(handle)
