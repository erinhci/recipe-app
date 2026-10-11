import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import Working from '../components/Working'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { localDate, logMeal } from '../lib/data'
import { displayIngredient, scaleFactor } from '../lib/units'
import { ingredientsForStep } from '../lib/cooking'
import { askStep } from '../lib/askStep'
import { useOnline } from '../lib/useOnline'
import { DEFAULT_SERVINGS } from '../lib/constants'

// Coming back within this long continues the same cook (same step).
const RESUME_WINDOW = 30 * 60 * 1000

function readSaved(recipeId) {
  try {
    const saved = JSON.parse(sessionStorage.getItem(`cooking:${recipeId}`) ?? 'null')
    if (saved && Date.now() - saved.lastActive < RESUME_WINDOW) return saved
  } catch {
    // Storage unavailable; start fresh.
  }
  return null
}

function writeSaved(recipeId, value) {
  try {
    if (value) sessionStorage.setItem(`cooking:${recipeId}`, JSON.stringify({ ...value, lastActive: Date.now() }))
    else sessionStorage.removeItem(`cooking:${recipeId}`)
  } catch {
    // Storage unavailable; nothing to keep.
  }
}

function ingredientLine(ing, factor, system) {
  const shown = displayIngredient(ing, factor, system)
  return [shown.text, ing.item].filter(Boolean).join(' ') + (ing.prep_note ? `, ${ing.prep_note}` : '')
}

// Keeps the screen on while cooking, where the phone supports it.
function useWakeLock() {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [status, setStatus] = useState(supported ? 'checking' : 'unsupported')
  useEffect(() => {
    if (!supported) return undefined
    let lock = null
    let active = true
    async function request() {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (active) setStatus('on')
        else lock.release()
      } catch {
        if (active) setStatus('failed')
      }
    }
    // The lock drops when the phone locks or the app is hidden; ask again on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') request()
    }
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [supported])
  return status
}

export default function CookingMode() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { member } = useAuth()
  const online = useOnline()
  const wakeLock = useWakeLock()

  const servings = Number(params.get('servings')) || DEFAULT_SERVINGS
  const system = params.get('units') === 'metric' ? 'metric' : 'us'

  const data = useLiveQuery(async () => {
    const recipe = await db.recipes.get(id)
    if (!recipe) return { recipe: null }
    const [ingredients, steps] = await Promise.all([
      db.ingredients.where('recipe_id').equals(id).sortBy('position'),
      db.steps.where('recipe_id').equals(id).sortBy('position'),
    ])
    return { recipe, ingredients, steps }
  }, [id])

  const saved = useMemo(() => readSaved(id), [id])
  const [stepIndex, setStepIndex] = useState(saved?.step ?? 0)
  const [answers, setAnswers] = useState({}) // step index -> [{ question, answer, error }]
  const [question, setQuestion] = useState('')
  const [asking, setAsking] = useState(false)

  // Remember the step, so coming back to cooking mode picks up there.
  useEffect(() => {
    writeSaved(id, { step: stepIndex })
  }, [id, stepIndex])

  const steps = data?.steps ?? []
  const lastIndex = Math.max(steps.length - 1, 0)

  // Arrow keys move between steps (not while typing a question).
  useEffect(() => {
    function onKey(event) {
      if (event.target.closest?.('input, textarea, select')) return
      if (event.key === 'ArrowRight') setStepIndex((i) => Math.min(i + 1, lastIndex))
      if (event.key === 'ArrowLeft') setStepIndex((i) => Math.max(i - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lastIndex])

  if (data === undefined) {
    return (
      <Page title="Cooking">
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

  const { recipe, ingredients } = data
  const factor = scaleFactor(recipe.base_servings, servings)
  const current = Math.min(stepIndex, lastIndex)
  const step = steps[current]
  const needed = step ? ingredientsForStep(step.text, ingredients) : []
  const stepAnswers = answers[current] ?? []

  // Finish logs today's meal (its time comes from the recipe's total
  // time) and goes to "How was it?". Stop cooking logs nothing.
  async function finish(toLog) {
    writeSaved(id, null)
    if (!toLog) return navigate(`/recipe/${id}`, { replace: true })
    const today = localDate()
    const { alreadyLogged } = await logMeal({ recipeId: id, cookedOn: today }, member)
    navigate(`/recipe/${id}`, { replace: true, state: { finishedCooking: { day: today, alreadyLogged } } })
  }

  async function handleAsk(event) {
    event.preventDefault()
    const text = question.trim()
    if (!text || asking) return
    setAsking(true)
    const result = await askStep({
      recipe,
      servings,
      ingredientLines: ingredients.map((ing) => ingredientLine(ing, factor, system)),
      steps,
      stepNumber: current + 1,
      question: text,
    })
    setAnswers((all) => ({
      ...all,
      [current]: [...(all[current] ?? []), { question: text, answer: result.answer, error: result.ok ? null : result.message }],
    }))
    if (result.ok) setQuestion('')
    setAsking(false)
  }

  return (
    <Page title={recipe.title}>
      <p className="hint">
        {servings} {servings === 1 ? 'serving' : 'servings'} · {system === 'metric' ? 'Metric' : 'US'} units ·{' '}
        {wakeLock === 'on'
          ? 'Screen stays on'
          : wakeLock === 'checking'
            ? ''
            : "This phone can't keep the screen on; tap it now and then"}
      </p>

      {steps.length === 0 ? (
        <>
          <p>This recipe has no steps yet. Add them with Edit on the recipe page.</p>
          <Link className="btn" to={`/recipe/${id}`}>
            Back to the recipe
          </Link>
        </>
      ) : (
        <>
          <section aria-labelledby="step-heading">
            <div aria-live="polite" aria-atomic="true">
              <h2 id="step-heading" className="cook-count">
                Step {current + 1} of {steps.length}
              </h2>
              <p className="cook-step">{step.text}</p>
            </div>

            {needed.length > 0 && (
              <>
                <h3>You'll need</h3>
                <ul className="cook-needs">
                  {needed.map((ing) => (
                    <li key={ing.id}>{ingredientLine(ing, factor, system)}</li>
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* The rest of the recipe stays readable without tapping, for
              when hands are busy or messy. */}
          {current < lastIndex && (
            <section aria-labelledby="coming-heading">
              <h2 id="coming-heading">Coming up</h2>
              <ol className="cook-upcoming" start={current + 2}>
                {steps.slice(current + 1).map((upcoming) => (
                  <li key={upcoming.id}>{upcoming.text}</li>
                ))}
              </ol>
            </section>
          )}
          {current > 0 && (
            <details className="card">
              <summary>
                Done ({current} {current === 1 ? 'step' : 'steps'})
              </summary>
              <ol className="cook-done">
                {steps.slice(0, current).map((done) => (
                  <li key={done.id}>{done.text}</li>
                ))}
              </ol>
            </details>
          )}

          <details className="card">
            <summary>
              All ingredients
            </summary>
            <ul>
              {ingredients.map((ing) => (
                <li key={ing.id} style={{ marginBottom: 'var(--space-2)' }}>
                  {ingredientLine(ing, factor, system)}
                </li>
              ))}
            </ul>
          </details>

          <section aria-labelledby="ask-heading">
            <h2 id="ask-heading">Ask about this step</h2>
            <div aria-live="polite">
              {stepAnswers.map((item, index) => (
                <div key={index} className="answer">
                  <p style={{ fontWeight: 600 }}>{item.question}</p>
                  {item.error ? <p className="error">{item.error}</p> : <p style={{ margin: 0 }}>{item.answer}</p>}
                </div>
              ))}
            </div>
            <form onSubmit={handleAsk} className="field">
              <label htmlFor="question">Your question</label>
              <input
                id="question"
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What does fold in mean?"
                maxLength={500}
                disabled={!online}
                aria-describedby="ask-hint"
              />
              <p id="ask-hint" className="hint" style={{ margin: 0 }}>
                {online ? 'Gemini answers for this recipe at these amounts.' : 'Questions need the internet. The steps still work offline.'}
              </p>
              <button className="btn btn-secondary" type="submit" disabled={!online || asking || !question.trim()} style={{ alignSelf: 'flex-start' }}>
                {asking ? 'Asking…' : 'Ask'}
              </button>
              {asking && <Working label="Getting an answer…" typical="a few seconds" />}
            </form>
          </section>

          <p>
            <button className="btn btn-secondary" type="button" onClick={() => finish(false)}>
              Stop cooking
            </button>
          </p>

          <nav className="cook-nav" aria-label="Steps">
            <button className="btn btn-secondary" type="button" onClick={() => setStepIndex(current - 1)} disabled={current === 0}>
              Previous
            </button>
            {current < lastIndex ? (
              <button className="btn" type="button" onClick={() => setStepIndex(current + 1)}>
                Next step
              </button>
            ) : (
              <button className="btn" type="button" onClick={() => finish(true)}>
                Finish
              </button>
            )}
          </nav>
        </>
      )}
    </Page>
  )
}
