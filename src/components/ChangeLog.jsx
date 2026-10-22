import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { addNote, localDate } from '../lib/data'
import { useRequired } from '../lib/useRequired'

// Changes made while cooking ("added a teaspoon of chicken bouillon",
// "2 more eggs"). Each is saved with today's cook, so the recipe stays as
// written; any change can be turned into a recipe update later.
export default function ChangeLog({ recipeId, member }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const id = useId()
  const required = useRequired(`${id}-change`, 'Write what you changed first.')
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
    if (!required.check(text)) return
    await addNote(recipeId, text, member, today)
    setText('')
    setStatus("Saved with today's cook. The recipe stays as written.")
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
            ref={required.ref}
            id={`${id}-change`}
            type="text"
            value={text}
            placeholder="Added 2 more eggs…"
            onChange={(e) => {
              setText(e.target.value)
              setStatus('')
              required.clear()
            }}
            {...required.field(`${id}-hint`)}
          />
        </div>
        <button className="btn btn-secondary" type="submit">
          Log it
        </button>
      </form>
      {required.error}
      <p id={`${id}-hint`} className="hint" role="status" style={{ margin: status ? 'var(--space-2) 0 0' : 0 }}>
        {status}
      </p>
    </section>
  )
}
