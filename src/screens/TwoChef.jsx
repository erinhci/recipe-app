import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import Working from '../components/Working'
import StepText from '../components/StepText'
import ServingsBar from '../components/ServingsBar'
import AskStep from '../components/AskStep'
import ChangeLog from '../components/ChangeLog'
import { useScrollFocus } from '../lib/useScrollFocus'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { localDate, logMeal, saveChefSplit } from '../lib/data'
import { formatMinutes, timeSummary } from '../lib/stats'
import Icon from '../components/Icon'
import { AllIngredients, NutritionPeek, OtherTimers, StepNeeds, StepTimer } from '../components/CookParts'
import { useStepTimers } from '../lib/stepTimer'
import { useKitchenPeople } from '../lib/useKitchen'
import { AvatarFace } from '../components/Avatar'
import { scaleFactor } from '../lib/units'
import { ingredientLine, ingredientsForStep } from '../lib/cooking'
import { prepSuggestions } from '../lib/prepSteps'
import { invokeFunction } from '../lib/functions'
import { useOnline } from '../lib/useOnline'
import { useWakeLock } from '../lib/useWakeLock'
import { DEFAULT_SERVINGS } from '../lib/constants'
import { catchUpIds, currentOn, listNumbers, meetAt, nextFor, otherSide, sideOf, splitIsCurrent, stepStates } from '../lib/twoChef'
import { claimChef, endCook, fetchCook, moveStep, setServings, setStepsDone, startCook, swapChefs, watchCook } from '../lib/twoChefLive'

// How often to re-read the shared cook as a backup to live updates.
const POLL_MS = 5000
const emptyCook = () => ({ id: null, chef_a: null, chef_b: null, done_steps: [], moved_steps: {} })

// This phone's own pick when there's no live cook (offline) or when one
// phone runs both parts. Kept for the browser tab only.
// The first sentence of a step, cut to a short line for reminders.
function shortStep(text) {
  const first = String(text).split(/(?<=[.!?])\s/)[0]
  return first.length > 70 ? `${first.slice(0, 67).trimEnd()}…` : first
}

function readLocal(recipeId) {
  try {
    return JSON.parse(sessionStorage.getItem(`two-chef:${recipeId}`) ?? 'null')
  } catch {
    return null
  }
}
function writeLocal(recipeId, value) {
  try {
    if (value) sessionStorage.setItem(`two-chef:${recipeId}`, JSON.stringify(value))
    else sessionStorage.removeItem(`two-chef:${recipeId}`)
  } catch {
    // Storage unavailable; the pick lasts until the page closes.
  }
}

export default function TwoChef() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { member } = useAuth()
  const online = useOnline()
  const wakeLock = useWakeLock()
  const timers = useStepTimers()
  const people = useKitchenPeople(member.user_id)
  const urlServings = Number(params.get('servings')) || DEFAULT_SERVINGS
  const system = member.unit_pref === 'metric' ? 'metric' : 'us'

  const data = useLiveQuery(async () => {
    const recipe = await db.recipes.get(id)
    if (!recipe) return { recipe: null }
    const [ingredients, steps, members] = await Promise.all([
      db.ingredients.where('recipe_id').equals(id).sortBy('position'),
      db.steps.where('recipe_id').equals(id).sortBy('position'),
      db.members.toArray(),
    ])
    return { recipe, ingredients, steps, members }
  }, [id])

  const ready = Boolean(data?.recipe) && splitIsCurrent(data.recipe, data.steps)
  const [split, setSplit] = useState({ state: 'idle' }) // idle | working | error | unsplittable
  const [cook, setCook] = useState(null)
  const [live, setLive] = useState(false)
  const [local, setLocal] = useState(() => readLocal(id) ?? {})
  const [status, setStatus] = useState('')
  const [problem, setProblem] = useState('')
  const [undoIds, setUndoIds] = useState(null) // the last catch-up, so it can be undone
  const pending = useRef([]) // changes made while offline, sent on reconnect
  // The other cook's steps show as one-line reminders unless expanded.
  const [showTheirs, setShowTheirs] = useState(false)
  const stepsRef = useRef(null)
  useScrollFocus(stepsRef, [cook?.id, local.side, showTheirs, cook?.done_steps?.length])

  // Open (or join) the shared cook once the split is ready.
  useEffect(() => {
    if (!ready || cook) return
    let cancelled = false
    ;(async () => {
      const result = online ? await startCook(id, urlServings) : { ok: false, offline: true }
      if (cancelled) return
      if (result.ok && result.cook) {
        setCook(result.cook)
        setLive(true)
      } else {
        if (!result.offline) setProblem(result.message)
        setCook({ ...emptyCook(), ...(local.cook ?? {}) })
        setLive(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [ready, cook, online, id, local.cook, urlServings])

  // Live updates from the other phone, with a slow re-read as a backup.
  const cookId = live ? cook?.id : null
  useEffect(() => {
    if (!cookId) return undefined
    const stop = watchCook(cookId, (next) => setCook(next))
    const timer = setInterval(async () => {
      if (document.visibilityState !== 'visible' || pending.current.length) return
      const result = await fetchCook(cookId)
      if (result.ok && result.cook) setCook(result.cook)
    }, POLL_MS)
    return () => {
      stop()
      clearInterval(timer)
    }
  }, [cookId])

  // Back online: send what was changed offline, then catch up.
  useEffect(() => {
    if (!online || !cookId || pending.current.length === 0) return
    ;(async () => {
      const queued = pending.current
      pending.current = []
      for (const op of queued) await op()
      const result = await fetchCook(cookId)
      if (result.ok && result.cook) setCook(result.cook)
      setStatus('Back online. Your check-offs were sent.')
    })()
  }, [online, cookId])

  // Without a live cook, keep this phone's progress for the tab.
  useEffect(() => {
    if (cook && !live) {
      const next = { ...local, cook: { done_steps: cook.done_steps, moved_steps: cook.moved_steps } }
      writeLocal(id, next)
    }
    // Only when progress changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cook, live])

  // Applies a change here right away, then on the server. If the server
  // can't be reached, the change waits and is sent on reconnect.
  const change = useCallback(
    async (applyLocally, send) => {
      setProblem('')
      setCook((current) => applyLocally(current))
      if (!live || !cook?.id) return
      const result = await send(cook.id)
      if (result.ok) {
        if (result.cook) setCook(result.cook)
      } else if (result.offline) {
        pending.current.push(() => send(cook.id))
        setStatus(result.message)
      } else {
        setProblem(result.message)
      }
    },
    [live, cook?.id],
  )

  if (data === undefined) {
    return (
      <Page title="Two chefs">
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

  const { recipe, ingredients, steps, members } = data
  const backToRecipe = `/recipe/${id}`
  const soloLink = `/recipe/${id}/cook?servings=${urlServings}`
  const me = member.user_id
  const partner = members.find((m) => m.user_id !== me && !m.removed_at)
  const nameFor = (userId) => (userId === me ? 'You' : members.find((m) => m.user_id === userId)?.display_name ?? 'The other cook')

  async function runSplit() {
    setSplit({ state: 'working' })
    const result = await invokeFunction('split-steps', {
      title: recipe.title,
      // "Sauce: 2 tbsp soy sauce", so Gemini knows which part each is for.
      ingredients: ingredients.map((ing) => (ing.section ? `${ing.section}: ` : '') + ingredientLine(ing, 1, 'us')),
      steps: steps.map((s) => s.text),
    })
    if (!result.ok) return setSplit({ state: 'error', message: result.message })
    if (!result.data.splittable) return setSplit({ state: 'unsplittable', reason: result.data.reason })
    const prepSteps = Array.isArray(result.data.prep_steps) ? result.data.prep_steps : []
    const added = await saveChefSplit(recipe.id, result.data.names, result.data.tracks, {
      timing: result.data.timing,
      while_waiting: result.data.while_waiting,
      prep_steps: prepSteps,
    })
    setSplit({ state: 'idle' })
    if (added) {
      setStatus(
        `Added ${added} prep ${added === 1 ? 'step' : 'steps'} from the ingredient list, so the chopping is shared too: ${prepSteps
          .slice(0, added)
          .map((p) => p.text.replace(/\.$/, ''))
          .join('; ')}.`,
      )
    }
  }

  async function runSplitAgain() {
    if (!window.confirm('Ask Gemini to split the steps again? Steps you moved during this cook stay moved.')) return
    await runSplit()
  }

  // --- Not split yet ---------------------------------------------------
  if (!ready) {
    const redo = Boolean(recipe.chef_tracks)
    // Prep the ingredient list implies with no step for it. Once it's a
    // step, it can go to either cook.
    const missingPrep = prepSuggestions(ingredients, steps.map((step) => step.text))
    return (
      <Page title={`${recipe.title}: two chefs`} close={{ label: 'Leave two-chef mode', onClick: () => navigate(backToRecipe) }}>
        <p>
          {redo
            ? 'The steps changed since this recipe was split, so it needs splitting again.'
            : 'Two-chef mode splits the steps between you, so you can both cook at the same time. Gemini works out which steps can happen side by side and where your parts come together. The split is saved with the recipe.'}
        </p>
        {missingPrep.length > 0 && (
          <section className="card" aria-labelledby="missing-prep-heading">
            <h2 id="missing-prep-heading" style={{ fontSize: 'var(--text-md)' }}>
              Prep isn't in the steps yet
            </h2>
            <p>
              The ingredient list has prep that no step does, so there's less to split. Add it as steps first:
            </p>
            <ul>
              {missingPrep.map((idea) => (
                <li key={idea.text}>{idea.text}</li>
              ))}
            </ul>
            <p className="actions">
              <Link className="btn btn-secondary" to={`/recipe/${id}/edit`} state={{ afterSave: 'back' }}>
                Add prep steps
              </Link>
            </p>
          </section>
        )}
        {split.state === 'unsplittable' ? (
          <>
            <p>
              <strong>This recipe doesn't split well.</strong> {split.reason}
            </p>
            <p className="actions">
              <Link to={backToRecipe}>Back to the recipe</Link>
              <Link className="btn" to={soloLink}>
                Use cooking mode
              </Link>
            </p>
          </>
        ) : (
          <>
            <p className="actions">
              <Link to={backToRecipe}>Back to the recipe</Link>
              <button className="btn" type="button" onClick={runSplit} disabled={!online || split.state === 'working'}>
                {redo ? 'Split again' : 'Split the steps'}
              </button>
            </p>
            {!online && <p className="hint">Splitting needs the internet. Once a recipe is split, two-chef mode works offline.</p>}
            {split.state === 'working' && <Working label="Gemini is splitting the steps…" typical="10 to 20 seconds" />}
            {split.state === 'error' && (
              <p className="error" role="alert">
                {split.message}
              </p>
            )}
          </>
        )}
      </Page>
    )
  }

  if (!cook) {
    return (
      <Page title={`${recipe.title}: two chefs`}>
        <p role="status">Opening two-chef mode…</p>
      </Page>
    )
  }

  const names = recipe.chef_tracks
  const timing = names.timing
  const states = stepStates(steps, cook)
  // Both phones share the servings of the cook, so their amounts match.
  const servings = Number(cook.servings) || urlServings
  const liveSide = live ? sideOf(cook, me) : null
  // The server's assignment wins; this phone's own pick covers offline.
  const side = local.side === 'all' ? 'all' : liveSide ?? local.side ?? null
  const factor = scaleFactor(recipe.base_servings, servings)
  // Who a step belongs to, as a label: "You" filled in your color, the
  // other cook dashed in theirs, or "Together" outlined, each led by the
  // cook's avatar face. Fill, line style and words carry the difference,
  // not color alone.
  const myCook = people?.me
  const theirCook = people?.partner
  const face = (cook) => cook && <AvatarFace look={cook.look} color={cook.color} />
  const pillColor = (cook) => (cook ? { '--pill-color': `var(--cook-${cook.color})`, '--pill-ink': `var(--ink-${cook.color})` } : undefined)
  const Owner = ({ state, here }) => {
    if (state.track === 'both')
      return (
        <span className="owner-pill is-together">
          <span className="owner-faces">
            {face(myCook)}
            {face(theirCook)}
          </span>
          Together
        </span>
      )
    const mine = side === 'all' || state.track === side
    if (side === 'all') return <span className="owner-pill is-you">{names[state.track]}</span>
    const who = mine ? myCook : theirCook
    return (
      <>
        <span className={`owner-pill ${mine ? 'is-you' : 'is-theirs'}`} style={pillColor(who)}>
          {face(who)}
          {mine ? 'You' : here ? `${otherName} is here` : otherName}
        </span>
        {names[state.track]}
      </>
    )
  }
  const whoHas = (track) => {
    if (track === 'both') return 'Together'
    if (side === 'all') return names[track]
    const userId = track === 'a' ? cook.chef_a : cook.chef_b
    if (live && userId) return `${names[track]} · ${nameFor(userId)}`
    return `${names[track]}${track === side ? ' · You' : ''}`
  }

  function pickSide(choice) {
    const nextLocal = { ...local, side: choice }
    setLocal(nextLocal)
    writeLocal(id, nextLocal)
    if (choice !== 'all' && live) {
      change(
        (c) => c,
        (cid) => claimChef(cid, choice),
      )
    }
  }

  function setDone(ids, done) {
    change(
      (c) => ({
        ...c,
        done_steps: done ? [...c.done_steps.filter((s) => !ids.includes(s)), ...ids] : c.done_steps.filter((s) => !ids.includes(s)),
      }),
      (cid) => setStepsDone(cid, ids, done),
    )
  }

  // Checking a step also checks the earlier steps it implies (catchUpIds),
  // so a cook who skipped check-offs catches up with one tap.
  function toggleDone(state) {
    if (state.done) {
      setDone([state.step.id], false)
      setUndoIds(null)
      setStatus(`Step ${state.number} marked not done.`)
      return
    }
    const ids = catchUpIds(states, state, side)
    const numbers = states.filter((s) => ids.includes(s.step.id)).map((s) => s.number)
    setDone(ids, true)
    setUndoIds(ids.length > 1 ? ids : null)
    setStatus(ids.length > 1 ? `Steps ${listNumbers(numbers)} done.` : `Step ${state.number} done.`)
  }

  function undoCatchUp() {
    setDone(undoIds, false)
    setUndoIds(null)
    setStatus('Check-offs undone.')
  }

  function move(state, track) {
    change(
      (c) => ({ ...c, moved_steps: { ...c.moved_steps, [state.step.id]: track } }),
      (cid) => moveStep(cid, state.step.id, track),
    )
    setStatus(`Step ${state.number} moved to ${whoHas(track)}.`)
  }

  function changeServings(n) {
    change(
      (c) => ({ ...c, servings: n }),
      (cid) => setServings(cid, n),
    )
  }

  function swap() {
    change(
      (c) => ({ ...c, chef_a: c.chef_b, chef_b: c.chef_a }),
      (cid) => swapChefs(cid),
    )
  }

  async function finish() {
    const today = localDate()
    const { alreadyLogged } = await logMeal({ recipeId: id, cookedOn: today, servings, twoChef: true }, member)
    if (live && cook.id) await endCook(cook.id)
    writeLocal(id, null)
    navigate(backToRecipe, { replace: true, state: { finishedCooking: { day: today, alreadyLogged } } })
  }

  function leave() {
    // Leaves the cook open for the other phone; it closes on Finish, or
    // on its own after 6 hours.
    if (local.side === 'all') writeLocal(id, { ...local, side: undefined })
    navigate(backToRecipe)
  }

  // --- Pick who makes what ----------------------------------------------
  if (!side) {
    return (
      <Page title={`${recipe.title}: two chefs`} close={{ label: 'Leave two-chef mode', onClick: () => navigate(backToRecipe) }}>
        {problem && (
          <p className="error" role="alert">
            {problem}
          </p>
        )}
        <section aria-labelledby="pick-heading">
          <h2 id="pick-heading">Who's making what?</h2>
          <p className="hint">
            {live && partner
              ? `${partner.display_name} gets the other part on their phone.`
              : "This phone isn't connected, so pick your part here and the other cook picks on theirs."}
          </p>
          <div className="pick-list">
            {['a', 'b'].map((track) => {
              const count = states.filter((s) => s.track === track).length
              const taken = live && (track === 'a' ? cook.chef_a : cook.chef_b)
              return (
                <button key={track} className="btn btn-secondary pick" type="button" onClick={() => pickSide(track)}>
                  I'll make the {names[track].toLowerCase()}
                  <span className="hint">
                    {' '}
                    · {count} {count === 1 ? 'step' : 'steps'}
                    {taken && taken !== me ? ` · ${nameFor(taken)} has this` : ''}
                  </span>
                </button>
              )
            })}
            <button className="btn btn-secondary pick" type="button" onClick={() => pickSide('all')}>
              Both parts, on this phone
            </button>
          </div>
        </section>
      </Page>
    )
  }

  // --- Cooking -----------------------------------------------------------
  const next = nextFor(states, side)
  const otherOn = side !== 'all' ? currentOn(states, otherSide(side)) : null
  const otherName = live ? nameFor(side === 'a' ? cook.chef_b : cook.chef_a) : 'The other cook'
  const myName = members.find((m) => m.user_id === me)?.display_name ?? member.display_name ?? 'You'
  const meet = meetAt(states)
  const minutesOf = (state) => timing?.[state.number - 1]?.minutes ?? null
  const cleanup = side !== 'all' ? names.while_waiting?.[side] ?? [] : []
  const isNext = (state) => next.kind === 'step' && next.state.step.id === state.step.id
  const askIndex = next.kind === 'step' ? next.state.number - 1 : null
  // The step's ingredients. Earlier steps (in recipe order) decide which
  // copy to show when an ingredient is listed twice.
  const needed = next.kind === 'step'
    ? ingredientsForStep(
        next.state.step.text,
        ingredients,
        states.filter((s) => s.number < next.state.number).map((s) => s.step.text),
      )
    : []
  // A shared step whose other part isn't checked off yet. It doesn't lock;
  // the card says what's unchecked and leaves the timing to the cooks.
  const unchecked = next.kind === 'step' && next.state.track === 'both' && side !== 'all' ? next.state.waitingOn : []

  // Shown while waiting on the other cook: where you meet, and what to tidy.
  const whileWaiting = (
    <>
      {meet && !isNext(meet) && (
        <p style={{ margin: 'var(--space-2) 0 0' }}>
          You'll work together at step {meet.number}: <StepText text={meet.step.text} ingredients={ingredients} factor={factor} system={system} />
        </p>
      )}
      <h3>While you wait</h3>
      {cleanup.length > 0 ? (
        <ul className="cook-needs">
          {cleanup.map((task) => (
            <li key={task}>{task}</li>
          ))}
        </ul>
      ) : (
        <p style={{ margin: 0 }}>Put away what you're done with and rinse your bowls and tools.</p>
      )}
    </>
  )

  return (
    <Page title={`${recipe.title}: two chefs`} close={{ label: 'Leave two-chef mode', onClick: leave }}>
      <p className="mode-band">
        <strong>
          <Icon name="users" size={20} />
          Two-chef mode
        </strong>
        {live && side !== 'all' && <span>{`${myName} and ${otherName}`}</span>}
        {side === 'all' && <span>Both parts on this phone</span>}
      </p>
      <p className="hint" style={{ marginBottom: 0 }}>
        {[
          timeSummary(recipe),
          wakeLock === 'failed' && 'Screen may dim. Tap anywhere to keep it on',
          wakeLock === 'unsupported' && "Screen may dim; this browser can't keep it on",
          !live && 'Offline: progress stays on this phone',
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <ServingsBar
        servings={servings}
        base={recipe.base_servings}
        onChange={changeServings}
        note={live ? 'Same on both phones.' : null}
      />
      <NutritionPeek recipe={recipe} ingredients={ingredients} />
      <OtherTimers timers={timers} currentId={next.kind === 'step' ? next.state.step.id : null} />
      <div className="row-between">
        <p style={{ margin: 0 }}>
          {side === 'all' ? (
            <>Both parts on this phone</>
          ) : (
            <>
              You: <strong>{names[side]}</strong>
              {live && (
                <>
                  {' '}
                  · {otherName}: <strong>{names[otherSide(side)]}</strong>
                </>
              )}
            </>
          )}
        </p>
        {side !== 'all' && live ? (
          <button className="link-btn" type="button" onClick={swap}>
            Swap parts
          </button>
        ) : (
          <button className="link-btn" type="button" onClick={() => pickSide(undefined)}>
            Change
          </button>
        )}
      </div>
      {problem && (
        <p className="error" role="alert">
          {problem}
        </p>
      )}

      <section aria-labelledby="next-heading" className="two-chef-next">
        <div aria-live="polite" aria-atomic="true">
          {next.kind === 'step' && (
            <>
              <h2 id="next-heading" className="cook-count">
                Step {next.state.number} of {steps.length}
                {next.state.track === 'both' ? ' · together' : side === 'all' ? ` · ${names[next.state.track]}` : ''}
                {minutesOf(next.state) && ` · about ${formatMinutes(minutesOf(next.state))}`}
              </h2>
              {/* What you need first, then what to do: the order people prep in. */}
              <StepNeeds needed={needed} factor={factor} system={system} />
              <p className={needed.length > 0 ? 'cook-step follows-needs' : 'cook-step'}>
                <StepText text={next.state.step.text} ingredients={ingredients} factor={factor} system={system} />
              </p>
              {unchecked.length > 0 && (
                <p>
                  {live ? otherName : 'The other cook'} hasn't checked off step{unchecked.length === 1 ? '' : 's'}{' '}
                  {listNumbers(unchecked.map((w) => w.number))} yet. Start when you're both ready.
                </p>
              )}
              {unchecked.length > 0 && whileWaiting}
            </>
          )}
          {next.kind === 'mine-done' && (
            <>
              <h2 id="next-heading" className="cook-count">
                Your part is done
              </h2>
              <p className="cook-step">
                {otherOn ? `${otherName} is on step ${otherOn.number}.` : 'Waiting on the other part.'}
              </p>
              {whileWaiting}
            </>
          )}
          {next.kind === 'all-done' && (
            <>
              <h2 id="next-heading" className="cook-count">
                Every step is done
              </h2>
              <p className="cook-step">Time to eat.</p>
            </>
          )}
        </div>
        {next.kind === 'step' && (
          <>
            <StepTimer key={next.state.step.id} stepId={next.state.step.id} text={next.state.step.text} timers={timers} />
            <button className="btn btn-large" type="button" onClick={() => toggleDone(next.state)}>
              Done with step {next.state.number}
            </button>
            {side !== 'all' && next.state.track !== 'both' && (
              <p style={{ margin: 'var(--space-2) 0 0', textAlign: 'center' }}>
                <button className="link-btn" type="button" onClick={() => move(next.state, otherSide(next.state.track))}>
                  Give this step to {live ? otherName : 'the other cook'}
                </button>
              </p>
            )}
          </>
        )}
        {next.kind === 'all-done' && (
          <button className="btn btn-large" type="button" onClick={finish}>
            Finish and log it
          </button>
        )}
      </section>
      <p role="status" className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
        {status}
        {undoIds && (
          <>
            {' '}
            <button className="link-btn" type="button" onClick={undoCatchUp}>
              Undo
            </button>
          </>
        )}
      </p>

      <section aria-labelledby="all-steps-heading">
        <div className="row-between">
          <h2 id="all-steps-heading">All steps</h2>
          {side !== 'all' && (
            <button className="link-btn" type="button" aria-pressed={showTheirs} onClick={() => setShowTheirs((v) => !v)}>
              {`${showTheirs ? 'Shorten' : 'Show'} ${otherName === 'The other cook' ? "the other cook's" : `${otherName}'s`} steps${showTheirs ? '' : ' in full'}`}
            </button>
          )}
        </div>
        <ol className="two-chef-steps scroll-focus" ref={stepsRef}>
          {states.map((state) => {
            const yours = side === 'all' || state.track === side || state.track === 'both'
            if (!yours && !showTheirs) {
              return (
                <li
                  key={state.step.id}
                  className={['theirs', 'is-reminder', state.done ? 'is-done' : '', otherOn?.step.id === state.step.id ? 'is-their-current' : '']
                    .join(' ')
                    .trim()}
                >
                  {/* Tap to read the whole step without showing all of them. */}
                  <details className="partner-step">
                    <summary>
                      <span className="step-owner">
                        <span>
                          <Owner state={state} here={otherOn?.step.id === state.step.id} />
                          {state.done && ' · done'}
                        </span>
                        <span className="chev" aria-hidden="true">
                          <Icon name="chevron" size={18} />
                        </span>
                      </span>
                      <span className="step-reminder" style={{ display: 'block' }}>
                        {shortStep(state.step.text)}
                      </span>
                    </summary>
                    <p className="step-text">
                      <StepText text={state.step.text} ingredients={ingredients} factor={factor} system={system} />
                    </p>
                  </details>
                </li>
              )
            }
            return (
              <li
                key={state.step.id}
                className={[
                  yours ? '' : 'theirs',
                  state.done ? 'is-done' : '',
                  isNext(state) ? 'is-next' : '',
                  !yours && otherOn?.step.id === state.step.id ? 'is-their-current' : '',
                ]
                  .join(' ')
                  .trim()}
                aria-current={isNext(state) ? 'step' : undefined}
              >
                <p className="step-owner">
                  {isNext(state) && <span className="next-label">Your next step</span>}
                  <Owner state={state} here={!yours && otherOn?.step.id === state.step.id} />
                  {minutesOf(state) && ` · about ${formatMinutes(minutesOf(state))}`}
                </p>
                <p className="step-text">
                  <StepText text={state.step.text} ingredients={ingredients} factor={factor} system={system} />
                </p>
                <div className="comment-actions">
                  <label className="choice">
                    <input type="checkbox" checked={state.done} onChange={() => toggleDone(state)} />
                    Done<span className="sr-only">: step {state.number}</span>
                  </label>
                  {side !== 'all' && state.track !== 'both' && !state.done && (
                    <button className="link-btn" type="button" onClick={() => move(state, otherSide(state.track))}>
                      {state.track === side ? `Give to ${live ? otherName : 'the other cook'}` : 'Take this step'}
                      <span className="sr-only"> (step {state.number})</span>
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      <AllIngredients ingredients={ingredients} factor={factor} system={system} />

      {askIndex != null && (
        <AskStep
          recipe={recipe}
          steps={steps}
          ingredients={ingredients}
          factor={factor}
          system={system}
          servings={servings}
          stepIndex={askIndex}
          online={online}
        />
      )}

      <ChangeLog recipeId={recipe.id} member={member} />

      <p className="actions start">
        {online && (
          <button className="link-btn" type="button" onClick={runSplitAgain} disabled={split.state === 'working'}>
            Split again
          </button>
        )}
      </p>
      {split.state === 'working' && <Working label="Gemini is splitting the steps…" typical="10 to 20 seconds" />}
      {split.state === 'error' && (
        <p className="error" role="alert">
          {split.message}
        </p>
      )}
    </Page>
  )
}
