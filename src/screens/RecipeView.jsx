import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import { groupBySection } from '../lib/ingredients'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { deleteMealLog, deleteRecipe, localDate, logMeal, rateRecipe } from '../lib/data'
import Notes, { notesSummary } from '../components/Notes'
import { useKitchenPeople } from '../lib/useKitchen'
import { displayIngredient, scaleFactor } from '../lib/units'
import { DEFAULT_SERVINGS } from '../lib/constants'
import { useOnline } from '../lib/useOnline'
import { groupMeals, ratingIsStale, recipeRatings, timeSummary } from '../lib/stats'
import StarPicker from '../components/StarPicker'
import StepText from '../components/StepText'
import NutritionPanel from '../components/NutritionPanel'
import { AddPhoto, PhotoThumb } from '../components/MealPhotos'
import PhotoCarousel from '../components/PhotoCarousel'
import MealDetails from '../components/MealDetails'
import Icon from '../components/Icon'
import { newestFirst, PHOTOS_PER_COOK, removeMealPhotos } from '../lib/photos'

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

// One part of the recipe page that opens and closes. The heading sits in
// the summary, so the outline still reads Ingredients, Nutrition, Steps.
function Section({ id: sectionId, title, note, open, headingRef, children }) {
  return (
    <details className="sec" open={open || undefined} id={sectionId}>
      <summary>
        <span className="sec-title">
          <h2 ref={headingRef} tabIndex={headingRef ? -1 : undefined}>
            {title}
          </h2>
          {note && <span className="sec-note">{note}</span>}
        </span>
        <span className="chev" aria-hidden="true">
          <Icon name="chevron" size={22} />
        </span>
      </summary>
      <div className="sec-body">{children}</div>
    </details>
  )
}

export default function RecipeView() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { member } = useAuth()
  const people = useKitchenPeople(member.user_id)

  const data = useLiveQuery(async () => {
    const recipe = await db.recipes.get(id)
    if (!recipe) return { recipe: null }
    const [ingredients, steps, notes, members, cookLog, photos] = await Promise.all([
      db.ingredients.where('recipe_id').equals(id).sortBy('position'),
      db.steps.where('recipe_id').equals(id).sortBy('position'),
      db.notes.where('recipe_id').equals(id).sortBy('created_at'),
      db.members.toArray(),
      db.cook_log.where('recipe_id').equals(id).toArray(),
      db.meal_photos.where('recipe_id').equals(id).toArray(),
    ])
    cookLog.sort((a, b) => b.cooked_on.localeCompare(a.cooked_on) || (b.created_at ?? '').localeCompare(a.created_at ?? ''))
    const ratings = await db.ratings.where('cook_log_id').anyOf(cookLog.map((c) => c.id)).toArray()
    // Short records of which notes changed this recipe (no recipe copies).
    const changeRecords = await db.recipe_versions.where('recipe_id').equals(id).toArray()
    const likes = await db.note_likes.where('note_id').anyOf(notes.map((n) => n.id)).toArray()
    return { recipe, ingredients, steps, notes, likes, members, cookLog, ratings, changeRecords, photos: newestFirst(photos) }
  }, [id])

  const [servings, setServings] = useState(DEFAULT_SERVINGS)
  // Units come from Settings (chosen when setting up).
  const system = member.unit_pref === 'metric' ? 'metric' : 'us'
  const online = useOnline()
  const location = useLocation()
  // Set when cooking mode's Finish just logged today's meal.
  const [finishedCooking] = useState(location.state?.finishedCooking ?? null)
  const [message] = useState(location.state?.message ?? '')
  const [logDate, setLogDate] = useState(localDate())
  const [logStars, setLogStars] = useState(null)
  const [logStatus, setLogStatus] = useState(() =>
    finishedCooking
      ? finishedCooking.alreadyLogged
        ? `${formatDay(finishedCooking.day)} was already logged.`
        : `Logged ${formatDay(finishedCooking.day)}.`
      : '',
  )
  const [showAllHistory, setShowAllHistory] = useState(false)
  const [changingRating, setChangingRating] = useState(false)
  const [ratingStatus, setRatingStatus] = useState('')
  const [photoStatus, setPhotoStatus] = useState(null) // { text, error? }
  const logHeadingRef = useRef(null)
  const loaded = Boolean(data?.recipe)

  // Coming back from cooking mode: go straight to "How was it?", and clear
  // the state so a refresh doesn't ask again.
  useEffect(() => {
    if (finishedCooking && loaded) {
      logHeadingRef.current?.focus()
      logHeadingRef.current?.scrollIntoView({ block: 'start' })
      navigate(location.pathname, { replace: true, state: null })
    }
  }, [finishedCooking, loaded, navigate, location.pathname])

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
        <p>This recipe was deleted or isn’t on this phone yet.</p>
        <Link className="btn" to="/">
          Back to Recipes
        </Link>
      </Page>
    )
  }

  const { recipe, ingredients, steps, notes, likes, members, cookLog, ratings, changeRecords, photos } = data
  // Which notes led to a recipe change (kept with the version saved then).
  const changesFromNote = new Map()
  for (const version of changeRecords) {
    const change = version.snapshot?.next_change
    if (change?.note_id && !changesFromNote.has(change.note_id)) changesFromNote.set(change.note_id, { ...change, version })
  }
  const shownServings = servings
  const factor = scaleFactor(recipe.base_servings, shownServings)
  const nameFor = (userId) => members.find((m) => m.user_id === userId)?.display_name ?? 'A former cook'
  const photoBy = (photo) => (photo.added_by === member.user_id ? 'You' : nameFor(photo.added_by))
  const photosFor = (day) => photos.filter((p) => p.cooked_on === day)
  const myPhotoOn = (day) => photosFor(day).some((p) => p.added_by === member.user_id)

  async function handleDelete() {
    if (!window.confirm(`Delete "${recipe.title}"? It stays in Recently Deleted in Settings for 30 days.`)) return
    await deleteRecipe(recipe.id, member)
    navigate('/', { replace: true })
  }

  async function handleLogMeal(event) {
    event.preventDefault()
    // A first rating can be given with the first log; after that, the
    // rating carries over and is changed in Ratings.
    const result = await logMeal({ recipeId: recipe.id, cookedOn: logDate, stars: meals.length === 0 ? logStars : null, servings: shownServings }, member)
    setLogStars(null)
    setLogDate(localDate())
    setLogStatus(result.alreadyLogged ? `${formatDay(logDate)} was already logged.` : `Logged ${formatDay(logDate)}.`)
  }

  async function handleDeleteLog(meal) {
    const othersHere = [
      ...new Set(ratings.filter((r) => meal.ids.includes(r.cook_log_id) && r.member_id !== member.user_id).map((r) => nameFor(r.member_id))),
    ]
    const warning = othersHere.length
      ? ` ${othersHere.join(' and ')}’s rating is saved with this entry and will be removed; they can rate again.`
      : ' Your rating stays.'
    const mealPhotos = photosFor(meal.cooked_on)
    const photoWarning = mealPhotos.length ? ` Its ${mealPhotos.length === 1 ? 'photo is' : 'photos are'} removed too.` : ''
    if (!window.confirm(`Remove ${formatDay(meal.cooked_on)} from the cook log?${warning}${photoWarning}`)) return
    await deleteMealLog(meal.ids, member)
    await removeMealPhotos(mealPhotos)
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
  const history = showAllHistory ? meals : meals.slice(0, HISTORY_SHOWN)
  const sameDay = meals.find((m) => m.cooked_on === logDate)
  // Ratings belong to the recipe. One goes stale only if the recipe was
  // edited after it was given.
  // When the ingredients or steps were last saved (every save stamps them).
  const lastChangedAt = [...ingredients, ...steps].reduce((latest, row) => (row.updated_at > latest ? row.updated_at : latest), '') || null
  const myStars = summary.byMember[member.user_id]
  const myStale = ratingIsStale(summary.ratedAt[member.user_id], lastChangedAt)
  const loggedByNames = (meal) => [...new Set(meal.entries.map((e) => nameFor(e.created_by)))].join(' and ')
  const stars = (n) => `${n}★`

  // Each cook can add 3 photos to a recipe. The Add photo slide adds to the
  // latest meal and says how many you have left.
  const photosLeft = PHOTOS_PER_COOK - photos.filter((p) => p.added_by === member.user_id).length
  const addPhotoDay = meals[0]?.cooked_on ?? null
  const ratingNote = [
    ...ratedMembers.map((m) => `${m === member.user_id ? 'You' : nameFor(m)} ${stars(summary.byMember[m])}`),
    meals.length > 0 ? `made ${meals.length}×` : 'not made yet',
  ].join(' · ')
  const nutritionNote = (() => {
    if (!recipe.nutrition?.items?.length) return null
    const per = (key) => recipe.nutrition.items.reduce((sum, item) => sum + (Number(item[key]) || 0), 0) / (Number(recipe.base_servings) || 1)
    return `${Math.round(per('calories'))} cal · ${Math.round(per('protein_g'))} g protein per serving`
  })()

  return (
    <Page
      title={recipe.title}
      subtitle={
        (recipe.cuisine || recipe.meal_type) && (
          <>
            <Icon name="globe" size={18} />
            {[recipe.cuisine, recipe.meal_type].filter(Boolean).join(' · ')}
          </>
        )
      }
    >
      <p role="status" style={message ? undefined : { margin: 0 }}>
        {message && <strong>{message}</strong>}
      </p>
      <PhotoCarousel
        recipe={recipe}
        photos={photos}
        photoBy={photoBy}
        addDay={addPhotoDay}
        photosLeft={photosLeft}
        member={member}
        onStatus={setPhotoStatus}
      />
      <ul className="facts">
        {ratedMembers.length > 0 && (
          <li>
            <Icon name="star" size={18} />
            <strong>{Math.round(summary.average * 10) / 10}</strong>
            <span className="sr-only"> average rating</span>
          </li>
        )}
        {meals.length > 0 && (
          <li>
            <Icon name="repeat" size={18} />
            Made {meals.length}×
          </li>
        )}
        {timeSummary(recipe) && (
          <li>
            <Icon name="clock" size={18} />
            {timeSummary(recipe)}
          </li>
        )}
      </ul>

      <section aria-labelledby="servings-heading">
        <h2 id="servings-heading" className="sr-only">
          Servings
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
        </div>
        {recipe.base_servings && Number(recipe.base_servings) !== servings && (
          <p className="hint" style={{ margin: 0 }}>
            Written for {recipe.base_servings}.{' '}
            <button className="link-btn" type="button" onClick={() => setServings(Number(recipe.base_servings))}>
              Make {recipe.base_servings}
            </button>
          </p>
        )}
      </section>

      {steps.length > 0 && (
        <div className="cook-actions">
          <Link className="btn" to={`/recipe/${recipe.id}/cook?servings=${shownServings}`}>
            <Icon name="play" size={18} />
            Start cooking
          </Link>
          {steps.length > 1 && (
            <Link className="btn btn-secondary" to={`/recipe/${recipe.id}/two-chef?servings=${shownServings}`}>
              <Icon name="users" size={18} />
              Two chefs
            </Link>
          )}
        </div>
      )}

      <Section id="ingredients" title="Ingredients" open>
        {groupBySection(ingredients).map((group) => (
          <div key={group.section ?? 'main'}>
            {group.section && <h3 className="ingredient-section">{group.section}</h3>}
            <ul style={{ paddingLeft: 'var(--space-4)' }}>
              {group.items.map((ing) => {
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
          </div>
        ))}
      </Section>

      <Section id="nutrition" title="Nutrition" note={nutritionNote}>
        <NutritionPanel recipe={recipe} ingredients={ingredients} member={member} online={online} shownServings={shownServings} headless />
      </Section>

      <Section id="steps" title="Steps" open>
        {steps.length === 0 ? (
          <p className="hint">No steps yet.</p>
        ) : (
          <ol>
            {steps.map((step) => (
              <li key={step.id} style={{ marginBottom: 'var(--space-3)' }}>
                <StepText text={step.text} ingredients={ingredients} factor={factor} system={system} />
              </li>
            ))}
          </ol>
        )}
        {factor !== 1 && (
          <p className="hint">
            Amounts are scaled. Times and pan sizes aren’t.
          </p>
        )}
      </Section>

      <Section
        id="rating"
        title={finishedCooking ? 'How was it?' : 'Rating and cook log'}
        note={finishedCooking ? null : ratingNote}
        open={Boolean(finishedCooking) || meals.length === 0}
        headingRef={logHeadingRef}
      >
        {meals.length === 0 ? (
          <p className="hint">Rate it once you’ve made it.</p>
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
              You <strong>{stars(myStars)}</strong>
              {ratedMembers
                .filter((m) => m !== member.user_id)
                .map((m) => (
                  <span key={m} className="hint">
                    {' '}
                    · {nameFor(m)} {stars(summary.byMember[m])}
                  </span>
                ))}
            </p>
            <button className="link-btn" type="button" onClick={() => setChangingRating(true)}>
              Change rating
            </button>
          </div>
        )}
        <p role="status" className="hint" style={{ margin: 0 }}>
          {ratingStatus}
        </p>

        {finishedCooking && !myPhotoOn(finishedCooking.day) && photosLeft > 0 && (
          <div className="photo-prompt">
            <AddPhoto
              recipeId={recipe.id}
              cookedOn={finishedCooking.day}
              member={member}
              label="Add a photo of how it turned out"
              className="btn btn-secondary"
              onStatus={setPhotoStatus}
            />
          </div>
        )}

        <h3 className="subheading">Cook log</h3>
        {!(recipe.total_time_minutes > 0) && (
          <p className="hint" style={{ marginTop: 0 }}>
            No total time, so it won’t count toward time together. <Link to={`/recipe/${recipe.id}/edit`}>Add one</Link>
          </p>
        )}
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
            <button className="btn" type="submit">
              Add to log
            </button>
          </div>
          {sameDay && !logStatus && (
            <p className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
              {loggedByNames(sameDay)} already logged {formatDay(logDate)}.
            </p>
          )}
          <p role="status" className="hint" style={{ margin: logStatus ? 'var(--space-2) 0 0' : 0 }}>
            {logStatus}
          </p>
        </form>

        <p role="status" className={photoStatus?.error ? 'error' : 'hint'} style={{ margin: photoStatus ? 'var(--space-2) 0 0' : 0 }}>
          {photoStatus?.text}
        </p>
        {meals.length === 0 ? (
          <p className="hint">Not made yet.</p>
        ) : (
          <ul className="plain-list divided">
            {history.map((meal) => (
              <li key={meal.key}>
                <span>
                  <span style={{ display: 'block', fontWeight: 600 }}>
                    {formatDay(meal.cooked_on)} <span className="hint" style={{ fontWeight: 400 }}>· {loggedByNames(meal)}</span>
                  </span>
                  <MealDetails recipe={recipe} meal={meal} changes={notes.filter((n) => n.cooked_on === meal.cooked_on)} online={online} />
                  <span className="meal-photos">
                    {photosFor(meal.cooked_on).map((photo) => (
                      <PhotoThumb key={photo.id} photo={photo} recipeTitle={recipe.title} byName={photoBy(photo)} onStatus={setPhotoStatus} />
                    ))}
                    {photosLeft > 0 && (
                      <AddPhoto recipeId={recipe.id} cookedOn={meal.cooked_on} member={member} label="Add photo" onStatus={setPhotoStatus} />
                    )}
                  </span>
                </span>
                <button className="link-btn" type="button" onClick={() => handleDeleteLog(meal)}>
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
      </Section>

      <Section id="notes" title="Notes" note={notesSummary(notes)} open>
        <Notes
          recipe={recipe}
          notes={notes}
          likes={likes}
          member={member}
          people={people}
          nameFor={nameFor}
          changesFromNote={changesFromNote}
          online={online}
        />
      </Section>

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
        <button className="btn btn-secondary" type="button" onClick={handleDelete}>
          Delete
        </button>
        <Link className="btn btn-secondary" to={`/recipe/${recipe.id}/edit`}>
          Edit
        </Link>
      </div>
    </Page>
  )
}
