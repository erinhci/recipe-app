import { supabase } from './supabase.js'

// Calls one of the Supabase Edge Functions. Returns { ok: true, data } or
// { ok: false, status, message } with a message a cook can act on.
export async function invokeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body })
  if (!error) return { ok: true, data }

  const status = error.context?.status ?? 0
  let message = "Couldn’t reach the server. Check the connection and try again."
  if (status === 404) {
    message = `This feature isn’t set up yet. Deploy the ${name} function in Supabase.`
  } else if (error.context && typeof error.context.json === 'function') {
    try {
      const payload = await error.context.json()
      if (payload?.error) message = payload.error
    } catch {
      // Not JSON; keep the general message.
    }
  }
  return { ok: false, status, message }
}
