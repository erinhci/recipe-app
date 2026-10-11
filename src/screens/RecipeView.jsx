import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { addNote, deleteRecipe } from '../lib/data'
import { displayIngredient, scaleFactor } from '../lib/units'
import { DEFAULT_SERVINGS } from '../lib/constants'
import { originalLinks } from '../lib/importRecipe'
import { useOnline } from '../lib/useOnline'

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export default function RecipeView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member } = useAuth()

  const data = useLiveQuery(async () => {
    const recipe = await db.recipes.get(id)
    if (!recipe) return { recipe: null }
    const [ingredients, steps, notes, members] = await Promise.all([
      db.ingredients.where('recipe_id').equals(id).sortBy('position'),
      db.steps.where('recipe_id').equals(id).sortBy('position'),
      db.notes.where('recipe_id').equals(id).reverse().sortBy('created_at'),
      db.members.toArray(),
    ])
    return { recipe, ingredients, steps, notes, members }
  }, [id])

  const [servings, setServings] = useState(DEFAULT_SERVINGS)
  const [showOriginal, setShowOriginal] = useState(false)
  const [system, setSystem] = useState(member.unit_pref ?? 'us')
  const [noteText, setNoteText] = useState('')
  const [originals, setOriginals] = useState(null) // null = not loaded
  const online = useOnline()

  if (data === undefined) {
    return (
      <Page title="Recipe">
        <p role="status">Loading…</p>
      </Page>
    )
  }

  if (!data.recipe || data.recipe.deleted_at) {
    return (
      <Page title="Recipe not found">
        <p>This recipe was deleted or isn't on this phone yet.</p>
        <Link className="btn" to="/">
          Back to Library
        </Link>
      </Page>
    )
  }

  const { recipe, ingredients, steps, notes, members } = data
  const shownServings = showOriginal ? recipe.base_servings : servings
  const factor = scaleFactor(recipe.base_servings, shownServings)
  const nameFor = (userId) => members.find((m) => m.user_id === userId)?.display_name ?? 'A former cook'

  async function handleDelete() {
    if (!window.confirm(`Delete "${recipe.title}"? It stays in Recently Deleted in Settings for 30 days.`)) return
    await deleteRecipe(recipe.id, member)
    navigate('/', { replace: true })
  }

  async function handleAddNote(event) {
    event.preventDefault()
    if (!noteText.trim()) return
    await addNote(recipe.id, noteText, member)
    setNoteText('')
  }

  return (
    <Page title={recipe.title}>
      {(recipe.cuisine || recipe.meal_type) && (
        <p className="hint">{[recipe.cuisine, recipe.meal_type].filter(Boolean).join(' · ')}</p>
      )}

      <section className="card" aria-labelledby="servings-heading">
        <h2 id="servings-heading" className="sr-only">
          Servings and units
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setServings((s) => Math.max(1, s - 1))}
            disabled={showOriginal || servings <= 1}
            aria-label="One fewer serving"
          >
            −
          </button>
          <p style={{ margin: 0, fontWeight: 600 }} aria-live="polite">
            {shownServings} {Number(shownServings) === 1 ? 'serving' : 'servings'}
          </p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setServings((s) => s + 1)}
            disabled={showOriginal}
            aria-label="One more serving"
          >
            +
          </button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 'var(--target)' }}>
          <input
            type="checkbox"
            checked={showOriginal}
            onChange={(e) => setShowOriginal(e.target.checked)}
            style={{ width: 22, height: 22 }}
          />
          Show original (serves {recipe.base_servings})
        </label>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', gap: 'var(--space-4)' }}>
          <legend className="sr-only">Units</legend>
          {[
            ['us', 'US'],
            ['metric', 'Metric'],
          ].map(([value, label]) => (
            <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 'var(--target)' }}>
              <input
                type="radio"
                name="units"
                value={value}
                checked={system === value}
                onChange={() => setSystem(value)}
                style={{ width: 22, height: 22 }}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </section>

      <section aria-labelledby="ingredients-heading">
        <h2 id="ingredients-heading">Ingredients</h2>
        <ul style={{ paddingLeft: 'var(--space-4)' }}>
          {ingredients.map((ing) => {
            const shown = displayIngredient(ing, factor, system)
            return (
              <li key={ing.id} style={{ marginBottom: 'var(--space-2)' }}>
                {shown.text && <strong>{shown.text} </strong>}
                {ing.item}
                {ing.prep_note ? `, ${ing.prep_note}` : ''}
                {shown.note && <div className="hint">{shown.note}</div>}
              </li>
            )
          })}
        </ul>
      </section>

      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading">Steps</h2>
        {steps.length === 0 ? (
          <p className="hint">No steps yet.</p>
        ) : (
          <ol style={{ paddingLeft: 'var(--space-6)' }}>
            {steps.map((step) => (
              <li key={step.id} style={{ marginBottom: 'var(--space-3)' }}>
                {step.text}
              </li>
            ))}
          </ol>
        )}
        {factor !== 1 && (
          <p className="hint">
            Times and pan sizes don't scale with amounts. For baked dishes, a smaller pan may be needed.
          </p>
        )}
      </section>

      <section aria-labelledby="notes-heading">
        <h2 id="notes-heading">Notes</h2>
        <form onSubmit={handleAddNote} className="field">
          <label htmlFor="note">Add a note</label>
          <textarea id="note" rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          <button className="btn" type="submit" disabled={!noteText.trim()} style={{ alignSelf: 'flex-start' }}>
            Save note
          </button>
        </form>
        {notes.length === 0 ? (
          <p className="hint">No notes yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {notes.map((note) => (
              <li key={note.id} className="card">
                <p style={{ margin: 0 }}>{note.body}</p>
                <p className="hint" style={{ margin: 0 }}>
                  {nameFor(note.author_id)}, {dateFormat.format(new Date(note.created_at))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {recipe.original_file && (
        <section aria-labelledby="original-heading">
          <h2 id="original-heading">Original</h2>
          {originals === null ? (
            <button
              className="btn btn-secondary"
              type="button"
              disabled={!online}
              onClick={async () => setOriginals(await originalLinks(recipe.original_file))}
            >
              Show the original
            </button>
          ) : originals.length === 0 ? (
            <p className="hint">The original couldn't be loaded.</p>
          ) : (
            originals.map((item, index) =>
              item.isPdf ? (
                <p key={item.url}>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    Open the PDF<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </p>
              ) : (
                <img
                  key={item.url}
                  src={item.url}
                  alt={`Original recipe, image ${index + 1} of ${originals.length}`}
                  style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 'var(--space-3)', borderRadius: 'var(--radius)' }}
                />
              ),
            )
          )}
          {!online && originals === null && <p className="hint">Connect to the internet to see the original.</p>}
        </section>
      )}

      {recipe.source_url && (
        <p>
          <a href={recipe.source_url} target="_blank" rel="noreferrer">
            Original source<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-6)' }}>
        <Link className="btn btn-secondary" to={`/recipe/${recipe.id}/edit`}>
          Edit
        </Link>
        <button className="btn btn-secondary" type="button" onClick={handleDelete}>
          Delete
        </button>
      </div>
    </Page>
  )
}
