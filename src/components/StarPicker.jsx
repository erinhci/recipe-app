import { useId, useRef, useState } from 'react'

const label = (n) => (n ? `${n} ${n === 1 ? 'star' : 'stars'}` : 'Not rated yet')

// Star rating in half steps, set by tapping or dragging across the stars
// (like Letterboxd). It's a standard slider underneath, so it works with a
// screen reader ("3.5 stars") and arrow keys. The rating is sent when the
// finger or key lifts, not on every step of a drag.
export default function StarPicker({ legend, hideLegend = false, value, onChange }) {
  const id = useId()
  const [draft, setDraft] = useState(value ?? null)
  // When the saved rating changes (this phone or the other), show it.
  const [shown, setShown] = useState(value)
  if (value !== shown) {
    setShown(value)
    setDraft(value ?? null)
  }

  const dragging = useRef(false)

  function commit(next = draft) {
    if (next != null && next !== value) onChange(next)
  }

  // Where the finger is across the stars, in half stars: the left half of
  // the third star is 2.5, the right half is 3.
  function fromPointer(event) {
    const rect = event.currentTarget.getBoundingClientRect()
    const x = Math.min(Math.max(event.clientX - rect.left, 0), rect.width)
    return Math.max(0.5, Math.ceil((x / rect.width) * 10) / 2)
  }

  return (
    <div className="star-picker">
      <label htmlFor={id} className={hideLegend ? 'sr-only' : 'star-legend'}>
        {legend}
      </label>
      <div className="star-row">
        <div className="star-slider">
          <span className="stars-empty" aria-hidden="true">
            ★★★★★
          </span>
          <span className="stars-full" aria-hidden="true" style={{ width: `${((draft ?? 0) / 5) * 100}%` }}>
            ★★★★★
          </span>
          <input
            id={id}
            type="range"
            min="0"
            max="5"
            step="0.5"
            value={draft ?? 0}
            aria-valuetext={label(draft)}
            onChange={(e) => setDraft(Math.max(0.5, Number(e.target.value)))}
            onPointerDown={(e) => {
              e.preventDefault()
              e.currentTarget.focus()
              e.currentTarget.setPointerCapture?.(e.pointerId)
              dragging.current = true
              setDraft(fromPointer(e))
            }}
            onPointerMove={(e) => {
              if (dragging.current) setDraft(fromPointer(e))
            }}
            onPointerUp={(e) => {
              if (!dragging.current) return
              dragging.current = false
              const next = fromPointer(e)
              setDraft(next)
              commit(next)
            }}
            onKeyUp={() => commit()}
            onBlur={() => commit()}
          />
        </div>
        <span className="star-value" aria-hidden="true">
          {draft ? `${draft}★` : 'Tap a star'}
        </span>
      </div>
    </div>
  )
}
