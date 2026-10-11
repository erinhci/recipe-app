import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { addCookingTime, addNote, deleteCookingSessions, deleteMealLog, deleteNote, deleteRecipe, localDate, logMeal, rateRecipe } from '../lib/data'
import { displayIngredient, scaleFactor } from '../lib/units'
import { DEFAULT_SERVINGS } from '../lib/constants'
import { useOnline } from '../lib/useOnline'
import { formatMinutes, groupMeals, ratingIsStale, recipeRatings, sessionsByDay } from '../lib/stats'
import StarPicker from '../components/StarPicker'
import NutritionPanel from '../components/NutritionPanel'

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
// cooked_on is a calendar date; read it as local noon so it never shifts a day.
const formatDay = (day) => dateFormat.format(new Date(`${day}T12:00:00`))
const HISTORY_SHOWN = 10
// "https://www.justonecookbook.com/..." -> "justonecookbook.com"
const siteName = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'Original source'
  }
}
const shortDate = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

export default function RecipeView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member } = useAuth()

  const data = useLiveQuery(async () => {
    const recipe = await db.recipes.get(id)
    if (!recipe) return { recipe: null }
    const [ingredients, steps, notes, members, cookLog, sessions] = await Promise.all([
      db.ingredients.where('recipe_id').equals(id).sortBy('position'),
      db.steps.where('recipe_id').equals(id).sortBy('position'),
      db.notes.where('recipe_id').equals(id).sortBy('created_at'),
      db.members.toArray(),
      db.cook_log.where('recipe_id').equals(id).toArray(),
      db.cooking_sessions.where('recipe_id').equals(id).toArray(),
    ])
    cookLog.sort((a, b) => b.cooked_on.localeCompare(a.cooked_on) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    const ratings = await db.ratings.where('cook_log_id').anyOf(cookLog.map((c) => c.id)).toArray()
    // Short records of which notes changed this recipe (no recipe copies).
    const changeRecords = await db.recipe_versions.where('recipe_id').equals(id).toArray()
    return { recipe, ingredients, steps, notes, members, cookLog, ratings, changeRecords, sessions }
  }, [id])

  const [servings, setServings] = useState(DEFAULT_SERVINGS)
  const [system, setSystem] = useState(member.unit_pref ?? 'us')
  const [noteText, setNoteText] = useState('')
  const online = useOnline()
  const location = useLocation()
  const finishedSession = location.state?.finishedSession ?? null
  const [message] = useState(location.state?.message ?? '')
  const [logDate, setLogDate] = useState(localDate())
  const [logStars, setLogStars] = useState(null)
  const [logMinutes, setLogMinutes] = useState('')
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

  const { recipe, ingredients, steps, notes, members, cookLog, ratings, changeRecords, sessions } = data
  // Which notes led to a recipe change (kept with the version saved then).
  const changesFromNote = new Map()
  for (const version of changeRecords) {
    const change = version.snapshot?.next_change
    if (change?.note_id && !changesFromNote.has(change.note_id)) changesFromNote.set(change.note_id, { ...change, version })
  }
  const shownServings = servings
  const factor = scaleFactor(recipe.base_servings, shownServings)
  const nameFor = (userId) => members.find((m) => m.user_id === userId)?.display_name ?? 'A former cook'

  async function handleDelete() {
    if (!window.confirm(`Delete "${recipe.title}"? It stays in Recently Deleted in Settings for 30 days.`)) return
    await deleteRecipe(recipe.id, member)
    navigate('/', { replace: true })
  }

  async function handleLogMeal(event) {
    event.preventDefault()
    const minutes = Number(logMinutes) || 0
    let text
    if (sameDay) {
      // Already logged: only the time is added.
      text = `Added ${formatMinutes(minutes)} to ${formatDay(logDate)}.`
    } else {
      // A first rating can be given with the first log; after that, the
      // rating carries over and is changed in Your rating.
      await logMeal(
        { recipeId: recipe.id, cookedOn: logDate, sessionId: finishedSession, stars: meals.length === 0 ? logStars : null },
        member,
      )
      text = `Logged ${formatDay(logDate)}${minutes ? `, ${formatMinutes(minutes)}` : ''}.`
    }
    if (minutes) await addCookingTime({ recipeId: recipe.id, cookedOn: logDate, minutes }, member)
    setLogStars(null)
    setLogMinutes('')
    setLogDate(localDate())
    setLogStatus(text)
    // Clear the "just finished" state so a refresh doesn't ask again.
    if (finishedSession) navigate(location.pathname, { replace: true, state: null })
  }

  async function handleRemoveTime(row) {
    if (!window.confirm(`Remove ${formatMinutes(row.minutes)} of cooking time from ${formatDay(row.day)}? Stats will count it out.`)) return
    await deleteCookingSessions(row.sessionIds)
  }

  async function handleDeleteLog(meal) {
    const othersHere = [
      ...new Set(ratings.filter((r) => meal.ids.includes(r.cook_log_id) && r.member_id !== member.user_id).map((r) => nameFor(r.member_id))),
    ]
    const warning = othersHere.length
      ? ` ${othersHere.join(' and ')}'s rating is saved with this entry and will be removed; they can rate again.`
      : ' Your rating stays.'
    const time = timeByDay.get(meal.cooked_on)
    const timeNote = time ? ` Its ${formatMinutes(time.minutes)} of cooking time is removed too.` : ''
    if (!window.confirm(`Remove ${formatDay(meal.cooked_on)} from the cook log?${warning}${timeNote}`)) return
    await deleteMealLog(meal.ids, member)
    if (time) await deleteCookingSessions(time.ids)
  }

  async function handleRate(n) {
    await rateRecipe(recipe.id, n, member)
    setChangingRating(false)
    setRatingStatus(`Your rating is ${n}★.`)
  }

  // Re-saving the same stars marks the rating as current for this
  // version of the recipe, so the "rate it again?" question goes away.
  async function handleKeepRating() {
    await rateRecipe(recipe.id, myStars, member)
    setRatingStatus(`Kept your ${myStars}★.`)
  }

  const summary = recipeRatings(recipe.id, cookLog, ratings)
  // You first, then the other cook.
  const ratedMembers = Object.keys(summary.byMember).sort((a, b) => (b === member.user_id) - (a === member.user_id))
  // Both cooks logging the same dinner is one meal.
  const meals = groupMeals(cookLog)
  // Cooking time by day. Days with time but no logged meal (cooking mode
  // opened without logging) get their own row so the time can be seen
  // and removed.
  const timeByDay = sessionsByDay(sessions)
  const loggedDays = new Set(meals.map((m) => m.cooked_on))
  const rows = [
    ...meals.map((meal) => ({ key: meal.key, day: meal.cooked_on, meal })),
    ...[...timeByDay.keys()].filter((day) => !loggedDays.has(day)).map((day) => ({ key: `time-${day}`, day, meal: null })),
  ]
    .map((row) => ({ ...row, sessionIds: timeByDay.get(row.day)?.ids ?? [], minutes: timeByDay.get(row.day)?.minutes ?? 0 }))
    .sort((a, b) => b.day.localeCompare(a.day))
  const history = showAllHistory ? rows : rows.slice(0, HISTORY_SHOWN)
  const sameDay = meals.find((m) => m.cooked_on === logDate)
  // Ratings belong to the recipe. One goes stale only if the recipe was
  // edited after it was given.
  // When the ingredients or steps were last saved (every save stamps them).
  const lastChangedAt = [...ingredients, ...steps].reduce((latest, row) => (row.updated_at > latest ? row.updated_at : latest), '') || null
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

      {(ratedMembers.length > 0 || meals.length > 0) && (
        <p>
          {ratedMembers.length > 0 && (
            <>
              <strong>{stars(Math.round(summary.average * 10) / 10)}</strong> average (
              {ratedMembers.map((m) => `${nameFor(m)} ${stars(summary.byMember[m])}`).join(', ')})
            </>
          )}
          {ratedMembers.length > 0 && meals.length > 0 && ' · '}
          {meals.length > 0 && `made ${meals.length} ${meals.length === 1 ? 'time' : 'times'}`}
        </p>
      )}

      <section aria-labelledby="servings-heading">
        <h2 id="servings-heading" className="sr-only">
          Servings and units
        </h2>
        <div className="row-between">
          <div className="stepper">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setServings((s) => Math.max(1, s - 1))}
              disabled={servings <= 1}
              aria-label="One fewer serving"
            >
              −
            </button>
            <p style={{ margin: 0, fontWeight: 600 }} aria-live="polite">
              {servings} {Number(servings) === 1 ? 'serving' : 'servings'}
            </p>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setServings((s) => s + 1)}
              aria-label="One more serving"
            >
              +
            </button>
          </div>
          <fieldset className="choices">
            <legend className="sr-only">Units</legend>
            {[
              ['us', 'US'],
              ['metric', 'Metric'],
            ].map(([value, label]) => (
              <label key={value} className="choice">
                <input
                  type="radio"
                  name="units"
                  value={value}
                  checked={system === value}
                  onChange={() => setSystem(value)}
                />
                {label}
              </label>
            ))}
          </fieldset>
        </div>
        {recipe.base_servings && Number(recipe.base_servings) !== servings && (
          <p className="hint" style={{ margin: 0 }}>
            The recipe as written makes {recipe.base_servings}.{' '}
            <button className="link-btn" type="button" onClick={() => setServings(Number(recipe.base_servings))}>
              Make {recipe.base_servings}
            </button>
          </p>
        )}
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
          <ol>
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
          {finishedSession ? 'How was it?' : 'Your rating'}
        </h2>
        {meals.length === 0 ? (
          <p className="hint">Rate it after the first time you make it. Log that below.</p>
        ) : myStars === undefined || changingRating ? (
          <>
            <StarPicker
              legend={myStars === undefined ? 'Your rating' : 'New rating'}
              hideLegend
              value={myStars ?? null}
              onChange={handleRate}
            />
            {changingRating ? (
              <button className="link-btn" type="button" onClick={() => setChangingRating(false)}>
                Cancel
              </button>
            ) : (
              <p className="hint" style={{ margin: 0 }}>
                It carries over each time you make it.
              </p>
            )}
          </>
        ) : myStale ? (
          <div className="flagged">
            <p style={{ margin: 0 }}>
              You gave it <strong>{stars(myStars)}</strong> before the recipe changed.
            </p>
            <div className="comment-actions">
              <button className="link-btn" type="button" onClick={handleKeepRating}>
                Keep {stars(myStars)}
              </button>
              <button className="link-btn" type="button" onClick={() => setChangingRating(true)}>
                Change rating
              </button>
            </div>
          </div>
        ) : (
          <div className="row-between">
            <p style={{ margin: 0 }}>
              You gave it <strong>{stars(myStars)}</strong>
            </p>
            <button className="link-btn" type="button" onClick={() => setChangingRating(true)}>
              Change rating
            </button>
          </div>
        )}
        <p role="status" className="hint" style={{ margin: 0 }}>
          {ratingStatus}
        </p>

        <h3 className="subheading">Cook log</h3>
        <form onSubmit={handleLogMeal}>
          {meals.length === 0 && <StarPicker legend="Your rating (optional)" value={logStars} onChange={setLogStars} />}
          <div className="inline-form">
            <div className="field">
              <label htmlFor="cooked-on">Date made</label>
              <input
                id="cooked-on"
                type="date"
                value={logDate}
                max={localDate()}
                required
                onChange={(e) => {
                  setLogDate(e.target.value)
                  setLogStatus('')
                }}
              />
            </div>
            {!finishedSession && (
              <div className="field">
                <label htmlFor="cook-minutes">Minutes cooking</label>
                <input
                  id="cook-minutes"
                  type="number"
                  inputMode="numeric"
                  min="1"
                  max="240"
                  value={logMinutes}
                  aria-describedby="cook-minutes-hint"
                  onChange={(e) => {
                    setLogMinutes(e.target.value)
                    setLogStatus('')
                  }}
                />
              </div>
            )}
            <button className="btn" type="submit" disabled={!logDate || (Boolean(sameDay) && !Number(logMinutes))}>
              {sameDay && Number(logMinutes) ? 'Add time' : 'Add to log'}
            </button>
          </div>
          {!finishedSession && (
            <p id="cook-minutes-hint" className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
              Minutes are optional. They count toward time cooking together in Stats.
            </p>
          )}
          {sameDay && !logStatus && (
            <p className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
              {loggedByNames(sameDay)} already logged {formatDay(logDate)}. You can still add minutes.
            </p>
          )}
          <p role="status" className="hint" style={{ margin: logStatus ? 'var(--space-2) 0 0' : 0 }}>
            {logStatus}
          </p>
        </form>

        {rows.length === 0 ? (
          <p className="hint">Not made yet.</p>
        ) : (
          <ul className="plain-list divided">
            {history.map((row) => (
              <li key={row.key}>
                <span>
                  <span style={{ display: 'block' }}>{formatDay(row.day)}</span>
                  <span className="hint" style={{ display: 'block' }}>
                    {[
                      row.sessionIds.length > 0 && formatMinutes(row.minutes),
                      row.meal ? `logged by ${loggedByNames(row.meal)}` : 'cooking mode, not logged',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <span className="row-actions">
                  {row.meal && row.sessionIds.length > 0 && (
                    <button className="link-btn" type="button" onClick={() => handleRemoveTime(row)}>
                      Remove time<span className="sr-only"> from {formatDay(row.day)}</span>
                    </button>
                  )}
                  <button
                    className="link-btn"
                    type="button"
                    onClick={() => (row.meal ? handleDeleteLog(row.meal) : handleRemoveTime(row))}
                  >
                    Remove<span className="sr-only"> {formatDay(row.day)}</span>
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        {rows.length > HISTORY_SHOWN && !showAllHistory && (
          <button className="btn btn-secondary" type="button" onClick={() => setShowAllHistory(true)}>
            Show all {rows.length}
          </button>
        )}
      </section>

      <section aria-labelledby="notes-heading">
        <h2 id="notes-heading">Notes</h2>
        {notes.length === 0 ? (
          <p className="hint">No notes yet. Leave one for next time, like what you'd change.</p>
        ) : (
          <ul className="comments">
            {notes.map((note) => {
              const mine = note.author_id === member.user_id
              const used = changesFromNote.get(note.id)
              // Notes the app used to post after a change ("Changed the recipe
              // from ..."). They describe a change already made, so they get
              // no "Turn into a recipe change".
              const appNote = /^Changed the recipe from .+'s note:/.test(note.body)
              const name = nameFor(note.author_id)
              const deleteButton = mine && (
                <button
                  className="link-btn"
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Delete this note?')) await deleteNote(note.id)
                  }}
                >
                  Delete<span className="sr-only"> this note</span>
                </button>
              )
              if (appNote) {
                return (
                  <li key={note.id} className="comment comment-app">
                    <p className="hint" style={{ margin: 0 }}>
                      {note.body.replace(/^Changed the recipe from .+?'s note: /, 'Recipe updated: ')} ·{' '}
                      {shortDate.format(new Date(note.created_at))}
                    </p>
                    {deleteButton && <div className="comment-actions">{deleteButton}</div>}
                  </li>
                )
              }
              return (
                <li key={note.id} className="comment">
                  <span className="avatar" aria-hidden="true">
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="comment-body">
                    <p className="comment-meta">
                      <strong>{name}</strong> <span className="hint">{shortDate.format(new Date(note.created_at))}</span>
                    </p>
                    <p style={{ margin: 0 }}>{note.body}</p>
                    {used && (
                      <p className="hint" style={{ margin: 'var(--space-1) 0 0' }}>
                        ✓ Used to change the recipe{used.summary ? `: ${used.summary}` : ''} ({nameFor(used.version.created_by)},{' '}
                        {shortDate.format(new Date(used.version.created_at))})
                      </p>
                    )}
                    <div className="comment-actions">
                      {!used && (
                        <button
                          className="link-btn"
                          type="button"
                          disabled={!online}
                          onClick={() => navigate(`/recipe/${recipe.id}/note/${note.id}`)}
                        >
                          Turn into a recipe change
                        </button>
                      )}
                      {deleteButton}
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {!online && notes.length > 0 && <p className="hint">Turning a note into a recipe change needs the internet.</p>}
        <form onSubmit={handleAddNote} className="comment-form">
          <label htmlFor="note" className="sr-only">
            Add a note
          </label>
          <textarea
            id="note"
            rows={2}
            placeholder="Add a note…"
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <button className="btn" type="submit" disabled={!noteText.trim()}>
            Post
          </button>
        </form>
      </section>

      {(recipe.source_name || recipe.source_url) && (
        <p>
          From{' '}
          {recipe.source_url ? (
            <a href={recipe.source_url} target="_blank" rel="noreferrer">
              {recipe.source_name || siteName(recipe.source_url)}
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : (
            recipe.source_name
          )}
        </p>
      )}

      <div className="actions">
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
