import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { db } from '../lib/db'
import { groupMeals, recipeRatings } from '../lib/stats'
import { newestFirst } from '../lib/photos'
import { PhotoImg } from '../components/MealPhotos'
import { SORTS, filterAndSort, filterOptions } from '../lib/library'

const oneDecimal = (n) => Math.round(n * 10) / 10

// The search, sort, and chips are remembered on this phone.
const VIEW_KEY = 'library-view'
function readView() {
  try {
    return { query: '', sort: 'added', filters: [], ...JSON.parse(localStorage.getItem(VIEW_KEY) ?? '{}') }
  } catch {
    return { query: '', sort: 'added', filters: [] }
  }
}

export default function Library() {
  // undefined while loading, then an array. Each recipe comes with its
  // average rating (both cooks' current ratings) and how often it was made.
  const recipes = useLiveQuery(async () => {
    const [list, cookLog, ratings, photos, ingredients] = await Promise.all([
      db.recipes
        .filter((r) => !r.deleted_at)
        .reverse()
        .sortBy('updated_at'),
      db.cook_log.toArray(),
      db.ratings.toArray(),
      db.meal_photos.toArray(),
      db.ingredients.toArray(),
    ])
    const ingredientNames = new Map()
    for (const ing of ingredients) {
      if (!ingredientNames.has(ing.recipe_id)) ingredientNames.set(ing.recipe_id, [])
      ingredientNames.get(ing.recipe_id).push(ing.item)
    }
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
        ingredientNames: ingredientNames.get(recipe.id) ?? [],
      }
    })
  }, [])

  const [view, setView] = useState(readView)
  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, JSON.stringify(view))
    } catch {
      // Private browsing: the view just isn't remembered.
    }
  }, [view])
  const options = recipes ? filterOptions(recipes) : []
  // Chips for things no longer in the library are dropped.
  const filters = view.filters.filter((key) => options.some((o) => o.key === key))
  const shown = recipes ? filterAndSort(recipes, { ...view, filters }) : []
  const narrowed = Boolean(view.query.trim() || filters.length)
  const toggle = (key) =>
    setView((v) => ({ ...v, filters: v.filters.includes(key) ? v.filters.filter((k) => k !== key) : [...v.filters, key] }))

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
        <>
          <div className="library-tools">
            <div className="field">
              <label htmlFor="library-search" className="sr-only">
                Search recipes
              </label>
              <input
                id="library-search"
                type="search"
                placeholder="Search"
                value={view.query}
                onChange={(e) => setView((v) => ({ ...v, query: e.target.value }))}
              />
            </div>
            <div className="field library-sort">
              <label htmlFor="library-sort" className="sr-only">
                Sort by
              </label>
              <select id="library-sort" value={view.sort} onChange={(e) => setView((v) => ({ ...v, sort: e.target.value }))}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {options.length > 1 && (
            <ul className="filter-chips" aria-label="Filters">
              {options.map((option) => (
                <li key={option.key}>
                  <button
                    type="button"
                    className="filter-chip"
                    aria-pressed={filters.includes(option.key)}
                    onClick={() => toggle(option.key)}
                  >
                    {option.label}
                    <span className="chip-count"> {option.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          <p className="hint library-count" role="status">
            {narrowed ? `${shown.length} of ${recipes.length} recipes` : `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}`}
            {narrowed && (
              <>
                {' · '}
                <button className="link-btn" type="button" onClick={() => setView((v) => ({ ...v, query: '', filters: [] }))}>
                  Clear
                </button>
              </>
            )}
          </p>
          {shown.length === 0 && <p>No recipes match. Try fewer filters or another word.</p>}
          <ul className="recipe-list">
            {shown.map((recipe) => (
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
        </>
      )}
      {/* In the thumb zone, above the tab bar. Opens every way to add one. */}
      <Link className="btn fab" to="/import">
        <span aria-hidden="true">+ </span>Add recipe
      </Link>
    </Page>
  )
}
