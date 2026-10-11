// Supabase Edge Function: ask-step
//
// Answers a typed question about one step while cooking ("what does
// 'fold' mean?", "how do I know the chicken is done?"). The answer is
// about this recipe at the servings shown on screen.
//
// The Gemini key is read from the GEMINI_API_KEY secret and never leaves
// the server. Only signed-in users can call this function (JWT
// verification stays on when it's deployed).
//
// Request body (JSON):
//   { title, servings, base_servings, ingredients: string[], steps: string[],
//     step_number, question }
// Response: { answer }

// Flash-Lite first: quick answers matter more than depth while cooking.
const DEFAULT_MODELS = ['gemini-3.5-flash-lite', 'gemini-3.8-flash']
const MAX_QUESTION = 500

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

type Question = {
  title: string
  servings: number
  base_servings: number
  ingredients: string[]
  steps: string[]
  step_number: number
  question: string
}

export function readQuestion(body: any): Question | string {
  const question = String(body?.question ?? '').trim()
  if (!question) return 'Type a question first.'
  if (question.length > MAX_QUESTION) return 'That question is too long. Try a shorter one.'
  const steps = Array.isArray(body?.steps) ? body.steps.map((s: unknown) => String(s)).slice(0, 60) : []
  if (steps.length === 0) return 'This recipe has no steps to ask about.'
  const stepNumber = Number(body?.step_number)
  if (!Number.isInteger(stepNumber) || stepNumber < 1 || stepNumber > steps.length) return 'That step does not exist.'
  return {
    title: String(body?.title ?? 'this recipe').slice(0, 200),
    servings: Number(body?.servings) || 2,
    base_servings: Number(body?.base_servings) || Number(body?.servings) || 2,
    ingredients: Array.isArray(body?.ingredients) ? body.ingredients.map((s: unknown) => String(s)).slice(0, 80) : [],
    steps,
    step_number: stepNumber,
    question,
  }
}

export function buildPrompt(q: Question) {
  const scaled =
    q.servings === q.base_servings
      ? `The cooks are making it as written (${q.servings} servings).`
      : `The recipe was written for ${q.base_servings} servings; the cooks are making ${q.servings}. The ingredient amounts below are already scaled.`
  return [
    'You help two people cooking together at home. Answer their question about the step they are on.',
    'Rules:',
    '- Answer for this recipe and step, in 2 or 3 short sentences of plain text. No lists, headings, or markdown.',
    '- Use the amounts listed below, not the original ones.',
    '- If the question is about whether meat, poultry, fish, or eggs are cooked safely, give the standard safe internal temperature in both °F and °C.',
    '- If you are not sure, or the answer depends on something you cannot see, say so and say what to check.',
    '- If the question is not about cooking, say you can only help with the recipe.',
    '',
    `Recipe: ${q.title}`,
    scaled,
    'Ingredients:',
    ...q.ingredients.map((line) => `- ${line}`),
    'Steps:',
    ...q.steps.map((step, i) => `${i + 1}. ${step}`),
    '',
    `They are on step ${q.step_number}: ${q.steps[q.step_number - 1]}`,
    `Their question: ${q.question}`,
  ].join('\n')
}

const FUNCTION_NAME = 'ask-step'

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
    const response = await callGemini(model, apiKey, [{ role: 'user', parts: [{ text: prompt }] }], { temperature: 0.2, maxOutputTokens: 1024 })
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
    const text = result?.candidates?.[0]?.content?.parts?.map((p: any) => p.text ?? '').join('').trim()
    if (!text) return { status: 502, error: 'Gemini returned no answer. Try asking another way.' }
    return { status: 200, answer: text }
  }
  return {
    status: overLimit ? 429 : 503,
    error: 'Questions are over the free limit right now. Try again in a minute.',
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

  const question = readQuestion(body)
  if (typeof question === 'string') return json({ error: question }, 400)

  try {
    const result = await askGemini(buildPrompt(question), apiKey, models.length ? models : DEFAULT_MODELS)
    if (result.status !== 200) return json({ error: result.error }, result.status)
    return json({ answer: result.answer })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : String(error) }, 500)
  }
}

// Deno runs this as a server; tests import the helpers above in Node.
declare const Deno: any
if (typeof Deno !== 'undefined') Deno.serve(handle)
