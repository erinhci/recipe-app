import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { db } from '../lib/db'

export default function Library() {
  // undefined while loading, then an array.
  const recipes = useLiveQuery(
    () =>
      db.recipes
        .filter((r) => !r.deleted_at)
        .reverse()
        .sortBy('updated_at'),
    [],
  )

  return (
    <Page title="Library">
      {recipes === undefined ? (
        <p role="status">Loading recipes…</p>
      ) : recipes.length === 0 ? (
        <div className="card">
          <h2>No recipes yet</h2>
          <p>Add your first one from a screenshot, a PDF, or a link.</p>
          <Link className="btn" to="/import">
            Import a recipe
          </Link>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {recipes.map((recipe) => (
            <li key={recipe.id} className="card">
              <Link to={`/recipe/${recipe.id}`}>
                <strong>{recipe.title}</strong>
              </Link>
              {recipe.cuisine && <p className="hint">{recipe.cuisine}</p>}
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
