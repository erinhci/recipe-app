import Icon from './Icon'
import { ingredientLine } from '../lib/cooking'
import { groupBySection } from '../lib/ingredients'
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
      {groupBySection(ingredients).map((group) => (
        <div key={group.section ?? 'main'}>
          {group.section && <h3 className="ingredient-section">{group.section}</h3>}
          <ul>
            {group.items.map((ing) => (
              <li key={ing.id} style={{ marginBottom: 'var(--space-2)' }}>
                {ingredientLine(ing, factor, system)}
              </li>
            ))}
          </ul>
        </div>
      ))}
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

// A wind-up kitchen timer face. The dial turns back to the time left (6
// degrees a minute, like the real thing, up to one full turn) and ticks
// toward 0 once a second; a small hand in the middle clicks round once a
// minute. When it starts, the dial winds up from 0. Reduced motion: no
// wind-up and no rattle; the dial just shows the time left.
const rad = (deg) => ((deg - 90) * Math.PI) / 180
const pt = (deg, r) => [50 + r * Math.cos(rad(deg)), 56 + r * Math.sin(rad(deg))]
const DIAL_TICKS = Array.from({ length: 60 }, (_, m) => {
  const long = m % 5 === 0
  const [x1, y1] = pt(m * 6, 33)
  const [x2, y2] = pt(m * 6, long ? 27 : 30)
  return { x1, y1, x2, y2, w: long ? 2.2 : 1 }
})
const DIAL_NUMBERS = [0, 10, 20, 30, 40, 50].map((m) => {
  const [x, y] = pt(m * 6, 19.5)
  return { x, y, a: m * 6, label: String(m) }
})

function KitchenDial({ secondsLeft, size }) {
  const dial = -Math.min(secondsLeft / 60, 60) * 6
  const hand = -(Math.ceil(secondsLeft) % 60) * 6
  return (
    <svg className="kt" aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 100 104" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <g className="kt-body">
        <rect x="43" y="4" width="14" height="9" rx="3" fill="var(--color-surface)" stroke="var(--color-text)" strokeWidth="3" />
        <circle cx="50" cy="56" r="42" fill="var(--color-surface)" stroke="var(--color-text)" strokeWidth="3.5" />
        <g className="kt-dial" style={{ transform: `rotate(${dial}deg)` }}>
          <circle cx="50" cy="56" r="34" fill="var(--color-subtle)" />
          {DIAL_TICKS.map((t, i) => (
            <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="var(--color-text)" strokeWidth={t.w} />
          ))}
          {DIAL_NUMBERS.map((n) => (
            <text
              key={n.label}
              x={n.x}
              y={n.y}
              textAnchor="middle"
              dominantBaseline="central"
              fontSize="10"
              fontWeight="700"
              fill="var(--color-text)"
              transform={`rotate(${n.a} ${n.x} ${n.y})`}
            >
              {n.label}
            </text>
          ))}
          <circle cx="50" cy="56" r="9" fill="var(--color-surface)" stroke="var(--color-text)" strokeWidth="3" />
        </g>
        <g className="kt-sec" style={{ transform: `rotate(${hand}deg)` }}>
          <path d="M50 56 V49.5" stroke="var(--color-text)" strokeWidth="2.5" />
        </g>
        <path className="kt-pointer" d="M44 12 L56 12 L50 22z" fill="var(--color-text)" stroke="var(--color-text)" strokeWidth="2" />
      </g>
    </svg>
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
          <span className="kt-done-face">
            <KitchenDial secondsLeft={0} size={40} />
          </span>
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
      <div className={`timer-card${t.state === 'paused' ? ' is-paused' : ''}`} role="timer" aria-label={`${label} timer, ${clock(t.secondsLeft)} left`}>
        <KitchenDial secondsLeft={t.secondsLeft} size={96} />
        <span className="timer-card-text">
          <span className="timer-clock">{clock(t.secondsLeft)}</span>
          <span className="timer-left">left of {label}</span>
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
