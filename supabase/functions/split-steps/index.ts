// Supabase Edge Function: split-steps
//
// Splits a recipe's steps between two cooks working at the same time, for
// two-chef mode. Each step goes to track "a", track "b", or "both" (a step
// where the two parts come together). The app saves the split with the
// recipe, so two-chef mode works offline after that.
//
// The Gemini key is read from the GEMINI_API_KEY secret and never leaves
// the server. Only signed-in users can call this function (JWT
// verification stays on when it's deployed).
//
// Request body (JSON): { title, ingredients: string[], steps: string[] }
// Response: { splittable, reason, names: { a, b }, tracks: ("a" | "b" | "both")[] }
//   tracks has one entry per step, in order.

const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite']
const FUNCTION_NAME = 'split-steps'
const TRACKS = ['a', 'b', 'both']

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

type Input = { title: string; ingredients: string[]; steps: string[] }
type Track = 'a' | 'b' | 'both'

export function readInput(body: any): Input | string {
  const list = (v: unknown, max: number) =>
    Array.isArray(v) ? v.map((s: unknown) => String(s).trim()).filter(Boolean).slice(0, max) : []
  const steps = list(body?.steps, 60)
  if (steps.length < 2) return 'A recipe needs at least two steps to split between two cooks.'
  return {
    title: String(body?.title ?? 'this recipe').slice(0, 200),
    ingredients: list(body?.ingredients, 80),
    steps,
  }
}

export function buildPrompt(input: Input) {
  return [
    'Split this home recipe between two cooks working at the same time in one kitchen.',
    'Rules:',
    '- Put every step in track "a", track "b", or "both".',
    '- Use "both" only where the two parts come together, like combining the sauce and the pasta, or a step that needs both parts finished.',
    '- Keep steps that depend on each other in the same track, so neither cook waits on the other until a "both" step.',
    '- Balance the tracks so they take about the same time.',
    '- name_a and name_b: one to three words for what each track makes, like "Sauce" and "Pasta".',
    '- If two people can\'t share the work (each step needs the one before it), set splittable to false and give a one-sentence reason. Still return a track for every step.',
    '- Return one entry for every step, using the step numbers below.',
    '',
    `Recipe: ${input.title}`,
    'Ingredients:',
    ...input.ingredients.map((line) => `- ${line}`),
    'Steps:',
    ...input.steps.map((step, i) => `${i + 1}. ${step}`),
  ].join('\n')
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    splittable: { type: 'BOOLEAN' },
    reason: { type: 'STRING', nullable: true },
    name_a: { type: 'STRING' },
    name_b: { type: 'STRING' },
    steps: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          number: { type: 'INTEGER' },
          track: { type: 'STRING', enum: TRACKS },
        },
        required: ['number', 'track'],
      },
    },
  },
  required: ['splittable', 'name_a', 'name_b', 'steps'],
}

const shortName = (value: unknown, fallback: string) => {
  const text = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : ''
  return text ? text.slice(0, 24) : fallback
}

// One track per step, in order. A step Gemini skipped becomes a shared
// step, so nothing is lost. A split where one cook gets nothing isn't a
// split.
export function cleanSplit(raw: any, stepCount: number) {
  const tracks: Track[] = Array(stepCount).fill('both')
  const seen = new Set<number>()
  for (const r of Array.isArray(raw?.steps) ? raw.steps : []) {
    const number = Number(r?.number)
    if (!Number.isInteger(number) || number < 1 || number > stepCount || seen.has(number)) continue
    if (!TRACKS.includes(r?.track)) continue
    seen.add(number)
    tracks[number - 1] = r.track
  }
  const names = { a: shortName(raw?.name_a, 'Track 1'), b: shortName(raw?.name_b, 'Track 2') }
  if (names.a.toLowerCase() === names.b.toLowerCase()) names.b = `${names.b} 2`
  const reason = typeof raw?.reason === 'string' && raw.reason.trim() ? raw.reason.trim() : null
  const bothHaveWork = tracks.includes('a') && tracks.includes('b')
  if (raw?.splittable === false || !bothHaveWork) {
    return {
      splittable: false,
      reason: reason ?? 'Each step needs the one before it, so there is nothing for a second cook to do at the same time.',
      names,
      tracks,
    }
  }
  return { splittable: true, reason: null, names, tracks }
}

// How much the model "thinks" before answering. Less thinking answers
// sooner. Flash-Lite already uses the least by default, and older models
// don't take this setting, so it's only sent to Gemini 3 Flash models.
// Splitting needs the model to work out which steps depend on others,
// so it keeps the default amount of thinking. It runs once per recipe.
const THINKING_LEVEL: string | null = null

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

async function handle(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)

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
    return json(cleanSplit(result.parsed, input.steps.length))
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
}

// Deno runs this as a server; tests import the helpers above in Node.
declare const Deno: any
if (typeof Deno !== 'undefined') Deno.serve(handle)
