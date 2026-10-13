import { db } from './db.js'
import { enqueue, syncNow } from './sync.js'
import { groupMeals } from './stats.js'
import { removeMealPhotos } from './photos.js'

// All writes go through here: save on this phone first, queue the change
// for Supabase, then try to send it. Works the same offline; the queue
// sends when the phone reconnects.

const now = () => new Date().toISOString()
export const newId = () => crypto.randomUUID()

function afterWrite() {
  // Fire and forget; sync status shows any problem.
  syncNow()
}

// Fields that exist in Supabase. Anything else on a local object (for
// example, joined data) is left out of what's sent.
const RECIPE_FIELDS = [
  'id', 'kitchen_id', 'title', 'base_servings', 'cuisine', 'meal_type', 'tags',
  'total_time_minutes', 'source_type', 'source_url', 'original_file',
  'created_by', 'created_at', 'updated_at', 'deleted_at', 'deleted_by', 'nutrition', 'source_name',
  'chef_tracks', 'prep_minutes', 'cook_minutes',
]
const INGREDIENT_FIELDS = [
  'id', 'recipe_id', 'position', 'quantity', 'unit', 'item', 'prep_note',
  'raw_text', 'needs_review', 'updated_at', 'section',
]
const STEP_FIELDS = ['id', 'recipe_id', 'position', 'text', 'track', 'updated_at']

function pick(obj, fields) {
  const out = {}
  for (const field of fields) if (obj[field] !== undefined) out[field] = obj[field]
  // Sent only when set, so recipes without sections keep syncing even
  // before the section column exists (migration 0012).
  if (out.section == null) delete out.section
  // Same for meals cooked in two-chef mode (migration 0014).
  if (!out.two_chef) delete out.two_chef
  return out
}

export async function loadRecipe(id) {
  const [recipe, ingredients, steps] = await Promise.all([
    db.recipes.get(id),
    db.ingredients.where('recipe_id').equals(id).sortBy('position'),
    db.steps.where('recipe_id').equals(id).sortBy('position'),
  ])
  return recipe ? { recipe, ingredients, steps } : null
}

// Create or update a recipe with its ingredients and steps. Earlier
// versions aren't kept.
// change (optional) is { note_id, summary } when the edit came from a note.
// Only that short record is saved (in the recipe_versions table, without a
// copy of the recipe), so the note can show what it changed and can't be
// used twice.
export async function saveRecipe({ recipe, ingredients, steps }, member, change = null) {
  const stamp = now()
  const isNew = !recipe.id || !(await db.recipes.get(recipe.id))
  const id = recipe.id ?? newId()

  const fullRecipe = pick(
    {
      tags: [],
      source_type: 'manual',
      created_by: member.user_id,
      created_at: stamp,
      ...recipe,
      id,
      kitchen_id: member.kitchen_id,
      updated_at: stamp,
    },
    RECIPE_FIELDS,
  )
  let fullIngredients = ingredients.map((ing, position) =>
    pick({ ...ing, id: ing.id ?? newId(), recipe_id: id, position, updated_at: stamp }, INGREDIENT_FIELDS),
  )
  let fullSteps = steps.map((step, position) =>
    pick({ ...step, id: step.id ?? newId(), recipe_id: id, position, updated_at: stamp }, STEP_FIELDS),
  )
  // Ratings ask to be redone when ingredients or steps change (by their
  // updated_at). A save that only changes details like the total time or
  // cuisine keeps the old times, so it doesn't count as a recipe change.
  if (!isNew) {
    const [oldIngredients, oldSteps] = await Promise.all([
      db.ingredients.where('recipe_id').equals(id).toArray(),
      db.steps.where('recipe_id').equals(id).toArray(),
    ])
    // Steps keep their two-chef track through an edit. New steps have
    // none, which tells two-chef mode the split needs redoing.
    const oldTrack = new Map(oldSteps.map((st) => [st.id, st.track]))
    fullSteps = fullSteps.map((st) => (st.track === undefined && oldTrack.get(st.id) ? { ...st, track: oldTrack.get(st.id) } : st))
    const same = (rows, oldRows, fields) => {
      if (rows.length !== oldRows.length) return false
      const byId = new Map(oldRows.map((r) => [r.id, r]))
      return rows.every((row) => {
        const old = byId.get(row.id)
        return old && fields.every((f) => f === 'updated_at' || (row[f] ?? null) === (old[f] ?? null))
      })
    }
    if (same(fullIngredients, oldIngredients, INGREDIENT_FIELDS) && same(fullSteps, oldSteps, STEP_FIELDS)) {
      const keep = (rows, oldRows) => {
        const byId = new Map(oldRows.map((r) => [r.id, r]))
        return rows.map((row) => ({ ...row, updated_at: byId.get(row.id).updated_at ?? row.updated_at }))
      }
      fullIngredients = keep(fullIngredients, oldIngredients)
      fullSteps = keep(fullSteps, oldSteps)
    }
  }

  const changeRecord = change
    ? { id: newId(), recipe_id: id, snapshot: { next_change: change }, created_by: member.user_id, created_at: stamp }
    : null
  let removedIngredientIds = []
  let removedStepIds = []

  await db.transaction('rw', [db.recipes, db.ingredients, db.steps, db.recipe_versions, db.outbox], async () => {
    if (changeRecord) await db.recipe_versions.put(changeRecord)
    if (!isNew) {
      const previous = await loadRecipe(id)

      const keepIngredients = new Set(fullIngredients.map((i) => i.id))
      const keepSteps = new Set(fullSteps.map((s) => s.id))
      removedIngredientIds = previous.ingredients.map((i) => i.id).filter((x) => !keepIngredients.has(x))
      removedStepIds = previous.steps.map((s) => s.id).filter((x) => !keepSteps.has(x))
      await db.ingredients.bulkDelete(removedIngredientIds)
      await db.steps.bulkDelete(removedStepIds)
    }

    await db.recipes.put(fullRecipe)
    await db.ingredients.bulkPut(fullIngredients)
    await db.steps.bulkPut(fullSteps)

    // Queue in dependency order: the recipe before its children.
    await enqueue('recipes', 'upsert', fullRecipe)
    if (changeRecord) await enqueue('recipe_versions', 'upsert', changeRecord)
    for (const removed of removedIngredientIds) await enqueue('ingredients', 'delete', { id: removed })
    for (const removed of removedStepIds) await enqueue('steps', 'delete', { id: removed })
    for (const ing of fullIngredients) await enqueue('ingredients', 'upsert', ing)
    for (const step of fullSteps) await enqueue('steps', 'upsert', step)
  })

  afterWrite()
  return id
}

// Deleting a note removes its replies and likes too (the database does
// the same on its side).
export async function deleteNote(noteId) {
  await db.transaction('rw', [db.notes, db.note_likes, db.outbox], async () => {
    const replies = await db.notes.filter((n) => n.parent_id === noteId).primaryKeys()
    await db.note_likes.where('note_id').anyOf([noteId, ...replies]).delete()
    await db.notes.bulkDelete([noteId, ...replies])
    await enqueue('notes', 'delete', { id: noteId })
  })
  afterWrite()
}

// Likes a note, or takes the like back. One like per cook per note.
export async function toggleLike(noteId, member) {
  await db.transaction('rw', [db.note_likes, db.outbox], async () => {
    const mine = await db.note_likes.where('note_id').equals(noteId).filter((l) => l.member_id === member.user_id).first()
    if (mine) {
      await db.note_likes.delete(mine.id)
      await enqueue('note_likes', 'delete', { id: mine.id })
    } else {
      const like = { id: newId(), note_id: noteId, member_id: member.user_id, created_at: now() }
      await db.note_likes.put(like)
      await enqueue('note_likes', 'insert', like)
    }
  })
  afterWrite()
}

// cookedOn marks a change made while cooking that day: it shows with
// that day's cook in the log, and can still become a recipe change.
// parentId makes it a reply to that note (one level: replies to a reply go
// to the note it answers).
export async function addNote(recipeId, body, member, cookedOn = null, parentId = null) {
  const note = {
    id: newId(),
    recipe_id: recipeId,
    author_id: member.user_id,
    body: body.trim(),
    created_at: now(),
    ...(cookedOn ? { cooked_on: cookedOn } : {}),
    ...(parentId ? { parent_id: parentId } : {}),
  }
  await db.transaction('rw', [db.notes, db.outbox], async () => {
    await db.notes.put(note)
    await enqueue('notes', 'insert', note)
  })
  afterWrite()
}

// Deleting moves the recipe to Recently Deleted for 30 days.
export async function deleteRecipe(recipeId, member) {
  await setDeleted(recipeId, { deleted_at: now(), deleted_by: member.user_id })
}

export async function restoreRecipe(recipeId) {
  await setDeleted(recipeId, { deleted_at: null, deleted_by: null })
}

// Deletes a recipe for good, with everything that belongs to it: its
// ingredients, steps, notes, cook log, ratings, and photos. The database
// removes the related rows with the recipe; photo files are removed from
// storage first so they don't linger. Can't be undone.
export async function deleteRecipeForever(recipeId) {
  const photos = await db.meal_photos.where('recipe_id').equals(recipeId).toArray()
  await removeMealPhotos(photos)
  const logIds = await db.cook_log.where('recipe_id').equals(recipeId).primaryKeys()
  const noteIds = await db.notes.where('recipe_id').equals(recipeId).primaryKeys()
  const tables = [db.recipes, db.ingredients, db.steps, db.notes, db.note_likes, db.recipe_versions, db.cook_log, db.ratings, db.outbox]
  await db.transaction('rw', tables, async () => {
    await db.ratings.where('cook_log_id').anyOf(logIds).delete()
    await db.note_likes.where('note_id').anyOf(noteIds).delete()
    for (const table of [db.ingredients, db.steps, db.notes, db.recipe_versions, db.cook_log]) {
      await table.where('recipe_id').equals(recipeId).delete()
    }
    await db.recipes.delete(recipeId)
    await enqueue('recipes', 'delete', { id: recipeId })
  })
  afterWrite()
}

// Saves a two-chef split: track names on the recipe and a track on each
// step (in step order). Step edit times stay as they were, so this
// doesn't count as a recipe change for ratings.
// extra: { timing: [{ minutes }], while_waiting: { a, b },
//   prep_steps: [{ text, track, minutes }] }. Prep steps are prep the
// ingredient list implies ("finely chopped") that no step asked for. They
// become real steps at the start, so they can be split and checked off.
// They take the recipe's last edit time, so adding them doesn't ask for
// ratings to be redone: the dish is the same.
export async function saveChefSplit(recipeId, names, tracks, extra = {}) {
  const prep = (Array.isArray(extra.prep_steps) ? extra.prep_steps : []).filter((p) => p?.text && (p.track === 'a' || p.track === 'b'))
  await db.transaction('rw', [db.recipes, db.steps, db.ingredients, db.outbox], async () => {
    const recipe = await db.recipes.get(recipeId)
    if (!recipe) return
    const steps = await db.steps.where('recipe_id').equals(recipeId).sortBy('position')
    const ingredients = await db.ingredients.where('recipe_id').equals(recipeId).toArray()
    const quiet = [...steps, ...ingredients].reduce((latest, row) => (row.updated_at > latest ? row.updated_at : latest), '') || now()
    const rows = [
      ...prep.map((p) => ({ id: newId(), recipe_id: recipeId, text: p.text, updated_at: quiet })),
      ...steps,
    ]
    const allTracks = [...prep.map((p) => p.track), ...tracks]
    const chefTracks = { a: names.a, b: names.b }
    if (Array.isArray(extra.timing)) chefTracks.timing = [...prep.map((p) => ({ minutes: p.minutes ?? null })), ...extra.timing]
    if (extra.while_waiting) chefTracks.while_waiting = extra.while_waiting
    const updated = pick({ ...recipe, chef_tracks: chefTracks }, RECIPE_FIELDS)
    await db.recipes.put(updated)
    await enqueue('recipes', 'upsert', updated)
    for (const [index, step] of rows.entries()) {
      const row = pick({ ...step, position: index, track: allTracks[index] ?? 'both' }, STEP_FIELDS)
      await db.steps.put(row)
      await enqueue('steps', 'upsert', row)
    }
  })
  afterWrite()
  return prep.length
}

export async function updateRecipeFields(recipeId, fields) {
  await setDeleted(recipeId, fields)
}

async function setDeleted(recipeId, fields) {
  await db.transaction('rw', [db.recipes, db.outbox], async () => {
    const recipe = await db.recipes.get(recipeId)
    if (!recipe) return
    const updated = pick({ ...recipe, ...fields, updated_at: now() }, RECIPE_FIELDS)
    await db.recipes.put(updated)
    await enqueue('recipes', 'upsert', updated)
  })
  afterWrite()
}

// ---------------------------------------------------------------------------
// The cook log and ratings
// ---------------------------------------------------------------------------

const LOG_FIELDS = ['id', 'recipe_id', 'cooked_on', 'created_by', 'created_at', 'servings', 'nutrition', 'two_chef']
const RATING_FIELDS = ['id', 'cook_log_id', 'member_id', 'stars', 'created_at']

async function putAndQueue(table, row, fields) {
  const clean = pick(row, fields)
  await db.transaction('rw', [db[table], db.outbox], async () => {
    await db[table].put(clean)
    await enqueue(table, 'upsert', clean)
  })
  afterWrite()
  return clean
}

// Today's date on this phone, as YYYY-MM-DD.
export function localDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Adds a meal to the cook log (a dated diary entry). If this recipe is
// already logged for that date (the other cook logged it on their
// phone), it's the same meal and nothing new is added.
// A rating, if given, is this cook's rating of the recipe.
// Returns { id, alreadyLogged }.
// twoChef: cooked in two-chef mode (for the two-chef badges).
export async function logMeal({ recipeId, cookedOn, stars = null, servings = null, twoChef = false }, member) {
  const day = cookedOn || localDate()
  const existing = await db.cook_log
    .where('recipe_id')
    .equals(recipeId)
    .filter((c) => c.cooked_on === day)
    .sortBy('created_at')
  let id = existing[0]?.id
  if (!id) {
    const entry = await putAndQueue(
      'cook_log',
      {
        id: newId(),
        recipe_id: recipeId,
        cooked_on: day,
        created_by: member.user_id,
        created_at: now(),
        ...(servings ? { servings: Number(servings) } : {}),
        ...(twoChef ? { two_chef: true } : {}),
      },
      LOG_FIELDS,
    )
    id = entry.id
  } else if ((servings && Number(existing[0].servings) !== Number(servings)) || (twoChef && !existing[0].two_chef)) {
    // Already logged (the other cook's phone): record how much was made,
    // and that it was a two-chef cook.
    await putAndQueue(
      'cook_log',
      { ...existing[0], ...(servings ? { servings: Number(servings) } : {}), ...(twoChef ? { two_chef: true } : {}) },
      LOG_FIELDS,
    )
  }
  if (stars) await rateRecipe(recipeId, stars, member)
  return { id, alreadyLogged: existing.length > 0 }
}

// Saves details of one meal (servings made, nutrition for it) on the
// meal's first log entry, where both phones read them.
export async function updateMeal(mealIds, fields) {
  const entries = (await db.cook_log.bulkGet(mealIds)).filter(Boolean)
  entries.sort((a, b) => (a.created_at ?? '').localeCompare(b.created_at ?? ''))
  if (!entries.length) return
  await putAndQueue('cook_log', { ...entries[0], ...fields }, LOG_FIELDS)
}

// Sets this cook's rating of a recipe. The rating stays until it's
// changed; it's stored with the most recent meal, and its time is when
// it was given (so the app can tell when the recipe changed since).
export async function rateRecipe(recipeId, stars, member) {
  const meals = groupMeals(await db.cook_log.where('recipe_id').equals(recipeId).toArray())
  if (meals.length === 0) throw new Error('Log a meal before rating.')
  const latest = meals[0]
  const mine = await db.ratings
    .where('cook_log_id')
    .anyOf(latest.ids)
    .filter((r) => r.member_id === member.user_id)
    .toArray()
  const targets = mine.length ? mine : [{ id: newId(), cook_log_id: latest.ids[0] }]
  const stamp = now()
  for (const rating of targets) {
    await putAndQueue(
      'ratings',
      { id: rating.id, cook_log_id: rating.cook_log_id, member_id: member.user_id, stars, created_at: stamp },
      RATING_FIELDS,
    )
  }
}

// Removes a meal from the diary. This cook's rating moves to the newest
// remaining meal so it isn't lost. (The other cook's rating can only be
// moved from their phone; the screen warns before that happens.)
export async function deleteMealLog(cookLogIds, member) {
  const ids = Array.isArray(cookLogIds) ? cookLogIds : [cookLogIds]
  const first = await db.cook_log.get(ids[0])
  const remaining = first
    ? groupMeals(await db.cook_log.where('recipe_id').equals(first.recipe_id).filter((c) => !ids.includes(c.id)).toArray())
    : []
  const ratingsHere = await db.ratings.where('cook_log_id').anyOf(ids).toArray()
  const mine = ratingsHere
    .filter((r) => r.member_id === member?.user_id)
    .sort((a, b) => (b.created_at ?? '').localeCompare(a.created_at ?? ''))[0]

  if (mine && remaining.length > 0) {
    const target = remaining[0]
    const already = await db.ratings
      .where('cook_log_id')
      .anyOf(target.ids)
      .filter((r) => r.member_id === member.user_id)
      .first()
    // Keep whichever rating is newer.
    if (!already || (already.created_at ?? '') < (mine.created_at ?? '')) {
      await putAndQueue(
        'ratings',
        { id: already?.id ?? newId(), cook_log_id: already?.cook_log_id ?? target.ids[0], member_id: member.user_id, stars: mine.stars, created_at: mine.created_at },
        RATING_FIELDS,
      )
    }
  }

  await db.transaction('rw', [db.cook_log, db.ratings, db.outbox], async () => {
    await db.ratings.bulkDelete(ratingsHere.map((r) => r.id))
    await db.cook_log.bulkDelete(ids)
    // Ratings go with the log entry on the server (on delete cascade).
    for (const id of ids) await enqueue('cook_log', 'delete', { id })
  })
  afterWrite()
}

