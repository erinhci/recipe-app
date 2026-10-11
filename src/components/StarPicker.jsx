import { useId } from 'react'

// 1–5 rating as a group of radio buttons, so it works with a keyboard and
// screen reader without extra code. Each choice says its number in words.
export default function StarPicker({ legend, hideLegend = false, value, onChange }) {
  const name = useId()
  return (
    <fieldset className="stars">
      <legend
        className={hideLegend ? 'sr-only' : undefined}
        style={hideLegend ? undefined : { fontWeight: 600, marginBottom: 'var(--space-2)', width: '100%' }}
      >
        {legend}
      </legend>
      {[1, 2, 3, 4, 5].map((n) => (
        <label key={n}>
          <input type="radio" name={name} value={n} checked={value === n} onChange={() => onChange(n)} />
          <span>
            {n}
            <span aria-hidden="true">★</span>
            <span className="sr-only">{n === 1 ? ' star' : ' stars'}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
