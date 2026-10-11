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
