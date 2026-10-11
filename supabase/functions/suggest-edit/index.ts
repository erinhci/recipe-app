// Supabase Edge Function: suggest-edit
//
// Turns a note ("too salty, halve the soy sauce next time") into a
// proposed change to the recipe. It only proposes: the app shows the
// change as before and after, and nothing is saved until a cook approves.
//
// The answer is a list of numbered changes rather than a rewritten
// recipe, so lines the note doesn't touch can't drift.
//
// The Gemini key is read from the GEMINI_API_KEY secret and never leaves
// the server. Only signed-in users can call this function (JWT
// verification stays on when it's deployed).
//
// Request body (JSON):
//   { title, base_servings, usual_servings, ingredients: string[], steps: string[], note }
// Response:
//   { summary, no_change_reason, skipped, changes: [{ target, action, number, text, reason }] }
//   target: "ingredient" | "step"; action: "change" | "add" | "remove"
//   number: for change/remove, the item's number (1-based);
//           for add, the number it goes after (0 = at the start; a number
//           past the end is treated as "at the end")
//   reason: what this one change does, in plain words
//   skipped: how many suggested changes couldn't be used

const DEFAULT_MODELS = ['gemini-3.8-flash', 'gemini-3.5-flash-lite']
const MAX_NOTE = 2000

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

type Request_ = {
  title: string
  base_servings: number
  usual_servings: number
  ingredients: string[]
  steps: string[]
  note: string
}

type Change = {
  target: 'ingredient' | 'step'
  action: 'change' | 'add' | 'remove'
  number: number
  text: string | null
  reason: string | null
}

export function readRequest(body: any): Request_ | string {
  const note = String(body?.note ?? '').trim()
  if (!note) return 'There is no note to work from.'
  if (note.length > MAX_NOTE) return 'That note is too long to turn into a change.'
  const list = (value: unknown, max: number) =>
    Array.isArray(value) ? value.map((s) => String(s)).filter((s) => s.trim()).slice(0, max) : []
  const ingredients = list(body?.ingredients, 80)
  const steps = list(body?.steps, 60)
  if (ingredients.length === 0 && steps.length === 0) return 'This recipe has no ingredients or steps yet.'
  const base = Number(body?.base_servings) > 0 ? Number(body.base_servings) : 2
  return {
    title: String(body?.title ?? 'this recipe').slice(0, 200),
    base_servings: base,
    usual_servings: Number(body?.usual_servings) > 0 ? Number(body.usual_servings) : base,
    ingredients,
    steps,
    note,
  }
}

export function buildPrompt(r: Request_) {
  const servingsRule =
    r.usual_servings === r.base_servings
      ? `The recipe is written for ${r.base_servings} servings.`
      : `The recipe is written for ${r.base_servings} servings, but the cooks usually make ${r.usual_servings}. If the note gives an amount without saying the servings, assume it is for ${r.usual_servings} servings and convert it to the recipe's ${r.base_servings}.`
  return [
    'Two people who cook together left a note on one of their recipes. Turn the note into changes to the recipe.',
    'Rules:',
    '- A note often asks for more than one thing. Make one change for each thing it asks for, and check that every part of the note is covered.',
    '- Change only what the note asks for or clearly implies. Leave everything else alone.',
    '- An ingredient the note says was used but is missing from the list is an "add". To add at the end of a list, use the number of the last item.',
    '- Advice about heat, timing, or technique ("pan was too hot", "cook longer") is a "change" to the step it applies to. Write the step so the next cook knows what to do, like "over medium heat".',
    '- Refer to ingredients and steps by their numbers below.',
    '- An ingredient line is written as amount, unit, ingredient, then preparation after a comma, like "1 tbsp soy sauce" or "2 cloves garlic, minced".',
    '- A changed step keeps its other wording. Update a step too when an ingredient change makes it wrong.',
    '- If the note is only an opinion or a memory with nothing to change ("so good", "made it for Mom"), return no changes and explain why in no_change_reason.',
    '- reason: for each change, a few plain words on what it does, like "Adds the avocado oil used to grease the pan".',
    '- summary: one short sentence covering all the changes, like "Halves the soy sauce and lowers the heat."',
    `- ${servingsRule}`,
    '',
    `Recipe: ${r.title}`,
    'Ingredients:',
    ...r.ingredients.map((line, i) => `${i + 1}. ${line}`),
    'Steps:',
    ...r.steps.map((step, i) => `${i + 1}. ${step}`),
    '',
    `Note: ${r.note}`,
  ].join('\n')
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    no_change_reason: { type: 'STRING', nullable: true },
    changes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          target: { type: 'STRING', enum: ['ingredient', 'step'] },
          action: { type: 'STRING', enum: ['change', 'add', 'remove'] },
          number: { type: 'INTEGER' },
          text: { type: 'STRING', nullable: true },
          reason: { type: 'STRING', nullable: true },
        },
        required: ['target', 'action', 'number', 'reason'],
      },
    },
  },
  required: ['summary', 'changes'],
}

// Keeps changes that point at real lines and carry text where needed.
// An add past the end goes at the end. Returns what was kept and how many
// suggestions were dropped, so the app can say so.
export function cleanChanges(raw: any, counts: { ingredient: number; step: number }): { changes: Change[]; skipped: number } {
  if (!Array.isArray(raw)) return { changes: [], skipped: 0 }
  const out: Change[] = []
  let skipped = 0
  for (const c of raw) {
    const target = c?.target
    const action = c?.action
    let number = Number(c?.number)
    const text = typeof c?.text === 'string' ? c.text.trim() : ''
    const reason = typeof c?.reason === 'string' && c.reason.trim() ? c.reason.trim() : null
    const known = (target === 'ingredient' || target === 'step') && ['change', 'add', 'remove'].includes(action)
    if (!known || !Number.isInteger(number) || (action !== 'remove' && !text)) {
      skipped++
      continue
    }
    const max = counts[target as 'ingredient' | 'step']
    if (action === 'add') {
      number = Math.min(Math.max(number, 0), max)
    } else if (number < 1 || number > max) {
      skipped++
      continue
    }
    out.push({ target, action, number, text: action === 'remove' ? null : text, reason })
  }
  return { changes: out, skipped }
}

async function askGemini(prompt: string, apiKey: string, models: string[]) {
  let overLimit = false
  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0 },
        }),
      },
    )
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
    error: 'Gemini is over the free limit right now. Try again in a minute, or edit the recipe yourself.',
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

  const req = readRequest(body)
  if (typeof req === 'string') return json({ error: req }, 400)

  try {
    const result = await askGemini(buildPrompt(req), apiKey, models.length ? models : DEFAULT_MODELS)
    if (result.status !== 200) return json({ error: result.error }, result.status)
    const parsed = result.parsed
    const { changes, skipped } = cleanChanges(parsed?.changes, { ingredient: req.ingredients.length, step: req.steps.length })
    return json({
      summary: String(parsed?.summary ?? '').trim(),
      skipped,
      no_change_reason: changes.length ? null : String(parsed?.no_change_reason ?? '').trim() || null,
      changes,
    })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
}

// Deno runs this as a server; tests import the helpers above in Node.
declare const Deno: any
if (typeof Deno !== 'undefined') Deno.serve(handle)
