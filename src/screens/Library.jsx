import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { db } from '../lib/db'
import { groupMeals, recipeRatings } from '../lib/stats'
import { newestFirst } from '../lib/photos'
import { PhotoImg } from '../components/MealPhotos'

const oneDecimal = (n) => Math.round(n * 10) / 10

export default function Library() {
  // undefined while loading, then an array. Each recipe comes with its
  // average rating (both cooks' current ratings) and how often it was made.
  const recipes = useLiveQuery(async () => {
    const [list, cookLog, ratings, photos] = await Promise.all([
      db.recipes
        .filter((r) => !r.deleted_at)
        .reverse()
        .sortBy('updated_at'),
      db.cook_log.toArray(),
      db.ratings.toArray(),
      db.meal_photos.toArray(),
    ])
    const latestPhoto = new Map()
    for (const photo of newestFirst(photos)) if (!latestPhoto.has(photo.recipe_id)) latestPhoto.set(photo.recipe_id, photo)
    return list.map((recipe) => {
      const log = cookLog.filter((c) => c.recipe_id === recipe.id)
      const { average, byMember } = recipeRatings(recipe.id, log, ratings)
      return {
        ...recipe,
        average,
        raters: Object.keys(byMember).length,
        timesMade: groupMeals(log).length,
        photo: latestPhoto.get(recipe.id),
      }
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
        <ul className="plain-list">
          {recipes.map((recipe) => (
            <li key={recipe.id} className={recipe.photo ? 'card has-photo' : 'card'}>
              {recipe.photo && <PhotoImg photo={recipe.photo} alt="" className="card-photo" />}
              <div>
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
              </div>
            </li>
          ))}
        </ul>
      )}
    </Page>
  )
}
