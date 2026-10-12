import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { addNote, localDate } from '../lib/data'

// Changes made while cooking ("added a teaspoon of chicken bouillon",
// "2 more eggs"). Each is saved with today's cook, so the recipe stays as
// written; any change can be turned into a recipe update later.
export default function ChangeLog({ recipeId, member }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const id = useId()
  const today = localDate()
  const changes =
    useLiveQuery(
      () =>
        db.notes
          .where('recipe_id')
          .equals(recipeId)
          .filter((n) => n.cooked_on === today)
          .sortBy('created_at'),
      [recipeId, today],
    ) ?? []

  async function save(event) {
    event.preventDefault()
    if (!text.trim()) return
    await addNote(recipeId, text, member, today)
    setText('')
    setStatus("Saved with today's cook.")
  }

  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Changes this time</h2>
      {changes.length > 0 && (
        <ul className="plain-list divided">
          {changes.map((change) => (
            <li key={change.id}>
              <span>{change.body}</span>
              <Link to={`/recipe/${recipeId}/note/${change.id}`} className="small-link">
                Update recipe<span className="sr-only"> with this change</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={save} className="inline-form" style={{ marginTop: 'var(--space-3)' }}>
        <div className="field">
          <label htmlFor={`${id}-change`} className="sr-only">
            A change you made
          </label>
          <input
            id={`${id}-change`}
            type="text"
            value={text}
            placeholder="Added 2 more eggs…"
            aria-describedby={`${id}-hint`}
            onChange={(e) => {
              setText(e.target.value)
              setStatus('')
            }}
          />
        </div>
        <button className="btn btn-secondary" type="submit" disabled={!text.trim()}>
          Log it
        </button>
      </form>
      <p id={`${id}-hint`} className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
        {status || 'Saved with today’s cook; the recipe stays as written unless you update it.'}
      </p>
    </section>
  )
}
