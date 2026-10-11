import Dexie from 'dexie'

// Local copy of the kitchen on this phone. The app reads and writes here
// first; the sync engine copies changes to and from Supabase when online.
// Table names mirror the Supabase tables (see supabase/migrations).
export const db = new Dexie('our-kitchen')

db.version(1).stores({
  recipes: 'id, kitchen_id, updated_at, deleted_at, cuisine',
  ingredients: 'id, recipe_id, [recipe_id+position], item',
  steps: 'id, recipe_id, [recipe_id+position]',
  notes: 'id, recipe_id, created_at',
  recipe_versions: 'id, recipe_id, created_at',
  cooking_sessions: 'id, recipe_id, started_at',
  cook_log: 'id, recipe_id, cooked_on',
  ratings: 'id, cook_log_id, member_id',
  members: 'user_id, kitchen_id',
  // Changes waiting to be sent to Supabase, oldest first.
  outbox: '++seq, table, created_at',
  // Small key/value store: last sync time, current kitchen, etc.
  meta: 'key',
})

// Memberships gained their own id (a cook can leave and rejoin).
db.version(2).stores({
  members: null,
})
db.version(3).stores({
  members: 'id, user_id, kitchen_id',
})

export async function getMeta(key) {
  const row = await db.meta.get(key)
  return row?.value
}

export async function setMeta(key, value) {
  await db.meta.put({ key, value })
}

// Remove every kitchen table's local copy, e.g. after signing out or being
// removed from a kitchen. Keeps nothing that belonged to the old kitchen.
export async function clearLocalKitchen() {
  await db.transaction('rw', db.tables, async () => {
    await Promise.all(db.tables.map((table) => table.clear()))
  })
}
