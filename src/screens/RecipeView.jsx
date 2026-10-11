import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { addNote, deleteMealLog, deleteNote, deleteRecipe, localDate, logMeal, rateRecipe, restoreVersion } from '../lib/data'
import { ingredientToLine } from '../lib/ingredients'
import { displayIngredient, scaleFactor } from '../lib/units'
import { DEFAULT_SERVINGS } from '../lib/constants'
import { originalLinks } from '../lib/importRecipe'
import { useOnline } from '../lib/useOnline'
import { groupMeals, ratingIsStale, recipeRatings } from '../lib/stats'
import StarPicker from '../components/StarPicker'
import NutritionPanel from '../components/NutritionPanel'

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
// cooked_on is a calendar date; read it as local noon so it never shifts a day.
const formatDay = (day) => dateFormat.format(new Date(`${day}T12:00:00`))
const timeFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
const VERSIONS_SHOWN = 10
const HISTORY_SHOWN = 10

export default function RecipeView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member } = useAuth()

  const data = useLiveQuery(async () => {
    const recipe = await db.recipes.get(id)
    if (!recipe) return { recipe: null }
    const [ingredients, steps, notes, members, cookLog] = await Promise.all([
      db.ingredients.where('recipe_id').equals(id).sortBy('position'),
      db.steps.where('recipe_id').equals(id).sortBy('position'),
      db.notes.where('recipe_id').equals(id).reverse().sortBy('created_at'),
      db.members.toArray(),
      db.cook_log.where('recipe_id').equals(id).toArray(),
    ])
    cookLog.sort((a, b) => b.cooked_on.localeCompare(a.cooked_on) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    const ratings = await db.ratings.where('cook_log_id').anyOf(cookLog.map((c) => c.id)).toArray()
    const allVersions = await db.recipe_versions.where('recipe_id').equals(id).reverse().sortBy('created_at')
    return { recipe, ingredients, steps, notes, members, cookLog, ratings, versions: allVersions.slice(0, VERSIONS_SHOWN), allVersions }
  }, [id])

  const [servings, setServings] = useState(DEFAULT_SERVINGS)
  const [showOriginal, setShowOriginal] = useState(false)
  const [system, setSystem] = useState(member.unit_pref ?? 'us')
  const [noteText, setNoteText] = useState('')
  const [originals, setOriginals] = useState(null) // null = not loaded
  const online = useOnline()
  const location = useLocation()
  const finishedSession = location.state?.finishedSession ?? null
  const [message, setMessage] = useState(location.state?.message ?? '')
  const [logDate, setLogDate] = useState(localDate())
  const [logStars, setLogStars] = useState(null)
  const [logStatus, setLogStatus] = useState('')
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [changingRating, setChangingRating] = useState(false)
  const [ratingStatus, setRatingStatus] = useState('')
  const logHeadingRef = useRef(null)
  const loaded = Boolean(data?.recipe)

  // Coming back from cooking mode: go straight to "How was it?".
  useEffect(() => {
    if (finishedSession && loaded) {
      logHeadingRef.current?.focus()
      logHeadingRef.current?.scrollIntoView({ block: 'start' })
    }
  }, [finishedSession, loaded])

  if (data === undefined) {
    return (
      <Page title="Recipe">
        <p role="status">Loading…</p>
      </Page>
    )
  }

  if (!data.recipe || data.recipe.deleted_at) {
    return (
      <Page title="Recipe not found">
        <p>This recipe was deleted or isn't on this phone yet.</p>
        <Link className="btn" to="/">
          Back to Library
        </Link>
      </Page>
    )
  }

  const { recipe, ingredients, steps, notes, members, cookLog, ratings, versions, allVersions } = data
  // Which notes led to a recipe change (kept with the version saved then).
  const changesFromNote = new Map()
  for (const version of allVersions) {
    const change = version.snapshot?.next_change
    if (change?.note_id && !changesFromNote.has(change.note_id)) changesFromNote.set(change.note_id, { ...change, version })
  }
  const shownServings = showOriginal ? recipe.base_servings : servings
  const factor = scaleFactor(recipe.base_servings, shownServings)
  const nameFor = (userId) => members.find((m) => m.user_id === userId)?.display_name ?? 'A former cook'

  async function handleDelete() {
    if (!window.confirm(`Delete "${recipe.title}"? It stays in Recently Deleted in Settings for 30 days.`)) return
    await deleteRecipe(recipe.id, member)
    navigate('/', { replace: true })
  }

  async function handleLogMeal(event) {
    event.preventDefault()
    // A first rating can be given with the first log; after that, the
    // rating carries over and is changed in Ratings.
    const result = await logMeal(
      { recipeId: recipe.id, cookedOn: logDate, sessionId: finishedSession, stars: meals.length === 0 ? logStars : null },
      member,
    )
    setLogStars(null)
    setLogDate(localDate())
    setLogStatus(result.alreadyLogged ? `${formatDay(logDate)} was already logged.` : `Logged for ${formatDay(logDate)}.`)
    // Clear the "just finished" state so a refresh doesn't ask again.
    if (finishedSession) navigate(location.pathname, { replace: true, state: null })
  }

  async function handleRestore(version) {
    const when = timeFormat.format(new Date(version.created_at))
    if (!window.confirm(`Put back the recipe as it was before ${when}? The current version is kept, so you can switch back.`)) return
    try {
      await restoreVersion(version.id, member)
      setMessage(`Restored the version from before ${when}.`)
      window.scrollTo(0, 0)
    } catch (error) {
      setMessage(`Couldn't restore: ${error.message}`)
    }
  }

  async function handleDeleteLog(meal) {
    const othersHere = [
      ...new Set(ratings.filter((r) => meal.ids.includes(r.cook_log_id) && r.member_id !== member.user_id).map((r) => nameFor(r.member_id))),
    ]
    const warning = othersHere.length
      ? ` ${othersHere.join(' and ')}'s rating is saved with this entry and will be removed; they can rate again.`
      : ' Your rating stays.'
    if (!window.confirm(`Remove ${formatDay(meal.cooked_on)} from the cook log?${warning}`)) return
    await deleteMealLog(meal.ids, member)
  }

  async function handleRate(n) {
    await rateRecipe(recipe.id, n, member)
    setChangingRating(false)
    setRatingStatus(`Your rating is ${n}★.`)
  }

  const summary = recipeRatings(recipe.id, cookLog, ratings)
  // You first, then the other cook.
  const ratedMembers = Object.keys(summary.byMember).sort((a, b) => (b === member.user_id) - (a === member.user_id))
  // Both cooks logging the same dinner is one meal.
  const meals = groupMeals(cookLog)
  const history = showAllHistory ? meals : meals.slice(0, HISTORY_SHOWN)
  const sameDay = meals.find((m) => m.cooked_on === logDate)
  // Ratings belong to the recipe. One goes stale only if the recipe was
  // edited after it was given.
  const lastChangedAt = versions[0]?.created_at ?? null
  const myStars = summary.byMember[member.user_id]
  const myStale = ratingIsStale(summary.ratedAt[member.user_id], lastChangedAt)
  const loggedByNames = (meal) => [...new Set(meal.entries.map((e) => nameFor(e.created_by)))].join(' and ')
  const stars = (n) => `${n}★`

  async function handleAddNote(event) {
    event.preventDefault()
    if (!noteText.trim()) return
    await addNote(recipe.id, noteText, member)
    setNoteText('')
  }

  return (
    <Page title={recipe.title}>
      <p role="status" style={message ? undefined : { margin: 0 }}>
        {message && <strong>{message}</strong>}
      </p>
      {(recipe.cuisine || recipe.meal_type) && (
        <p className="hint">{[recipe.cuisine, recipe.meal_type].filter(Boolean).join(' · ')}</p>
      )}

      {ratedMembers.length > 0 && (
        <p>
          <strong>{stars(Math.round(summary.average * 10) / 10)}</strong> average (
          {ratedMembers.map((m) => `${nameFor(m)} ${stars(summary.byMember[m])}`).join(', ')})
          {meals.length > 0 && ` · made ${meals.length} ${meals.length === 1 ? 'time' : 'times'}`}
        </p>
      )}

      <section className="card" aria-labelledby="servings-heading">
        <h2 id="servings-heading" className="sr-only">
          Servings and units
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setServings((s) => Math.max(1, s - 1))}
            disabled={showOriginal || servings <= 1}
            aria-label="One fewer serving"
          >
            −
          </button>
          <p style={{ margin: 0, fontWeight: 600 }} aria-live="polite">
            {shownServings} {Number(shownServings) === 1 ? 'serving' : 'servings'}
          </p>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => setServings((s) => s + 1)}
            disabled={showOriginal}
            aria-label="One more serving"
          >
            +
          </button>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 'var(--target)' }}>
          <input
            type="checkbox"
            checked={showOriginal}
            onChange={(e) => setShowOriginal(e.target.checked)}
            style={{ width: 22, height: 22 }}
          />
          Show original (serves {recipe.base_servings})
        </label>
        <fieldset style={{ border: 0, padding: 0, margin: 0, display: 'flex', gap: 'var(--space-4)' }}>
          <legend className="sr-only">Units</legend>
          {[
            ['us', 'US'],
            ['metric', 'Metric'],
          ].map(([value, label]) => (
            <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minHeight: 'var(--target)' }}>
              <input
                type="radio"
                name="units"
                value={value}
                checked={system === value}
                onChange={() => setSystem(value)}
                style={{ width: 22, height: 22 }}
              />
              {label}
            </label>
          ))}
        </fieldset>
      </section>

      {steps.length > 0 && (
        <p>
          <Link className="btn" to={`/recipe/${recipe.id}/cook?servings=${shownServings}&units=${system}`}>
            Start cooking
          </Link>
        </p>
      )}

      <section aria-labelledby="ingredients-heading">
        <h2 id="ingredients-heading">Ingredients</h2>
        <ul style={{ paddingLeft: 'var(--space-4)' }}>
          {ingredients.map((ing) => {
            const shown = displayIngredient(ing, factor, system)
            return (
              <li key={ing.id} style={{ marginBottom: 'var(--space-2)' }}>
                {shown.text && <strong>{shown.text} </strong>}
                {ing.item}
                {ing.prep_note ? `, ${ing.prep_note}` : ''}
                {shown.note && <div className="hint">{shown.note}</div>}
              </li>
            )
          })}
        </ul>
      </section>

      <NutritionPanel recipe={recipe} ingredients={ingredients} member={member} online={online} shownServings={shownServings} />

      <section aria-labelledby="steps-heading">
        <h2 id="steps-heading">Steps</h2>
        {steps.length === 0 ? (
          <p className="hint">No steps yet.</p>
        ) : (
          <ol style={{ paddingLeft: 'var(--space-6)' }}>
            {steps.map((step) => (
              <li key={step.id} style={{ marginBottom: 'var(--space-3)' }}>
                {step.text}
              </li>
            ))}
          </ol>
        )}
        {factor !== 1 && (
          <p className="hint">
            Times and pan sizes don't scale with amounts. For baked dishes, a smaller pan may be needed.
          </p>
        )}
      </section>

      <section aria-labelledby="log-heading">
        <h2 id="log-heading" ref={logHeadingRef} tabIndex={-1}>
          {finishedSession ? 'How was it?' : 'Ratings'}
        </h2>
        {meals.length === 0 ? (
          <p className="hint">Rate it after the first time you make it. Log that below.</p>
        ) : (
          <div className="card">
            {ratedMembers.length === 0 ? (
              <p>No ratings yet.</p>
            ) : (
              <ul style={{ paddingLeft: 'var(--space-6)' }}>
                {ratedMembers.map((m) => (
                  <li key={m}>
                    {m === member.user_id ? 'You' : nameFor(m)}: {stars(summary.byMember[m])}
                    {ratingIsStale(summary.ratedAt[m], lastChangedAt) && (
                      <span className="hint"> (rated before the latest edit)</span>
                    )}
                  </li>
                ))}
                {ratedMembers.length > 1 && <li>Average: {stars(Math.round(summary.average * 10) / 10)}</li>}
              </ul>
            )}
            {myStars === undefined || myStale || changingRating ? (
              <StarPicker
                legend={
                  myStars === undefined
                    ? 'Your rating'
                    : myStale && !changingRating
                      ? 'The recipe changed since you rated it. Rate it again?'
                      : 'Change your rating'
                }
                value={myStars ?? null}
                onChange={handleRate}
              />
            ) : (
              <button className="btn btn-secondary" type="button" onClick={() => setChangingRating(true)}>
                Change your rating
              </button>
            )}
            <p className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
              Your rating stays the same each time you make it, until you change it.
            </p>
            <p role="status" className="hint" style={{ margin: 0 }}>
              {ratingStatus}
            </p>
          </div>
        )}

        <h3>Cook log</h3>
        <form onSubmit={handleLogMeal} className="card">
          <div className="field">
            <label htmlFor="cooked-on">We made this on</label>
            <input
              id="cooked-on"
              type="date"
              value={logDate}
              max={localDate()}
              required
              onChange={(e) => setLogDate(e.target.value)}
            />
          </div>
          {meals.length === 0 && <StarPicker legend="Your rating (optional)" value={logStars} onChange={setLogStars} />}
          {sameDay && (
            <p className="hint">
              {loggedByNames(sameDay)} already logged {formatDay(logDate)}.
            </p>
          )}
          <button className="btn" type="submit" disabled={!logDate || Boolean(sameDay)}>
            {finishedSession ? 'Log this meal' : 'We made this'}
          </button>
          <p role="status" className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
            {logStatus}
          </p>
        </form>

        {meals.length === 0 ? (
          <p className="hint">Not made yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {history.map((meal) => (
              <li
                key={meal.key}
                className="card"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 'var(--space-3)', flexWrap: 'wrap' }}
              >
                <div>
                  <p style={{ fontWeight: 600, margin: 0 }}>{formatDay(meal.cooked_on)}</p>
                  <p className="hint" style={{ margin: 0 }}>
                    Logged by {loggedByNames(meal)}
                  </p>
                </div>
                <button className="btn btn-secondary" type="button" onClick={() => handleDeleteLog(meal)}>
                  Remove<span className="sr-only"> {formatDay(meal.cooked_on)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {meals.length > HISTORY_SHOWN && !showAllHistory && (
          <button className="btn btn-secondary" type="button" onClick={() => setShowAllHistory(true)}>
            Show all {meals.length}
          </button>
        )}
      </section>

      <section aria-labelledby="notes-heading">
        <h2 id="notes-heading">Notes</h2>
        <form onSubmit={handleAddNote} className="field">
          <label htmlFor="note">Add a note</label>
          <textarea id="note" rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
          <button className="btn" type="submit" disabled={!noteText.trim()} style={{ alignSelf: 'flex-start' }}>
            Save note
          </button>
        </form>
        {notes.length === 0 ? (
          <p className="hint">No notes yet.</p>
        ) : (
          <>
          {!online && <p className="hint">Turning a note into a recipe change needs the internet.</p>}
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {notes.map((note) => (
              <li key={note.id} className="card">
                <p style={{ margin: 0 }}>{note.body}</p>
                <p className="hint" style={{ margin: '0 0 var(--space-2)' }}>
                  {nameFor(note.author_id)}, {dateFormat.format(new Date(note.created_at))}
                </p>
                {changesFromNote.has(note.id) && (
                  <p style={{ margin: '0 0 var(--space-2)' }}>
                    <strong>Used to change the recipe</strong> ({nameFor(changesFromNote.get(note.id).version.created_by)},{' '}
                    {dateFormat.format(new Date(changesFromNote.get(note.id).version.created_at))})
                    {changesFromNote.get(note.id).summary && `: ${changesFromNote.get(note.id).summary}`}
                  </p>
                )}
                <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-secondary"
                    type="button"
                    disabled={!online}
                    onClick={() => navigate(`/recipe/${recipe.id}/note/${note.id}`)}
                  >
                    {changesFromNote.has(note.id) ? 'Make another change from it' : 'Turn into a recipe change'}
                  </button>
                  {note.author_id === member.user_id && (
                    <button
                      className="btn btn-secondary"
                      type="button"
                      onClick={async () => {
                        if (window.confirm('Delete this note?')) await deleteNote(note.id)
                      }}
                    >
                      Delete<span className="sr-only"> this note</span>
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
          </>
        )}
      </section>

      {versions.length > 0 && (
        <section aria-labelledby="versions-heading">
          <h2 id="versions-heading">Earlier versions</h2>
          <p className="hint">Each time the recipe is edited, the version before is kept here.</p>
          {versions.map((version) => {
            const snap = version.snapshot ?? {}
            return (
              <details key={version.id} className="card">
                <summary style={{ minHeight: 'var(--target)', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  Before {nameFor(version.created_by)}'s {snap.next_change ? 'change from a note' : 'edit'},{' '}
                  {timeFormat.format(new Date(version.created_at))}
                </summary>
                {snap.next_change?.summary && <p className="hint">The change: {snap.next_change.summary}</p>}
                <p style={{ fontWeight: 600 }}>
                  {snap.recipe?.title} (serves {snap.recipe?.base_servings})
                </p>
                <ul style={{ paddingLeft: 'var(--space-6)' }}>
                  {(snap.ingredients ?? []).map((ing) => (
                    <li key={ing.id}>{ingredientToLine(ing)}</li>
                  ))}
                </ul>
                <ol style={{ paddingLeft: 'var(--space-6)' }}>
                  {(snap.steps ?? []).map((step) => (
                    <li key={step.id}>{step.text}</li>
                  ))}
                </ol>
                <button className="btn btn-secondary" type="button" onClick={() => handleRestore(version)}>
                  Restore this version
                </button>
              </details>
            )
          })}
        </section>
      )}

      {recipe.original_file && (
        <section aria-labelledby="original-heading">
          <h2 id="original-heading">Original</h2>
          {originals === null ? (
            <button
              className="btn btn-secondary"
              type="button"
              disabled={!online}
              onClick={async () => setOriginals(await originalLinks(recipe.original_file))}
            >
              Show the original
            </button>
          ) : originals.length === 0 ? (
            <p className="hint">The original couldn't be loaded.</p>
          ) : (
            originals.map((item, index) =>
              item.isPdf ? (
                <p key={item.url}>
                  <a href={item.url} target="_blank" rel="noreferrer">
                    Open the PDF<span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </p>
              ) : (
                <img
                  key={item.url}
                  src={item.url}
                  alt={`Original recipe, image ${index + 1} of ${originals.length}`}
                  style={{ width: '100%', height: 'auto', display: 'block', marginBottom: 'var(--space-3)', borderRadius: 'var(--radius)' }}
                />
              ),
            )
          )}
          {!online && originals === null && <p className="hint">Connect to the internet to see the original.</p>}
        </section>
      )}

      {recipe.source_url && (
        <p>
          <a href={recipe.source_url} target="_blank" rel="noreferrer">
            Original source<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      )}

      <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', marginTop: 'var(--space-6)' }}>
        <Link className="btn btn-secondary" to={`/recipe/${recipe.id}/edit`}>
          Edit
        </Link>
        <button className="btn btn-secondary" type="button" onClick={handleDelete}>
          Delete
        </button>
      </div>
    </Page>
  )
}
