import { useRef } from 'react'
import Icon from './Icon'
import { ingredientLine } from '../lib/cooking'
import { groupBySection } from '../lib/ingredients'
import { NUTRIENTS, formatNutrient, isNutritionStale, nutritionTotals } from '../lib/nutrition'
import { clock, findWait, waitLabel, TIMER_MAX_MINUTES } from '../lib/stepTimer'

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

// A kitchen timer knob: a raised face in a bezel, ticks set into a well,
// a fin for a pointer and the time left as an arc in your color. The fin
// and arc show the share of the timer left, unwinding toward the top. On
// start it winds up to the time set (with a ratchet buzz on phones that
// vibrate). While it runs or is paused you can turn the knob to change the
// time: a minute for every 12 degrees, with a click of vibration for each
// minute. It is also a slider: arrow keys change it by a minute, Page Up
// and Page Down by five. Reduced motion: no wind-up animation.
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = ((i * 6 - 90) * Math.PI) / 180
  const r1 = i % 5 === 0 ? 74 : 77
  return { x1: 100 + r1 * Math.cos(a), y1: 100 + r1 * Math.sin(a), x2: 100 + 82 * Math.cos(a), y2: 100 + 82 * Math.sin(a), w: i % 5 === 0 ? 2 : 1 }
})
const DEG_PER_MINUTE = 12
const buzz = (pattern) => {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // No vibration on this phone.
  }
}
// A ratchet: short clicks spread over the wind-up.
export const ratchet = () => buzz(Array.from({ length: 27 }, (_, i) => (i % 2 ? 26 : 7)))

function KitchenDial({ secondsLeft, totalSeconds = 1, size }) {
  const share = Math.max(0, Math.min(1, secondsLeft / Math.max(1, totalSeconds)))
  return (
    <svg className="kt" aria-hidden="true" focusable="false" width={size} height={size} viewBox="0 0 200 200" style={{ '--kt-a': `${share * 360}deg` }}>
      <defs>
        <radialGradient id="kt-g-bezel" cx="35%" cy="30%" r="80%">
          <stop offset="0" style={{ stopColor: 'var(--kt-bezel-hi)' }} />
          <stop offset="1" style={{ stopColor: 'var(--kt-bezel-lo)' }} />
        </radialGradient>
        <radialGradient id="kt-g-face" cx="35%" cy="28%" r="85%">
          <stop offset="0" style={{ stopColor: 'var(--kt-face-hi)' }} />
          <stop offset="1" style={{ stopColor: 'var(--kt-face-lo)' }} />
        </radialGradient>
      </defs>
      <circle className="kt-bezel" cx="100" cy="100" r="96" />
      <circle className="kt-well" cx="100" cy="100" r="86" />
      {TICKS.map((t, i) => (
        <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} className="kt-tick" strokeWidth={t.w} />
      ))}
      <circle className="kt-arc" cx="100" cy="100" r="88" pathLength="100" strokeDasharray={`${share * 100} 100`} transform="rotate(-90 100 100)" />
      <circle className="kt-face" cx="100" cy="100" r="58" />
      <circle className="kt-rim" cx="100" cy="100" r="57" />
      <circle className="kt-groove" cx="100" cy="100" r="44" />
      <g className="kt-fin">
        <rect x="96" y="52" width="8" height="34" rx="4" className="kt-pointer" />
        <rect x="97.5" y="54" width="2.5" height="28" rx="1.25" fill="#fff" opacity="0.45" />
      </g>
    </svg>
  )
}

// The knob you can turn, wrapping the face. onTurn(minutes) changes the
// time left by that many minutes.
function TimerKnob({ secondsLeft, totalSeconds, size, onTurn }) {
  const drag = useRef(null)
  const minutes = Math.ceil(secondsLeft / 60)
  const angleAt = (event) => {
    const box = event.currentTarget.getBoundingClientRect()
    return (Math.atan2(event.clientY - (box.top + box.height / 2), event.clientX - (box.left + box.width / 2)) * 180) / Math.PI
  }
  function down(event) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    drag.current = { last: angleAt(event), carry: 0 }
  }
  function move(event) {
    if (!drag.current) return
    const now = angleAt(event)
    let delta = now - drag.current.last
    if (delta > 180) delta -= 360
    if (delta < -180) delta += 360
    drag.current.last = now
    drag.current.carry += delta
    const steps = Math.trunc(drag.current.carry / DEG_PER_MINUTE)
    if (steps !== 0) {
      drag.current.carry -= steps * DEG_PER_MINUTE
      buzz(8)
      onTurn(steps)
    }
  }
  const up = () => {
    drag.current = null
  }
  function key(event) {
    const by = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1, PageUp: 5, PageDown: -5 }[event.key]
    if (!by) return
    event.preventDefault()
    buzz(8)
    onTurn(by)
  }
  const m = Math.floor(secondsLeft / 60)
  const sec = Math.ceil(secondsLeft % 60)
  return (
    <div
      className="kt-knob"
      role="slider"
      tabIndex={0}
      aria-label="Time left. Turn or use the arrow keys to change it"
      aria-valuemin={1}
      aria-valuemax={TIMER_MAX_MINUTES}
      aria-valuenow={minutes}
      aria-valuetext={`${m} minute${m === 1 ? '' : 's'}${sec ? ` ${sec} seconds` : ''} left`}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      <KitchenDial secondsLeft={secondsLeft} totalSeconds={totalSeconds} size={size} />
    </div>
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
        <button
          className="timer-pill"
          type="button"
          onClick={() => {
            ratchet()
            timers.start(stepId, wait.low, label)
          }}
        >
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
        <TimerKnob secondsLeft={t.secondsLeft} totalSeconds={t.total / 1000} size={96} onTurn={(by) => timers.adjust(stepId, by)} />
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
