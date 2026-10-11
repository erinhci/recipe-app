import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import Page from '../components/Page'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { addNote, loadRecipe, saveRecipe } from '../lib/data'
import { ingredientToLine } from '../lib/ingredients'
import { applyChanges, suggestEdit } from '../lib/noteEdit'
import { useOnline } from '../lib/useOnline'

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

function itemHeading(item) {
  const kind = item.target === 'ingredient' ? 'Ingredient' : 'Step'
  if (item.action === 'add') return item.number === 0 ? `New ${kind.toLowerCase()} at the start` : `New ${kind.toLowerCase()} after ${kind.toLowerCase()} ${item.number}`
  return `${kind} ${item.number}, ${item.action === 'remove' ? 'removed' : 'changed'}`
}

// Gemini drafts a recipe change from one note. The cooks see each change
// as before and after; nothing is saved until one of them approves.
export default function NoteEdit() {
  const { id, noteId } = useParams()
  const navigate = useNavigate()
  const { member } = useAuth()
  const online = useOnline()

  const [source, setSource] = useState(undefined) // { data, note, author } | null
  const [result, setResult] = useState({ status: 'idle' })
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Read the recipe once, so the suggestion and the "before" can't shift
  // if the other phone syncs a change while this screen is open.
  useEffect(() => {
    let active = true
    Promise.all([loadRecipe(id), db.notes.get(noteId), db.members.toArray()]).then(([data, note, members]) => {
      if (!active) return
      if (!data || data.recipe.deleted_at || !note) return setSource(null)
      const author = members.find((m) => m.user_id === note.author_id)?.display_name ?? 'A former cook'
      setSource({ data, note, author })
    })
    return () => {
      active = false
    }
  }, [id, noteId])

  const ask = useCallback(async () => {
    if (!source) return
    setResult({ status: 'loading' })
    setSaveError('')
    // Work from the latest copy, in case the other cook changed it.
    const base = (await loadRecipe(id)) ?? source.data
    const answer = await suggestEdit(base, source.note.body)
    if (!answer.ok) return setResult({ status: 'error', message: answer.message })
    const applied = applyChanges(base, answer.changes ?? [])
    if (applied.items.length === 0) {
      return setResult({ status: 'none', reason: answer.no_change_reason || "The note doesn't describe a change to the recipe." })
    }
    setResult({ status: 'ready', summary: answer.summary, base, ...applied })
  }, [id, source])

  useEffect(() => {
    if (source && online && result.status === 'idle') ask()
  }, [source, online, result.status, ask])

  if (source === undefined) {
    return (
      <Page title="Change from a note">
        <p role="status">Loading…</p>
      </Page>
    )
  }

  if (source === null) {
    return (
      <Page title="Change from a note">
        <p>That recipe or note isn't on this phone.</p>
        <Link className="btn" to={`/recipe/${id}`}>
          Back to the recipe
        </Link>
      </Page>
    )
  }

  const { data, note, author } = source
  const backLink = (
    <Link className="btn btn-secondary" to={`/recipe/${id}`}>
      Cancel
    </Link>
  )

  async function handleSave() {
    setSaving(true)
    setSaveError('')
    // If the other cook changed the recipe since this screen opened, the
    // suggestion was made against an older version.
    const current = await db.recipes.get(id)
    if (current?.updated_at !== result.base.recipe.updated_at) {
      setSaving(false)
      setSaveError('The recipe changed since this suggestion was made. Ask Gemini again so it works from the latest version.')
      return
    }
    try {
      await saveRecipe({ recipe: result.base.recipe, ingredients: result.ingredients, steps: result.steps }, member)
      // Leave a note so the other cook knows what changed and why.
      await addNote(id, `Changed the recipe from ${author}'s note: ${result.summary || 'see the recipe'}`, member)
      navigate(`/recipe/${id}`, { replace: true, state: { message: 'Recipe updated. The previous version is under Earlier versions.' } })
    } catch (error) {
      setSaving(false)
      setSaveError(`Couldn't save: ${error.message}`)
    }
  }

  function handleEditFirst() {
    navigate(`/recipe/${id}/edit`, {
      state: {
        proposed: {
          ingredientText: result.ingredients.map(ingredientToLine).join('\n'),
          stepText: result.steps.map((s) => s.text).join('\n\n'),
        },
      },
    })
  }

  return (
    <Page title="Change from a note">
      <p className="hint">{data.recipe.title}</p>
      <figure className="card" style={{ margin: '0 0 var(--space-4)' }}>
        <blockquote style={{ margin: 0 }}>
          <p style={{ margin: 0 }}>{note.body}</p>
        </blockquote>
        <figcaption className="hint">
          {author}, {dateFormat.format(new Date(note.created_at))}
        </figcaption>
      </figure>

      {!online && result.status !== 'ready' && (
        <>
          <p>Gemini needs the internet to draft a change. You can still edit the recipe yourself.</p>
          <p style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Link className="btn" to={`/recipe/${id}/edit`}>
              Edit the recipe
            </Link>
            {backLink}
          </p>
        </>
      )}

      {online && (result.status === 'idle' || result.status === 'loading') && (
        <p role="status">Gemini is drafting a change from this note…</p>
      )}

      {result.status === 'error' && (
        <>
          <p className="error" role="alert">
            {result.message}
          </p>
          <p style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={ask} disabled={!online}>
              Try again
            </button>
            {backLink}
          </p>
        </>
      )}

      {result.status === 'none' && (
        <>
          <p role="status">No change found. {result.reason}</p>
          <p style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <Link className="btn" to={`/recipe/${id}/edit`}>
              Edit the recipe yourself
            </Link>
            <Link className="btn btn-secondary" to={`/recipe/${id}`}>
              Back to the recipe
            </Link>
          </p>
        </>
      )}

      {result.status === 'ready' && (
        <section aria-labelledby="proposal-heading">
          <h2 id="proposal-heading">Suggested change</h2>
          <p role="status">{result.summary}</p>
          <p className="hint">
            Check each change. Amounts are as the recipe is written, for {result.base.recipe.base_servings} servings.
            Nothing is saved until you approve.
          </p>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {result.items.map((item) => (
              <li key={`${item.target}-${item.action}-${item.number}-${item.after}`} className="card">
                <h3 style={{ fontSize: '1rem', margin: '0 0 var(--space-2)' }}>{itemHeading(item)}</h3>
                {item.before !== null && (
                  <p style={{ margin: '0 0 var(--space-1)' }}>
                    <strong>Before: </strong>
                    <del>{item.before}</del>
                  </p>
                )}
                {item.after !== null && (
                  <p style={{ margin: 0 }}>
                    <strong>After: </strong>
                    <ins style={{ textDecoration: 'none', fontWeight: 600 }}>{item.after}</ins>
                  </p>
                )}
                {item.needsReview && <p className="error" style={{ margin: 'var(--space-2) 0 0' }}>No amount. Check this line.</p>}
              </li>
            ))}
          </ul>
          {saveError && (
            <p className="error" role="alert">
              {saveError}
            </p>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
            <button className="btn" type="button" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save this change'}
            </button>
            <button className="btn btn-secondary" type="button" onClick={handleEditFirst} disabled={saving}>
              Edit before saving
            </button>
            {saveError && (
              <button className="btn btn-secondary" type="button" onClick={ask} disabled={!online}>
                Ask again
              </button>
            )}
            {backLink}
          </div>
        </section>
      )}
    </Page>
  )
}
