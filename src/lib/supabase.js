import { createClient } from '@supabase/supabase-js'

// import.meta.env is provided by Vite; it's missing when tests run in Node.
const env = import.meta.env ?? {}
const url = env.VITE_SUPABASE_URL
const anonKey = env.VITE_SUPABASE_ANON_KEY

// The anon key is safe to ship in the app: Row Level Security in the
// database limits every request to the signed-in person's own kitchen.
export const isConfigured = Boolean(url && anonKey)

export const supabase = isConfigured
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null
