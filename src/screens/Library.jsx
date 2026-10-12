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
      {recipes === undefined ? (
        <p role="status">Loading recipes…</p>
      ) : recipes.length === 0 ? (
        <div className="card">
          <h2>No recipes yet</h2>
          <p style={{ margin: 0 }}>
            Add your first one from a screenshot, a PDF, a link, or by typing it in. Anything one of you adds shows up on the other's phone.
          </p>
        </div>
      ) : (
        <ul className="recipe-list">
          {recipes.map((recipe) => (
            <li key={recipe.id}>
              <Link className="recipe-card" to={`/recipe/${recipe.id}`}>
                {recipe.photo ? (
                  <PhotoImg photo={recipe.photo} alt="" className="recipe-card-photo" />
                ) : (
                  <span className="recipe-card-photo is-empty" aria-hidden="true">
                    {recipe.title.trim().charAt(0).toUpperCase()}
                  </span>
                )}
                <span className="recipe-card-text">
                  <span className="recipe-card-title">{recipe.title}</span>
                  <span className="recipe-card-meta">
                    {[
                      recipe.average !== null ? (
                        <span key="rating">
                          <span aria-hidden="true">★ </span>
                          {oneDecimal(recipe.average)}
                          <span className="sr-only"> out of 5</span>
                        </span>
                      ) : recipe.timesMade > 0 ? (
                        'Not rated'
                      ) : null,
                      recipe.timesMade > 0 ? `made ${recipe.timesMade}×` : 'not made yet',
                      recipe.cuisine,
                    ]
                      .filter(Boolean)
                      .map((part, i) => (
                        <span key={i}>
                          {i > 0 ? ' · ' : ''}
                          {part}
                        </span>
                      ))}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {/* In the thumb zone, above the tab bar. Opens every way to add one. */}
      <Link className="btn fab" to="/import">
        <span aria-hidden="true">+ </span>Add recipe
      </Link>
    </Page>
  )
}
