import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { db } from '../lib/db'
import { groupMeals, recipeRatings } from '../lib/stats'

const oneDecimal = (n) => Math.round(n * 10) / 10

export default function Library() {
  // undefined while loading, then an array. Each recipe comes with its
  // average rating (both cooks' current ratings) and how often it was made.
  const recipes = useLiveQuery(async () => {
    const [list, cookLog, ratings] = await Promise.all([
      db.recipes
        .filter((r) => !r.deleted_at)
        .reverse()
        .sortBy('updated_at'),
      db.cook_log.toArray(),
      db.ratings.toArray(),
    ])
    return list.map((recipe) => {
      const log = cookLog.filter((c) => c.recipe_id === recipe.id)
      const { average, byMember } = recipeRatings(recipe.id, log, ratings)
      return { ...recipe, average, raters: Object.keys(byMember).length, timesMade: groupMeals(log).length }
    })
  }, [])

  return (
    <Page title="Library">
      <p>
        <Link className="btn" to="/recipe/new">
          Add a recipe
        </Link>
      </p>
      {recipes === undefined ? (
        <p role="status">Loading recipes…</p>
      ) : recipes.length === 0 ? (
        <div className="card">
          <h2>No recipes yet</h2>
          <p style={{ margin: 0 }}>
            Add your first one by typing or pasting it in. Anything one of you adds shows up on the other's phone.
          </p>
        </div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
          {recipes.map((recipe) => (
            <li key={recipe.id} className="card">
              <Link to={`/recipe/${recipe.id}`}>
                <strong>{recipe.title}</strong>
              </Link>
              <p className="hint" style={{ margin: 'var(--space-1) 0 0' }}>
                {recipe.average !== null && (
                  <span className="card-rating">
                    <span aria-hidden="true">★ </span>
                    {oneDecimal(recipe.average)}
                    <span className="sr-only"> out of 5</span>
                    {recipe.raters === 1 ? ' (one rating)' : ''}
                  </span>
                )}
                {[
                  recipe.average !== null ? null : recipe.timesMade > 0 ? 'Not rated yet' : null,
                  recipe.timesMade > 0 ? `made ${recipe.timesMade} ${recipe.timesMade === 1 ? 'time' : 'times'}` : null,
                  recipe.cuisine,
                ]
                  .filter(Boolean)
                  .map((part, i) => (
                    <span key={part}>
                      {recipe.average !== null || i > 0 ? ' · ' : ''}
                      {part}
                    </span>
                  ))}
              </p>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
