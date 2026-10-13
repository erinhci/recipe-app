import Icon from './Icon'
import { ingredientLine } from '../lib/cooking'
import { NUTRIENTS, formatNutrient, isNutritionStale, nutritionTotals } from '../lib/nutrition'
import { clock, findWait, waitLabel } from '../lib/stepTimer'

// Pieces shared by cooking mode and two-chef mode.

// The current step's ingredients, in their own card above the step text,
// so they stand apart from the instructions on a quick scan. A plain list:
// nothing to tick off. The link opens the full list without leaving.
export function StepNeeds({ needed, factor, system }) {
  if (needed.length === 0) return null
  function showAll(event) {
    const all = document.getElementById('all-ingredients')
    if (!all) return
    event.preventDefault()
    all.open = true
    all.scrollIntoView({ block: 'start' })
    all.querySelector('summary')?.focus()
  }
  return (
    <div className="cook-needs-card" role="group" aria-labelledby="needs-heading">
      <div className="row-between">
        <h3 id="needs-heading" className="needs-heading">
          <Icon name="meals" size={22} />
          You'll need
        </h3>
        <span className="hint">
          {needed.length} {needed.length === 1 ? 'item' : 'items'}
        </span>
      </div>
      <ul className="cook-needs plain-list">
        {needed.map((ing) => (
          <li key={ing.id}>{ingredientLine(ing, factor, system)}</li>
        ))}
      </ul>
      <a className="small-link" href="#all-ingredients" onClick={showAll}>
        All ingredients for this recipe
      </a>
    </div>
  )
}

// The full ingredient list at the bottom of a cook mode.
export function AllIngredients({ ingredients, factor, system }) {
  return (
    <details className="card" id="all-ingredients">
      <summary>All ingredients</summary>
      <ul>
        {ingredients.map((ing) => (
          <li key={ing.id} style={{ marginBottom: 'var(--space-2)' }}>
            {ingredientLine(ing, factor, system)}
          </li>
        ))}
      </ul>
    </details>
  )
}

// Calories and protein per serving at a glance, with the other numbers a
// tap away, so nobody leaves the cook mode to look them up. Hidden until
// the recipe has an estimate.
export function NutritionPeek({ recipe, ingredients }) {
  const nutrition = recipe.nutrition
  if (!nutrition?.items?.length) return null
  const { perServing } = nutritionTotals(nutrition, recipe.base_servings)
  const stale = isNutritionStale(nutrition, recipe, ingredients)
  return (
    <details className="nut-peek">
      <summary>
        <span>
          <strong>Nutrition</strong> · {formatNutrient('calories', perServing.calories)} cal ·{' '}
          {formatNutrient('protein_g', perServing.protein_g)} protein <span className="muted">per serving</span>
        </span>
        <span className="chev" aria-hidden="true">
          <Icon name="chevron" size={20} />
        </span>
      </summary>
      <div className="nut-body">
        <ul className="nutrient-tiles">
          {NUTRIENTS.map((n) => (
            <li key={n.key}>
              <span className="nutrient-value">{formatNutrient(n.key, perServing[n.key])}</span>
              <span className="nutrient-label">{n.label}</span>
            </li>
          ))}
        </ul>
        <p className="hint" style={{ margin: 0 }}>
          Estimated, per serving.{stale && ' The recipe changed since this estimate.'}
        </p>
      </div>
    </details>
  )
}

// The timer under a large current step that names a wait of 3 minutes or
// more. Idle: one tap starts it. Running: the countdown is a timer region
// (screen readers aren't read every second). Done: an alert, plus a
// vibration and beeps from useStepTimers.
export function StepTimer({ stepId, text, timers }) {
  const wait = findWait(text)
  if (!wait) return null
  const label = waitLabel(wait.low)
  const note = wait.high > wait.low ? `Check at ${waitLabel(wait.low)}, done by ${waitLabel(wait.high)}` : null
  const t = timers.view(stepId)

  if (!t) {
    return (
      <div className="step-timer">
        <button className="timer-pill" type="button" onClick={() => timers.start(stepId, wait.low, label)}>
          <Icon name="clock" size={24} />
          <span>Start timer</span>
          <span className="timer-length">{label}</span>
        </button>
        {note && <p className="timer-note">{note}</p>}
      </div>
    )
  }
  if (t.state === 'done') {
    return (
      <div className="step-timer">
        <div className="timer-pill is-done" role="alert">
          <Icon name="check" size={24} />
          <span className="timer-done-text">Time's up</span>
          <button className="timer-inner-btn" type="button" onClick={() => timers.clear(stepId)}>
            Done
          </button>
        </div>
        {note && <p className="timer-note">{note}</p>}
      </div>
    )
  }
  return (
    <div className="step-timer">
      <div className="timer-pill is-running" role="timer" aria-label={`${label} timer`}>
        <Icon name="clock" size={24} />
        <span className="timer-clock">{clock(t.secondsLeft)}</span>
        <span className="timer-bar" aria-hidden="true">
          <span style={{ width: `${Math.min(100, Math.max(0, t.done * 100))}%` }} />
        </span>
        {t.state === 'paused' ? (
          <button className="timer-inner-btn" type="button" onClick={() => timers.resume(stepId)}>
            Resume
          </button>
        ) : (
          <button className="timer-inner-btn" type="button" onClick={() => timers.pause(stepId)}>
            Pause
          </button>
        )}
      </div>
      <p className="timer-note">
        {t.state === 'paused' && 'Paused. '}
        {note && `${note}. `}
        <button className="link-btn" type="button" onClick={() => timers.clear(stepId)}>
          Cancel timer
        </button>
      </p>
    </div>
  )
}

// Timers still running for steps you've moved past (the bake keeps going
// while you prep the next thing).
export function OtherTimers({ timers, currentId, onGoTo }) {
  const others = Object.keys(timers.timers)
    .filter((id) => id !== currentId)
    .map((id) => [id, timers.view(id)])
  if (others.length === 0) return null
  const finished = others.filter(([, t]) => t.state === 'done').map(([, t]) => t.label)
  return (
    <>
    <p className="sr-only" role="alert">
      {finished.length > 0 && `Time's up: ${finished.join(', ')} timer`}
    </p>
    <ul className="other-timers plain-list" aria-label="Other timers">
      {others.map(([id, t]) => (
        <li key={id} className={t.state === 'done' ? 'is-done' : ''}>
          <Icon name="clock" size={20} />
          <span>
            {t.label} timer: <strong>{t.state === 'done' ? "time's up" : clock(t.secondsLeft)}</strong>
            {t.state === 'paused' && ' (paused)'}
          </span>
          {onGoTo && (
            <button className="link-btn" type="button" onClick={() => onGoTo(id)}>
              Go to step
            </button>
          )}
          {t.state === 'done' && (
            <button className="link-btn" type="button" onClick={() => timers.clear(id)}>
              Dismiss
            </button>
          )}
        </li>
      ))}
    </ul>
    </>
  )
}
