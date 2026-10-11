import { db } from './db.js'
import { enqueue, syncNow } from './sync.js'

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
  'created_by', 'created_at', 'updated_at', 'deleted_at', 'deleted_by',
]
const INGREDIENT_FIELDS = [
  'id', 'recipe_id', 'position', 'quantity', 'unit', 'item', 'prep_note',
  'raw_text', 'needs_review', 'updated_at',
]
const STEP_FIELDS = ['id', 'recipe_id', 'position', 'text', 'updated_at']

function pick(obj, fields) {
  const out = {}
  for (const field of fields) if (obj[field] !== undefined) out[field] = obj[field]
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

// Create or update a recipe with its ingredients and steps.
// On update, the previous version is kept in recipe_versions.
export async function saveRecipe({ recipe, ingredients, steps }, member) {
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
  const fullIngredients = ingredients.map((ing, position) =>
    pick({ ...ing, id: ing.id ?? newId(), recipe_id: id, position, updated_at: stamp }, INGREDIENT_FIELDS),
  )
  const fullSteps = steps.map((step, position) =>
    pick({ ...step, id: step.id ?? newId(), recipe_id: id, position, updated_at: stamp }, STEP_FIELDS),
  )

  let version = null
  let removedIngredientIds = []
  let removedStepIds = []

  await db.transaction('rw', [db.recipes, db.ingredients, db.steps, db.recipe_versions, db.outbox], async () => {
    if (!isNew) {
      const previous = await loadRecipe(id)
      version = {
        id: newId(),
        recipe_id: id,
        snapshot: previous,
        created_by: member.user_id,
        created_at: stamp,
      }
      await db.recipe_versions.put(version)

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
    if (version) await enqueue('recipe_versions', 'upsert', version)
    for (const removed of removedIngredientIds) await enqueue('ingredients', 'delete', { id: removed })
    for (const removed of removedStepIds) await enqueue('steps', 'delete', { id: removed })
    for (const ing of fullIngredients) await enqueue('ingredients', 'upsert', ing)
    for (const step of fullSteps) await enqueue('steps', 'upsert', step)
  })

  afterWrite()
  return id
}

export async function addNote(recipeId, body, member) {
  const note = {
    id: newId(),
    recipe_id: recipeId,
    author_id: member.user_id,
    body: body.trim(),
    created_at: now(),
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
// Cooking sessions, the cook log, and ratings
// ---------------------------------------------------------------------------

const SESSION_FIELDS = ['id', 'recipe_id', 'started_by', 'started_at', 'ended_at']
const LOG_FIELDS = ['id', 'recipe_id', 'cooked_on', 'session_id', 'created_by', 'created_at']
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

// Starts timing a cook. Time from both phones counts once in stats.
export async function startCookingSession(recipeId, member) {
  const session = await putAndQueue(
    'cooking_sessions',
    { id: newId(), recipe_id: recipeId, started_by: member.user_id, started_at: now(), ended_at: null },
    SESSION_FIELDS,
  )
  return session.id
}

// Marks the session's end time. Called again if cooking resumes later
// (for example, the phone was locked), so the latest time wins.
export async function endCookingSession(sessionId) {
  const session = await db.cooking_sessions.get(sessionId)
  if (!session) return
  await putAndQueue('cooking_sessions', { ...session, ended_at: now() }, SESSION_FIELDS)
}

// Today's date on this phone, as YYYY-MM-DD.
export function localDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Adds a meal to the cook log, with this cook's rating if given. If this
// recipe is already logged for that date (the other cook logged it on
// their phone), it's the same meal: this cook's rating is added to it
// instead of making a second entry. Returns { id, alreadyLogged, loggedBy }.
export async function logMeal({ recipeId, cookedOn, sessionId = null, stars = null }, member) {
  const day = cookedOn || localDate()
  const existing = await db.cook_log
    .where('recipe_id')
    .equals(recipeId)
    .filter((c) => c.cooked_on === day)
    .sortBy('created_at')
  if (existing.length > 0) {
    if (stars) await rateMeal(existing.map((e) => e.id), stars, member)
    return { id: existing[0].id, alreadyLogged: true, loggedBy: existing[0].created_by }
  }

  const entry = await putAndQueue(
    'cook_log',
    {
      id: newId(),
      recipe_id: recipeId,
      cooked_on: day,
      session_id: sessionId,
      created_by: member.user_id,
      created_at: now(),
    },
    LOG_FIELDS,
  )
  if (stars) await rateMeal([entry.id], stars, member)
  return { id: entry.id, alreadyLogged: false }
}

// Each cook rates for themselves; rating again changes their rating.
// cookLogIds are the entries for one meal (usually one; two when both
// cooks logged it before their phones synced).
export async function rateMeal(cookLogIds, stars, member) {
  const ids = Array.isArray(cookLogIds) ? cookLogIds : [cookLogIds]
  const mine = await db.ratings
    .where('cook_log_id')
    .anyOf(ids)
    .filter((r) => r.member_id === member.user_id)
    .toArray()
  const targets = mine.length ? mine : [{ id: newId(), cook_log_id: ids[0], created_at: now() }]
  for (const rating of targets) {
    await putAndQueue(
      'ratings',
      { id: rating.id, cook_log_id: rating.cook_log_id, member_id: member.user_id, stars, created_at: rating.created_at ?? now() },
      RATING_FIELDS,
    )
  }
}

// Removes a meal: every entry logged for it, with their ratings.
export async function deleteMealLog(cookLogIds) {
  const ids = Array.isArray(cookLogIds) ? cookLogIds : [cookLogIds]
  const ratingIds = await db.ratings.where('cook_log_id').anyOf(ids).primaryKeys()
  await db.transaction('rw', [db.cook_log, db.ratings, db.outbox], async () => {
    await db.ratings.bulkDelete(ratingIds)
    await db.cook_log.bulkDelete(ids)
    // Ratings go with the log entry on the server (on delete cascade).
    for (const id of ids) await enqueue('cook_log', 'delete', { id })
  })
  afterWrite()
}

// Puts an earlier version back. The current version is kept as a version
// too (saveRecipe does that), so a restore can itself be undone.
export async function restoreVersion(versionId, member) {
  const version = await db.recipe_versions.get(versionId)
  const current = version && (await db.recipes.get(version.recipe_id))
  if (!version?.snapshot?.recipe || !current) throw new Error('That version is not on this phone.')
  const { recipe, ingredients = [], steps = [] } = version.snapshot
  const restoredFields = ['title', 'base_servings', 'cuisine', 'meal_type', 'tags', 'total_time_minutes', 'source_url']
  const merged = { ...current }
  for (const field of restoredFields) if (recipe[field] !== undefined) merged[field] = recipe[field]
  return saveRecipe({ recipe: merged, ingredients, steps }, member)
}
