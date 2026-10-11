import { useId, useState } from 'react'
import { addNote } from '../lib/data'

// A note for next time, written mid-cook ("added a teaspoon of chicken
// bouillon"). It joins the recipe's notes, where it can become a recipe
// change later.
export default function QuickNote({ recipeId, member }) {
  const [text, setText] = useState('')
  const [status, setStatus] = useState('')
  const id = useId()

  async function save(event) {
    event.preventDefault()
    if (!text.trim()) return
    await addNote(recipeId, text, member)
    setText('')
    setStatus("Saved to the recipe's notes. You can turn it into a recipe change from there.")
  }

  return (
    <section aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`}>Note for next time</h2>
      <form onSubmit={save} className="comment-form">
        <label htmlFor={`${id}-note`} className="sr-only">
          Note for next time
        </label>
        <textarea
          id={`${id}-note`}
          rows={2}
          value={text}
          placeholder="Added a teaspoon of chicken bouillon…"
          onChange={(e) => {
            setText(e.target.value)
            setStatus('')
          }}
        />
        <button className="btn btn-secondary" type="submit" disabled={!text.trim()}>
          Save
        </button>
      </form>
      <p role="status" className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
        {status}
      </p>
    </section>
  )
}
