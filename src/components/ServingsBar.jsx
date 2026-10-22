// Servings stepper for cooking modes, with a reminder when the amounts
// are scaled away from what the recipe makes.
export default function ServingsBar({ servings, base, onChange, note }) {
  const recipeMakes = Number(base) || null
  return (
    <div className="servings-bar">
      <div className="stepper">
        <button
          className="btn btn-secondary"
          type="button"
          onClick={() => onChange(Math.max(1, servings - 1))}
          disabled={servings <= 1}
          aria-label="One fewer serving"
        >
          −
        </button>
        <p className="num" style={{ margin: 0, fontWeight: 600 }} aria-live="polite">
          {servings} {servings === 1 ? 'serving' : 'servings'}
        </p>
        <button className="btn btn-secondary" type="button" onClick={() => onChange(servings + 1)} aria-label="One more serving">
          +
        </button>
      </div>
      {recipeMakes && recipeMakes !== servings ? (
        <p className="hint" style={{ margin: 0 }}>
          Written for {recipeMakes}.{' '}
          <button className="link-btn" type="button" onClick={() => onChange(recipeMakes)}>
            Make {recipeMakes}
          </button>
        </p>
      ) : null}
      {note && (
        <p className="hint" style={{ margin: 0 }}>
          {note}
        </p>
      )}
    </div>
  )
}
