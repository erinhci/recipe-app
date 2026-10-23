import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { allowedKitchens, checkCaller } from './ask-step/index.ts'

// Each function is pasted into the Supabase editor as one file, so the
// access check is copied into all five. They must stay identical.
test('every Gemini function carries the same access check', () => {
  const dir = new URL('.', import.meta.url).pathname
  const blocks = readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => {
      const s = readFileSync(`${dir}${d.name}/index.ts`, 'utf8')
      const start = s.indexOf('// --- Who may spend the Gemini key')
      const end = s.indexOf('// --- end of the shared access block ---')
      assert.ok(start > 0 && end > start, `${d.name} is missing the access block`)
      assert.match(s, /const denied = await checkCaller\(request\)\n  if \(denied\) return denied/, `${d.name} doesn't call checkCaller`)
      return s.slice(start, end)
    })
  assert.equal(blocks.length, 5)
  assert.equal(new Set(blocks).size, 1)
})

const KITCHEN = '33333333-3333-4333-8333-333333333333'
function setup(env: Record<string, string>, { user = { id: 'u1' } as any, kitchens = [KITCHEN], authOk = true } = {}) {
  ;(globalThis as any).Deno = { env: { get: (k: string) => env[k] } }
  ;(globalThis as any).fetch = async (url: string) => {
    if (url.includes('/auth/v1/user')) return new Response(JSON.stringify(user), { status: authOk ? 200 : 401 })
    return new Response(JSON.stringify(kitchens.map((kitchen_id) => ({ kitchen_id }))), { status: 200 })
  }
}
const env = { SUPABASE_URL: 'https://x.supabase.co', SUPABASE_ANON_KEY: 'anon', AI_KITCHEN_IDS: ` ${KITCHEN.toUpperCase()} , other` }
const req = (token?: string) =>
  new Request('https://x.supabase.co/functions/v1/ask-step', { method: 'POST', headers: token ? { Authorization: `Bearer ${token}`, apikey: 'anon' } : { apikey: 'anon' } })

test('kitchen ids are read loosely: spaces and case don\'t matter', () => {
  assert.deepEqual([...allowedKitchens(' A, b ,,')], ['a', 'b'])
  assert.equal(allowedKitchens(undefined).size, 0)
})

test('callers without a real sign-in are turned away', async () => {
  setup(env)
  assert.equal((await checkCaller(req()))?.status, 401)
  assert.equal((await checkCaller(req('anon')))?.status, 401, 'the public anon key is not a sign-in')
  setup(env, { authOk: false })
  assert.equal((await checkCaller(req('expired')))?.status, 401)
})

test('only cooks in a listed kitchen get through', async () => {
  setup(env)
  assert.equal(await checkCaller(req('user-token')), null)
  setup(env, { kitchens: ['someone-elses-kitchen'] })
  const denied = await checkCaller(req('user-token'))
  assert.equal(denied?.status, 403)
  assert.equal((await denied!.json()).code, 'ai_not_enabled')
})

test('with AI_KITCHEN_IDS unset, nobody spends the key', async () => {
  setup({ ...env, AI_KITCHEN_IDS: '' })
  assert.equal((await checkCaller(req('user-token')))?.status, 403)
})
