// Tests the offline queue and sync against an in-memory fake of Supabase.
import 'fake-indexeddb/auto'
import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'

Object.defineProperty(globalThis.navigator, 'onLine', { value: true, writable: true, configurable: true })
const setOnline = (value) => {
  globalThis.navigator.onLine = value
}

const { db } = await import('./db.js')
const { setSyncClientForTests, syncNow } = await import('./sync.js')
const { saveRecipe, addNote, deleteRecipe, restoreRecipe, loadRecipe } = await import('./data.js')

// A tiny stand-in for the Supabase client: tables are Maps keyed by id.
function fakeServer() {
  const tables = new Map()
  const table = (name) => {
    if (!tables.has(name)) tables.set(name, new Map())
    return tables.get(name)
  }
  let failNext = null
  const client = {
    tables,
    table,
    failWith(error) {
      failNext = error
    },
    from(name) {
      return {
        upsert: async (row, options = {}) => {
          if (failNext) {
            const error = failNext
            failNext = null
            return { error }
          }
          if (options.ignoreDuplicates) {
            if (!table(name).has(row.id)) table(name).set(row.id, structuredClone(row))
          } else {
            // Like the real schema: notes allow inserts but not updates.
            if (name === 'notes') return { error: { code: '42501', message: 'permission denied for table notes' } }
            table(name).set(row.id, { ...table(name).get(row.id), ...structuredClone(row) })
          }
          return { error: null }
        },
        delete: () => ({
          eq: async (_col, id) => {
            table(name).delete(id)
            return { error: null }
          },
        }),
        select: async () => ({ data: [...table(name).values()].map((r) => structuredClone(r)), error: null }),
      }
    },
  }
  return client
}

const member = { user_id: 'user-a', kitchen_id: 'kitchen-1', display_name: 'Erin' }
let server

beforeEach(async () => {
  server = fakeServer()
  setSyncClientForTests(server)
  setOnline(true)
  await Promise.all(db.tables.map((t) => t.clear()))
})

const sample = {
  recipe: { title: 'Soup', base_servings: 4 },
  ingredients: [
    { quantity: 2, unit: 'cup', item: 'stock' },
    { quantity: 1, unit: null, item: 'onion' },
  ],
  steps: [{ text: 'Chop' }, { text: 'Simmer' }],
}

test('a recipe saved offline is kept locally and sent once online', async () => {
  setOnline(false)
  const id = await saveRecipe(structuredClone(sample), member)
  await syncNow()
  assert.ok(await db.recipes.get(id), 'saved on the phone')
  assert.equal(server.table('recipes').size, 0, 'nothing sent while offline')
  assert.ok((await db.outbox.count()) > 0, 'queued')

  setOnline(true)
  await syncNow()
  assert.equal(server.table('recipes').get(id).title, 'Soup')
  assert.equal(server.table('ingredients').size, 2)
  assert.equal(server.table('steps').size, 2)
  assert.equal(await db.outbox.count(), 0, 'queue emptied')
})

test('editing keeps the previous version and removes deleted ingredients', async () => {
  const id = await saveRecipe(structuredClone(sample), member)
  await syncNow()
  const saved = await loadRecipe(id)

  await saveRecipe(
    {
      recipe: { ...saved.recipe, title: 'Better soup' },
      ingredients: [saved.ingredients[0]],
      steps: saved.steps,
    },
    member,
  )
  await syncNow()

  assert.equal(server.table('recipes').get(id).title, 'Better soup')
  assert.equal(server.table('ingredients').size, 1, 'onion removed on the server')
  assert.equal(await db.ingredients.count(), 1, 'onion removed on the phone')
  assert.equal(server.table('recipe_versions').size, 0, 'earlier versions are not kept')
})

test('a change from a note keeps only a short record of which note it was', async () => {
  const id = await saveRecipe(structuredClone(sample), member)
  const saved = await loadRecipe(id)
  await saveRecipe({ ...saved, recipe: { ...saved.recipe, title: 'Less salty soup' } }, member, { note_id: 'note-1', summary: 'Halves the salt.' })
  await syncNow()
  const records = [...server.table('recipe_versions').values()]
  assert.equal(records.length, 1)
  assert.deepEqual(records[0].snapshot, { next_change: { note_id: 'note-1', summary: 'Halves the salt.' } })
})

test("the other phone's changes arrive on the next pull", async () => {
  const id = await saveRecipe(structuredClone(sample), member)
  await syncNow()
  server.table('notes').set('note-b', {
    id: 'note-b', recipe_id: id, author_id: 'user-b', body: 'Too salty', created_at: new Date().toISOString(),
  })
  await syncNow()
  assert.equal((await db.notes.get('note-b')).body, 'Too salty')
})

test('rows removed on the server disappear from the phone', async () => {
  const id = await saveRecipe(structuredClone(sample), member)
  await syncNow()
  // e.g. the daily job emptied Recently Deleted
  server.table('recipes').delete(id)
  await syncNow()
  assert.equal(await db.recipes.get(id), undefined)
})

test('an unsent change survives a pull', async () => {
  const id = await saveRecipe(structuredClone(sample), member)
  await syncNow()
  // The next send fails like a dropped connection (no error code).
  server.failWith({ message: 'Failed to fetch' })
  await addNote(id, 'Add lime', member)
  await syncNow()
  assert.equal((await db.notes.toArray()).length, 1, 'note still on the phone')
  assert.equal(await db.outbox.count(), 1, 'still queued')
  await syncNow()
  assert.equal(server.table('notes').size, 1, 'sent on retry')
  assert.equal(await db.outbox.count(), 0)
})

test('delete moves to Recently Deleted and restore brings it back', async () => {
  const id = await saveRecipe(structuredClone(sample), member)
  await deleteRecipe(id, member)
  await syncNow()
  assert.ok(server.table('recipes').get(id).deleted_at)
  assert.equal(server.table('recipes').get(id).deleted_by, 'user-a')
  await restoreRecipe(id)
  await syncNow()
  assert.equal(server.table('recipes').get(id).deleted_at, null)
})

test('notes are sent as inserts, which the database allows', async () => {
  const id = await saveRecipe(structuredClone(sample), member)
  await addNote(id, 'Halve the salt', member)
  await syncNow()
  assert.equal(server.table('notes').size, 1)
  assert.equal([...server.table('notes').values()][0].body, 'Halve the salt')
})
