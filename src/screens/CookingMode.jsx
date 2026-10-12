import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import Page from '../components/Page'
import StepText from '../components/StepText'
import ServingsBar from '../components/ServingsBar'
import AskStep from '../components/AskStep'
import ChangeLog from '../components/ChangeLog'
import { useScrollFocus } from '../lib/useScrollFocus'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { localDate, logMeal } from '../lib/data'
import { timeSummary } from '../lib/stats'
import { scaleFactor } from '../lib/units'
import { ingredientLine, ingredientsForStep } from '../lib/cooking'
import { useWakeLock } from '../lib/useWakeLock'
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

export default function CookingMode() {
  const { id } = useParams()
  const [params, setParams] = useSearchParams()
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

  // The upcoming step nearest the middle of the screen stands out.
  const upcomingRef = useRef(null)
  useScrollFocus(upcomingRef, [stepIndex, steps.length])

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

  // Finish logs today's meal (its time comes from the recipe's total
  // time) and goes to "How was it?". Stop cooking logs nothing.
  async function finish(toLog) {
    writeSaved(id, null)
    if (!toLog) return navigate(`/recipe/${id}`, { replace: true })
    const today = localDate()
    const { alreadyLogged } = await logMeal({ recipeId: id, cookedOn: today, servings }, member)
    navigate(`/recipe/${id}`, { replace: true, state: { finishedCooking: { day: today, alreadyLogged } } })
  }

  function changeServings(n) {
    setParams({ servings: String(n), units: system }, { replace: true })
  }

  return (
    <Page title={recipe.title} close={{ label: 'Exit cooking mode', onClick: () => finish(false) }}>
      <p className="hint" style={{ marginBottom: 0 }}>
        {[
          timeSummary(recipe),
          system === 'metric' ? 'Metric units' : 'US units',
          wakeLock === 'on' ? 'Screen stays on' : wakeLock === 'checking' ? '' : "This phone can't keep the screen on; tap it now and then",
        ]
          .filter(Boolean)
          .join(' · ')}
      </p>
      <ServingsBar servings={servings} base={recipe.base_servings} onChange={changeServings} />

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
              <p className="cook-step">
                <StepText text={step.text} ingredients={ingredients} factor={factor} system={system} />
              </p>
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
              <ol className="cook-upcoming scroll-focus" start={current + 2} ref={upcomingRef}>
                {steps.slice(current + 1).map((upcoming) => (
                  <li key={upcoming.id}>
                    <StepText text={upcoming.text} ingredients={ingredients} factor={factor} system={system} />
                  </li>
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
                  <li key={done.id}>
                    <StepText text={done.text} ingredients={ingredients} factor={factor} system={system} />
                  </li>
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

          <AskStep
            recipe={recipe}
            steps={steps}
            ingredients={ingredients}
            factor={factor}
            system={system}
            servings={servings}
            stepIndex={current}
            online={online}
          />

          <ChangeLog recipeId={recipe.id} member={member} />

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
