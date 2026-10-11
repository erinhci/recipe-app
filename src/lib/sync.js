import { useSyncExternalStore } from 'react'
import { db } from './db.js'
import { supabase } from './supabase.js'

// Tests swap in a fake server; the app always uses Supabase.
let client = supabase
export function setSyncClientForTests(fake) {
  client = fake
}

// Sync between this phone's IndexedDB and Supabase.
//
// Every change is saved locally first and queued in the outbox. When the
// phone is online, the outbox is sent in order, then the whole kitchen is
// pulled back down. A couple's library is small (hundreds of rows), so a
// full pull is simpler and more reliable than tracking deltas.
//
// The other phone's changes arrive through Supabase Realtime, which
// triggers the same pull. If both phones edit the same recipe while
// offline, whichever change reaches Supabase last wins.

export const SYNCED_TABLES = [
  'members',
  'recipes',
  'ingredients',
  'steps',
  'recipe_versions',
  'notes',
  'cooking_sessions',
  'cook_log',
  'ratings',
]

// ---------------------------------------------------------------------------
// Status, readable from React with useSyncStatus()
// ---------------------------------------------------------------------------

let status = { state: 'idle', error: null, lastSyncedAt: null }
const listeners = new Set()

function setStatus(patch) {
  status = { ...status, ...patch }
  listeners.forEach((listener) => listener())
}

export function useSyncStatus() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => status,
  )
}

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

export async function enqueue(table, op, payload) {
  await db.outbox.add({ table, op, payload, created_at: new Date().toISOString() })
}

function isNetworkError(error) {
  // PostgREST errors carry a code; network failures don't.
  return !error?.code
}

async function pushOutbox() {
  const entries = await db.outbox.orderBy('seq').toArray()
  for (const entry of entries) {
    const query = client.from(entry.table)
    // 'insert' is for insert-only tables such as notes: the database allows
    // adding rows there but not changing them, so a resend after a dropped
    // connection skips rows that already arrived instead of updating them.
    const { error } =
      entry.op === 'delete'
        ? await query.delete().eq('id', entry.payload.id)
        : entry.op === 'insert'
          ? await query.upsert(entry.payload, { ignoreDuplicates: true })
          : await query.upsert(entry.payload)
    if (error) {
      if (isNetworkError(error)) throw error
      // The server refused this change (for example, a recipe deleted on
      // the other phone). Drop it so it doesn't block everything after it,
      // and show the reason.
      console.error('Sync change refused', entry, error)
      setStatus({ error: `A change couldn't be saved: ${error.message}` })
    }
    await db.outbox.delete(entry.seq)
  }
}

// ---------------------------------------------------------------------------
// Pull
// ---------------------------------------------------------------------------

async function pullAll() {
  const results = await Promise.all(
    SYNCED_TABLES.map(async (table) => {
      const { data, error } = await client.from(table).select('*')
      if (error) throw error
      return [table, data]
    }),
  )
  const pendingIds = new Set((await db.outbox.toArray()).map((entry) => entry.payload.id))

  await db.transaction('rw', SYNCED_TABLES.map((t) => db.table(t)), async () => {
    for (const [table, rows] of results) {
      const local = db.table(table)
      const serverIds = new Set(rows.map((row) => row.id))
      // Remove rows the server no longer has, unless this phone has an
      // unsent change for them.
      const stale = (await local.toCollection().primaryKeys()).filter(
        (id) => !serverIds.has(id) && !pendingIds.has(id),
      )
      if (stale.length) await local.bulkDelete(stale)
      // Keep this phone's unsent edits instead of the older server copy.
      await local.bulkPut(rows.filter((row) => !pendingIds.has(row.id)))
    }
  })
}

// ---------------------------------------------------------------------------
// Running a sync
// ---------------------------------------------------------------------------

let running = null
let again = false

export function syncNow() {
  if (!navigator.onLine) {
    setStatus({ state: 'offline' })
    return Promise.resolve()
  }
  if (running) {
    // A sync is already going; run once more after it finishes.
    again = true
    return running
  }
  running = (async () => {
    do {
      again = false
      setStatus({ state: 'syncing' })
      try {
        await pushOutbox()
        await pullAll()
        setStatus({ state: 'idle', lastSyncedAt: new Date().toISOString() })
      } catch (error) {
        console.error('Sync failed', error)
        setStatus({ state: navigator.onLine ? 'error' : 'offline', error: error.message ?? String(error) })
        again = false
      }
    } while (again)
    running = null
  })()
  return running
}

let pullTimer = null
function schedulePull() {
  clearTimeout(pullTimer)
  pullTimer = setTimeout(syncNow, 400)
}

// Start syncing for the signed-in cook's kitchen. Returns a stop function.
export function startSync() {
  const onOnline = () => syncNow()
  const onOffline = () => setStatus({ state: 'offline' })
  const onVisible = () => {
    if (document.visibilityState === 'visible') syncNow()
  }
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onVisible)

  const channel = supabase.channel('kitchen-changes')
  for (const table of SYNCED_TABLES) {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, schedulePull)
  }
  channel.subscribe()

  syncNow()

  return () => {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    document.removeEventListener('visibilitychange', onVisible)
    supabase.removeChannel(channel)
    clearTimeout(pullTimer)
  }
}
