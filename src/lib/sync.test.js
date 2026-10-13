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
const { saveRecipe, addNote, deleteRecipe, restoreRecipe, loadRecipe, toggleLike, deleteNote } = await import('./data.js')
const { saveMyMember, saveKitchen } = await import('./avatars.js')

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
          if (client.missingColumn && row[client.missingColumn.column] !== undefined && name === client.missingColumn.table) {
            return { error: { code: 'PGRST204', message: `Could not find the '${client.missingColumn.column}' column` } }
          }
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
        // Changes an existing row only, like an update with no insert rights.
        update: (fields) => ({
          eq: async (_col, id) => {
            if (table(name).has(id)) table(name).set(id, { ...table(name).get(id), ...structuredClone(fields) })
            return { error: null }
          },
        }),
        delete: () => ({
          eq: async (_col, id) => {
            table(name).delete(id)
            // Like the schema's "on delete cascade" from recipes.
            if (name === 'recipes') {
              for (const rows of tables.values()) for (const [key, row] of rows) if (row.recipe_id === id) rows.delete(key)
            }
            return { error: null }
          },
        }),
        select: async () =>
          client.missingTables?.includes(name)
            ? { data: null, error: { code: 'PGRST205', message: `Could not find the table 'public.${name}' in the schema cache` } }
            : { data: [...table(name).values()].map((r) => structuredClone(r)), error: null },
      }
    },
    // Storage: files by path. refuseUploads mimics the bucket's size limit.
    files: new Map(),
    refuseUploads: false,
    storage: {
      from: () => ({
        upload: async (path, blob) => {
          if (client.noBucket) return { error: { message: 'Bucket not found', statusCode: '404' } }
          if (client.refuseUploads) return { error: { message: 'The object exceeded the maximum allowed size', statusCode: '413' } }
          if (client.files.has(path)) return { error: { message: 'The resource already exists', statusCode: '409' } }
          client.files.set(path, blob)
          return { error: null }
        },
        remove: async (paths) => {
          for (const path of paths) client.files.delete(path)
          return { data: [], error: null }
        },
      }),
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

// Photos of finished dishes
const { saveMealPhoto, removeMealPhotos } = await import('./photos.js')
const brianMember = { user_id: 'user-b', kitchen_id: 'kitchen-1', display_name: 'Brian' }
const jpeg = (size = 1000) => new Blob([new Uint8Array(size)], { type: 'image/jpeg' })

test('a photo uploads to the kitchen folder before its record', async () => {
  setOnline(false)
  const photo = await saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-11', blob: jpeg() }, member)
  assert.equal(photo.path, `kitchen-1/r1/${photo.id}.jpg`)
  assert.equal(server.files.size, 0)
  setOnline(true)
  await syncNow()
  assert.ok(server.files.has(photo.path))
  assert.equal(server.table('meal_photos').get(photo.id).added_by, 'user-a')
})

test('a cook can add several photos of one meal', async () => {
  setOnline(false)
  const first = await saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-11', blob: jpeg() }, member)
  await saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-11', blob: jpeg() }, brianMember)
  const second = await saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-11', blob: jpeg() }, member)
  setOnline(true)
  await syncNow()
  assert.equal(server.table('meal_photos').size, 3)
  assert.ok(server.files.has(first.path))
  assert.ok(server.files.has(second.path))
})

test('replacing a photo swaps it out and keeps its meal', async () => {
  const first = await saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-11', blob: jpeg() }, member)
  await syncNow()
  const second = await saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-11', blob: jpeg(), replacing: first }, member)
  await syncNow()
  assert.equal(server.table('meal_photos').size, 1)
  assert.ok(!server.files.has(first.path))
  assert.ok(server.files.has(second.path))
  assert.equal(await db.photo_files.count(), 1)
})

test('each cook can add 3 photos to a recipe', async () => {
  const { PHOTOS_PER_COOK } = await import('./photos.js')
  setOnline(false)
  for (let i = 0; i < PHOTOS_PER_COOK; i++) await saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-11', blob: jpeg() }, member)
  await assert.rejects(saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-12', blob: jpeg() }, member), /3 photos/)
  // The other cook still has their own 3.
  await saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-11', blob: jpeg() }, brianMember)
  // Replacing doesn't need a free slot.
  const [mine] = await db.meal_photos.where('recipe_id').equals('r1').filter((p) => p.added_by === member.user_id).toArray()
  await saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-11', blob: jpeg(), replacing: mine }, member)
})

test('a photo removed before it was sent never reaches the server', async () => {
  setOnline(false)
  const photo = await saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-11', blob: jpeg() }, member)
  await removeMealPhotos([photo])
  setOnline(true)
  await syncNow()
  assert.equal(server.table('meal_photos').size, 0)
  assert.equal(server.files.size, 0)
  assert.equal(await db.outbox.count(), 0)
})

test('a photo the server refuses is removed from this phone', async () => {
  server.refuseUploads = true
  await saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-11', blob: jpeg() }, member)
  await syncNow()
  assert.equal(await db.meal_photos.count(), 0)
  assert.equal(await db.photo_files.count(), 0)
  assert.equal(server.table('meal_photos').size, 0)
})

test('a photo removed on the other phone drops its saved image here', async () => {
  const photo = await saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-11', blob: jpeg() }, member)
  await syncNow()
  server.table('meal_photos').delete(photo.id)
  await syncNow()
  assert.equal(await db.meal_photos.count(), 0)
  assert.equal(await db.photo_files.count(), 0)
})

test('before the photos migration, a photo waits on this phone without blocking other changes', async () => {
  server.noBucket = true
  server.missingTables = ['meal_photos']
  const photo = await saveMealPhoto({ recipeId: 'r1', cookedOn: '2026-10-11', blob: jpeg() }, member)
  await addNote('r1', 'More salt', member)
  await syncNow()
  assert.equal(server.table('notes').size, 1)
  assert.equal(await db.meal_photos.count(), 1)
  server.noBucket = false
  server.missingTables = []
  await syncNow()
  assert.ok(server.files.has(photo.path))
  assert.equal(server.table('meal_photos').size, 1)
})

test('deleting forever removes the recipe, its rows, and its photo files', async () => {
  const { deleteRecipeForever, logMeal } = await import('./data.js')
  const id = await saveRecipe(structuredClone(sample), member)
  await addNote(id, 'Less salt', member)
  await logMeal({ recipeId: id, cookedOn: '2026-10-11' }, member)
  const photo = await saveMealPhoto({ recipeId: id, cookedOn: '2026-10-11', blob: jpeg() }, member)
  await syncNow()
  assert.ok(server.files.has(photo.path))
  await deleteRecipeForever(id)
  await syncNow()
  assert.equal(server.table('recipes').has(id), false)
  assert.equal(server.files.size, 0)
  assert.equal(await db.recipes.count(), 0)
  assert.equal(await db.steps.count(), 0)
  assert.equal(await db.notes.count(), 0)
  assert.equal(await db.cook_log.count(), 0)
  assert.equal(await db.meal_photos.count(), 0)
})

test('a change for a column the database lacks waits for the migration instead of being dropped', async () => {
  const { logMeal } = await import('./data.js')
  const id = await saveRecipe(structuredClone(sample), member)
  await syncNow()
  server.missingColumn = { table: 'cook_log', column: 'servings' }
  await logMeal({ recipeId: id, cookedOn: '2026-10-11', servings: 2 }, member)
  await syncNow()
  assert.equal(server.table('cook_log').size, 0)
  assert.equal(await db.cook_log.count(), 1)
  assert.equal(await db.outbox.count(), 1)
  server.missingColumn = null
  await syncNow()
  assert.equal(server.table('cook_log').size, 1)
  assert.equal([...server.table('cook_log').values()][0].servings, 2)
})

test('a color, avatar and scene change update their rows without adding any', async () => {
  server.table('members').set('m1', { id: 'm1', user_id: 'user-a', kitchen_id: 'kitchen-1', display_name: 'Erin' })
  server.table('kitchens').set('kitchen-1', { id: 'kitchen-1', name: 'Our Kitchen', scene: 'home' })
  await syncNow()
  await saveMyMember('user-a', { color: 'green', avatar: { hat: 'chef' } })
  await saveKitchen('kitchen-1', { scene: 'market' })
  await syncNow()
  assert.equal(server.table('members').get('m1').color, 'green')
  assert.deepEqual(server.table('members').get('m1').avatar, { hat: 'chef' })
  assert.equal(server.table('members').get('m1').display_name, 'Erin', 'other fields untouched')
  assert.equal(server.table('kitchens').get('kitchen-1').scene, 'market')
  assert.equal(server.table('kitchens').size, 1)
})

test('likes toggle, and replies go with the note they answer', async () => {
  const id = await saveRecipe(structuredClone(sample), member)
  await addNote(id, 'Needs salt', member)
  await syncNow()
  const note = (await db.notes.toArray())[0]
  await addNote(id, 'Agreed', member, null, note.id)
  await toggleLike(note.id, member)
  await syncNow()
  assert.equal(server.table('note_likes').size, 1)
  assert.equal([...server.table('notes').values()].find((n) => n.body === 'Agreed').parent_id, note.id)
  await toggleLike(note.id, member)
  await syncNow()
  assert.equal(server.table('note_likes').size, 0, 'liking again takes it back')
  await toggleLike(note.id, member)
  await deleteNote(note.id)
  assert.equal(await db.notes.count(), 0, 'the reply goes too')
  assert.equal(await db.note_likes.count(), 0, 'and the likes')
})
