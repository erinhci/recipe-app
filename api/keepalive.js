// Called once a day by Vercel's cron (see vercel.json).
// Touches the database so the free Supabase project never pauses, and
// empties Recently Deleted of anything older than 30 days.
export default async function handler(request, response) {
  // When CRON_SECRET is set in Vercel, its cron sends it as a bearer token.
  // Reject anyone else so the route can't be triggered from outside.
  const secret = process.env.CRON_SECRET
  if (secret && request.headers.authorization !== `Bearer ${secret}`) {
    return response.status(401).json({ ok: false })
  }

  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    return response.status(500).json({ ok: false, error: 'Supabase settings missing' })
  }

  const result = await fetch(`${url}/rest/v1/rpc/keepalive`, {
    method: 'POST',
    // Only the apikey header: it accepts both Supabase's newer publishable
    // keys (sb_publishable_…) and legacy anon keys. Publishable keys aren't
    // JWTs, so they must not be sent as a Bearer token.
    headers: { apikey: key, 'Content-Type': 'application/json' },
    body: '{}',
  })

  if (!result.ok) {
    return response.status(502).json({ ok: false, status: result.status })
  }
  return response.status(200).json({ ok: true, at: new Date().toISOString() })
}
