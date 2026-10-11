import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { addNote, deleteMealLog, deleteRecipe, localDate, logMeal, rateMeal } from '../lib/data'
import { displayIngredient, scaleFactor } from '../lib/units'
import { DEFAULT_SERVINGS } from '../lib/constants'
import { originalLinks } from '../lib/importRecipe'
import { useOnline } from '../lib/useOnline'
import { recipeRatings } from '../lib/stats'
import StarPicker from '../components/StarPicker'

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
// cooked_on is a calendar date; read it as local noon so it never shifts a day.
const formatDay = (day) => dateFormat.format(new Date(`${day}T12:00:00`))
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
    return { recipe, ingredients, steps, notes, members, cookLog, ratings }
  }, [id])

  const [servings, setServings] = useState(DEFAULT_SERVINGS)
  const [showOriginal, setShowOriginal] = useState(false)
  const [system, setSystem] = useState(member.unit_pref ?? 'us')
  const [noteText, setNoteText] = useState('')
  const [originals, setOriginals] = useState(null) // null = not loaded
  const online = useOnline()
  const location = useLocation()
  const finishedSession = location.state?.finishedSession ?? null
  const [logDate, setLogDate] = useState(localDate())
  const [logStars, setLogStars] = useState(null)
  const [logStatus, setLogStatus] = useState('')
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [changingRating, setChangingRating] = useState(null) // cook log id
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

  const { recipe, ingredients, steps, notes, members, cookLog, ratings } = data
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
    await logMeal({ recipeId: recipe.id, cookedOn: logDate, sessionId: finishedSession, stars: logStars }, member)
    setLogStars(null)
    setLogDate(localDate())
    setLogStatus(`Logged for ${formatDay(logDate)}.`)
    // Clear the "just finished" state so a refresh doesn't ask again.
    if (finishedSession) navigate(location.pathname, { replace: true, state: null })
  }

  async function handleDeleteLog(entry) {
    if (!window.confirm(`Remove the ${formatDay(entry.cooked_on)} entry and its ratings?`)) return
    await deleteMealLog(entry.id)
  }

  const summary = recipeRatings(recipe.id, cookLog, ratings)
  const ratedMembers = Object.keys(summary.byMember)
  const history = showAllHistory ? cookLog : cookLog.slice(0, HISTORY_SHOWN)
  const stars = (n) => `${n}★`

  async function handleAddNote(event) {
    event.preventDefault()
    if (!noteText.trim()) return
    await addNote(recipe.id, noteText, member)
    setNoteText('')
  }

  return (
    <Page title={recipe.title}>
      {(recipe.cuisine || recipe.meal_type) && (
        <p className="hint">{[recipe.cuisine, recipe.meal_type].filter(Boolean).join(' · ')}</p>
      )}

      {ratedMembers.length > 0 && (
        <p>
          <strong>{stars(Math.round(summary.average * 10) / 10)}</strong> average (
          {ratedMembers.map((m) => `${nameFor(m)} ${stars(summary.byMember[m])}`).join(', ')})
          {cookLog.length > 0 && ` · made ${cookLog.length} ${cookLog.length === 1 ? 'time' : 'times'}`}
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
          {finishedSession ? 'How was it?' : 'Cook log'}
        </h2>
        <form onSubmit={handleLogMeal} className="card">
          <div className="field">
            <label htmlFor="cooked-on">{finishedSession ? 'Date' : 'We made this on'}</label>
            <input
              id="cooked-on"
              type="date"
              value={logDate}
              max={localDate()}
              required
              onChange={(e) => setLogDate(e.target.value)}
            />
          </div>
          <StarPicker legend="Your rating (optional)" value={logStars} onChange={setLogStars} />
          <p className="hint">Each of you rates on your own phone. The average uses both.</p>
          <button className="btn" type="submit" disabled={!logDate}>
            {finishedSession ? 'Log this meal' : 'We made this'}
          </button>
          <p role="status" className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
            {logStatus}
          </p>
        </form>

        {cookLog.length === 0 ? (
          <p className="hint">Not made yet.</p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {history.map((entry) => {
              const entryRatings = ratings.filter((r) => r.cook_log_id === entry.id)
              const mine = entryRatings.find((r) => r.member_id === member.user_id)
              const others = entryRatings.filter((r) => r.member_id !== member.user_id)
              const picking = !mine || changingRating === entry.id
              return (
                <li key={entry.id} className="card">
                  <p style={{ fontWeight: 600, margin: 0 }}>{formatDay(entry.cooked_on)}</p>
                  <p className="hint">Logged by {nameFor(entry.created_by)}</p>
                  <p style={{ margin: '0 0 var(--space-2)' }}>
                    You: {mine ? stars(mine.stars) : 'not rated yet'}
                    {others.map((r) => ` · ${nameFor(r.member_id)}: ${stars(r.stars)}`)}
                  </p>
                  {picking ? (
                    <StarPicker
                      legend={mine ? 'Change your rating' : 'Add your rating'}
                      value={mine?.stars ?? null}
                      onChange={async (n) => {
                        await rateMeal(entry.id, n, member)
                        setChangingRating(null)
                      }}
                    />
                  ) : (
                    <button className="btn btn-secondary" type="button" onClick={() => setChangingRating(entry.id)}>
                      Change your rating
                    </button>
                  )}{' '}
                  <button className="btn btn-secondary" type="button" onClick={() => handleDeleteLog(entry)}>
                    Remove<span className="sr-only"> the {formatDay(entry.cooked_on)} entry</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
        {cookLog.length > HISTORY_SHOWN && !showAllHistory && (
          <button className="btn btn-secondary" type="button" onClick={() => setShowAllHistory(true)}>
            Show all {cookLog.length}
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
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {notes.map((note) => (
              <li key={note.id} className="card">
                <p style={{ margin: 0 }}>{note.body}</p>
                <p className="hint" style={{ margin: 0 }}>
                  {nameFor(note.author_id)}, {dateFormat.format(new Date(note.created_at))}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

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
