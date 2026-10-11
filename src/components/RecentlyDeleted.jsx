import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../lib/db'
import { restoreRecipe } from '../lib/data'

const DAY = 24 * 60 * 60 * 1000

export default function RecentlyDeleted() {
  const deleted = useLiveQuery(
    () => db.recipes.filter((r) => Boolean(r.deleted_at)).reverse().sortBy('deleted_at'),
    [],
  )
  const members = useLiveQuery(() => db.members.toArray(), [])

  const nameFor = (userId) => members?.find((m) => m.user_id === userId)?.display_name ?? 'A former cook'

  return (
    <section className="card" aria-labelledby="deleted-heading">
      <h2 id="deleted-heading">Recently Deleted</h2>
      {!deleted || deleted.length === 0 ? (
        <p className="hint">Nothing here. Deleted recipes stay for 30 days.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {deleted.map((recipe) => {
            const daysLeft = Math.max(0, 30 - Math.floor((Date.now() - new Date(recipe.deleted_at)) / DAY))
            return (
              <li
                key={recipe.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 'var(--space-3)',
                  padding: 'var(--space-2) 0',
                }}
              >
                <span>
                  {recipe.title}
                  <span className="hint" style={{ display: 'block' }}>
                    Deleted by {nameFor(recipe.deleted_by)}. {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left.
                  </span>
                </span>
                <button className="btn btn-secondary" type="button" onClick={() => restoreRecipe(recipe.id)}>
                  Restore<span className="sr-only"> {recipe.title}</span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
