import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { deleteRecipeForever, restoreRecipe } from '../lib/data'

const DAY = 24 * 60 * 60 * 1000

export default function RecentlyDeleted() {
  const deleted = useLiveQuery(
    () =>
      db.recipes
        .filter((r) => Boolean(r.deleted_at))
        .reverse()
        .sortBy('deleted_at'),
    [],
  )
  const members = useLiveQuery(() => db.members.toArray(), [])

  async function forget(recipe) {
    const question = `Delete "${recipe.title}" forever? Its notes, cook log, ratings, and photos are deleted too. This can't be undone.`
    if (!window.confirm(question)) return
    await deleteRecipeForever(recipe.id)
  }

  const nameFor = (userId) => members?.find((m) => m.user_id === userId)?.display_name ?? 'A former cook'

  return (
    <section className="card" aria-labelledby="deleted-heading">
      <h2 id="deleted-heading">Recently Deleted</h2>
      {!deleted || deleted.length === 0 ? (
        <p className="hint">Nothing here. Deleted recipes stay for 30 days.</p>
      ) : (
        <ul className="plain-list divided">
          {deleted.map((recipe) => {
            const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - new Date(recipe.deleted_at)) / DAY))
            return (
              <li key={recipe.id} className="deleted-row">
                <span>
                  {recipe.title}
                  <span className="hint" style={{ display: 'block' }}>
                    Deleted by {nameFor(recipe.deleted_by)}. {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left.
                  </span>
                </span>
                <span className="deleted-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => restoreRecipe(recipe.id)}>
                    Restore<span className="sr-only"> {recipe.title}</span>
                  </button>
                  <button className="link-btn" type="button" onClick={() => forget(recipe)}>
                    Delete forever<span className="sr-only"> {recipe.title}</span>
                  </button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
