import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import Icon from '../components/Icon'
import { db } from '../lib/db'
import { groupMeals, recipeRatings } from '../lib/stats'
import { newestFirst } from '../lib/photos'
import { PhotoImg } from '../components/MealPhotos'
import { SORTS, filterAndSort, filterOptions } from '../lib/library'

const oneDecimal = (n) => Math.round(n * 10) / 10
const GROUPS = [
  { group: 'made', label: 'Status' },
  { group: 'meal', label: 'Meal' },
  { group: 'cuisine', label: 'Cuisine' },
]

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
  const sortLabel = SORTS.find((s) => s.value === view.sort)?.label ?? SORTS[0].label

  // Filters live in a sheet, opened from the filter button, so the list
  // starts higher. A native dialog keeps focus inside and closes on Escape.
  const sheet = useRef(null)
  const filterButton = useRef(null)
  const openSheet = () => sheet.current?.showModal()
  const closeSheet = () => {
    sheet.current?.close()
    filterButton.current?.focus()
  }

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
            {options.length > 1 && (
              <button
                ref={filterButton}
                type="button"
                className="btn btn-secondary icon-btn"
                aria-haspopup="dialog"
                aria-label={filters.length ? `Filter recipes, ${filters.length} on` : 'Filter recipes'}
                onClick={openSheet}
              >
                <Icon name="filter" size={22} />
                {filters.length > 0 && (
                  <span className="icon-btn-count" aria-hidden="true">
                    {filters.length}
                  </span>
                )}
              </button>
            )}
            {/* A native picker behind the sort icon: the phone's own list. */}
            <span className="btn btn-secondary icon-btn icon-select">
              <Icon name="sort" size={22} />
              <select
                aria-label={`Sort: ${sortLabel}`}
                value={view.sort}
                onChange={(e) => setView((v) => ({ ...v, sort: e.target.value }))}
              >
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </span>
          </div>
          {/* Only when narrowed: how many show, and a way back to all. */}
          <p className="hint library-count" role="status">
            {narrowed && (
              <>
                {shown.length} of {recipes.length} recipes ·{' '}
                <button className="link-btn" type="button" onClick={() => setView((v) => ({ ...v, query: '', filters: [] }))}>
                  Clear
                </button>
              </>
            )}
          </p>
          <dialog ref={sheet} className="sheet" aria-labelledby="filter-title" onClick={(e) => e.target === sheet.current && closeSheet()}>
            <div className="sheet-handle" aria-hidden="true" />
            <div className="row-between">
              <h2 id="filter-title" style={{ margin: 0 }}>
                Filter recipes
              </h2>
              <button className="close-btn sheet-close" type="button" aria-label="Close filters" onClick={closeSheet}>
                <span aria-hidden="true">×</span>
              </button>
            </div>
            {GROUPS.map(({ group, label }) => {
              const inGroup = options.filter((o) => o.group === group)
              if (inGroup.length === 0) return null
              return (
                <div key={group} role="group" aria-labelledby={`filter-${group}`} className="sheet-group">
                  <h3 id={`filter-${group}`}>{label}</h3>
                  <ul className="filter-chips in-sheet">
                    {inGroup.map((option) => (
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
                </div>
              )
            })}
            <div className="actions">
              <button className="btn btn-secondary" type="button" onClick={() => setView((v) => ({ ...v, filters: [] }))} disabled={!filters.length}>
                Clear all
              </button>
              <button className="btn" type="button" onClick={closeSheet}>
                Show {shown.length} {shown.length === 1 ? 'recipe' : 'recipes'}
              </button>
            </div>
          </dialog>
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
