import { useState } from 'react'
import Working from './Working'
import { updateRecipeFields } from '../lib/data'
import {
  NUTRIENTS,
  estimateBasis,
  estimateNutrition,
  forPortion,
  formatNutrient,
  isNutritionStale,
  nutritionTotals,
} from '../lib/nutrition'

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const servingText = (n) => `${n} ${n === 1 ? 'serving' : 'servings'}`

function NutrientTable({ caption, values }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--space-3)' }}>
      <caption style={{ textAlign: 'left', fontWeight: 600, marginBottom: 'var(--space-1)' }}>{caption}</caption>
      <tbody>
        {NUTRIENTS.map((n) => (
          <tr key={n.key} style={{ borderTop: '1px solid var(--color-border)' }}>
            <th scope="row" style={{ textAlign: 'left', fontWeight: 400, padding: 'var(--space-1) 0' }}>
              {n.label}
            </th>
            <td style={{ textAlign: 'right', fontWeight: n.key === 'calories' || n.key === 'protein_g' ? 600 : 400 }}>
              {formatNutrient(n.key, values[n.key])}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// Estimated calories and macros. Saved with the recipe, so it shows offline
// and on both phones; asks again only when someone taps Estimate.
export default function NutritionPanel({ recipe, ingredients, member, online, shownServings }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [eaten, setEaten] = useState(1)

  const nutrition = recipe.nutrition
  const stale = isNutritionStale(nutrition, recipe, ingredients)

  async function handleEstimate() {
    setBusy(true)
    setError('')
    const result = await estimateNutrition(recipe, ingredients, member)
    if (result.ok) await updateRecipeFields(recipe.id, { nutrition: result.nutrition })
    else setError(result.message)
    setBusy(false)
  }

  const estimateButton = (label) => (
    <button className="btn btn-secondary" type="button" onClick={handleEstimate} disabled={!online || busy || ingredients.length === 0}>
      {busy ? 'Estimating…' : label}
    </button>
  )

  if (!nutrition) {
    return (
      <section aria-labelledby="nutrition-heading">
        <h2 id="nutrition-heading">Nutrition</h2>
        <p className="hint">Gemini can estimate calories, protein, carbs, and fat from the ingredients.</p>
        {estimateButton('Estimate nutrition')}
        {!online && <p className="hint">Estimating needs the internet.</p>}
        {busy ? (
          <Working label="Gemini is estimating each ingredient…" typical="5 to 15 seconds" />
        ) : (
          <p role="status" className={error ? 'error' : 'hint'}>
            {error}
          </p>
        )}
      </section>
    )
  }

  // Numbers come from the lines and servings the estimate was made from,
  // so the breakdown stays right even after the recipe changes.
  const basis = estimateBasis(nutrition)
  const basisServings = basis.servings ?? recipe.base_servings
  const { total, perServing } = nutritionTotals(nutrition, basisServings)
  const portion = forPortion(perServing, eaten)
  const batch = forPortion(perServing, shownServings)
  const byNumber = new Map(nutrition.items.map((item) => [item.number, item]))
  const missing = basis.lines.length - nutrition.items.filter((i) => i.number <= basis.lines.length).length

  return (
    <section aria-labelledby="nutrition-heading">
      <h2 id="nutrition-heading">Nutrition (estimate)</h2>

      {stale && (
        <div className="card" style={{ background: 'var(--color-flag-bg)' }}>
          <p style={{ margin: '0 0 var(--space-2)' }}>
            The ingredients or servings changed since this was estimated. These numbers may be off.
          </p>
          {estimateButton('Estimate again')}
        </div>
      )}

      <div className="card">
        <div className="field" style={{ marginBottom: 'var(--space-3)' }}>
          <span id="eaten-label" style={{ fontWeight: 600 }}>
            How much you ate
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }} role="group" aria-labelledby="eaten-label">
            <button
              className="btn btn-secondary"
              type="button"
              onClick={() => setEaten((n) => Math.max(0.5, n - 0.5))}
              disabled={eaten <= 0.5}
              aria-label="Half a serving less"
            >
              −
            </button>
            <p style={{ margin: 0, fontWeight: 600 }} aria-live="polite">
              {servingText(eaten)}
            </p>
            <button className="btn btn-secondary" type="button" onClick={() => setEaten((n) => n + 0.5)} aria-label="Half a serving more">
              +
            </button>
          </div>
        </div>
        <NutrientTable caption={eaten === 1 ? 'Per serving' : `For ${servingText(eaten)}`} values={portion} />
        <p className="hint" style={{ margin: 0 }}>
          One serving is {Math.round(perServing.calories)} calories and {Math.round(perServing.protein_g)} g protein.
          Making {servingText(shownServings)} comes to {Math.round(batch.calories)} calories and{' '}
          {Math.round(batch.protein_g)} g protein in total.
        </p>
      </div>

      <details className="card">
        <summary style={{ minHeight: 'var(--target)', display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 600 }}>
          How this was estimated
        </summary>
        <p className="hint">
          Gemini estimated each ingredient for the recipe as written (serves {basisServings}), and the app added them up.
          Estimated {dateFormat.format(new Date(nutrition.estimated_at))}.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <caption className="sr-only">Estimate for each ingredient, whole recipe</caption>
            <thead>
              <tr>
                <th scope="col" style={{ textAlign: 'left' }}>
                  Ingredient
                </th>
                <th scope="col" style={{ textAlign: 'right', paddingLeft: 'var(--space-3)' }}>
                  Calories
                </th>
                <th scope="col" style={{ textAlign: 'right', paddingLeft: 'var(--space-3)' }}>
                  Protein
                </th>
              </tr>
            </thead>
            <tbody>
              {basis.lines.map((line, i) => {
                const item = byNumber.get(i + 1)
                return (
                  <tr key={i} style={{ borderTop: '1px solid var(--color-border)', verticalAlign: 'top' }}>
                    <td style={{ padding: 'var(--space-1) var(--space-2) var(--space-1) 0' }}>
                      {line}
                      {item?.assumption && <div className="hint">Assumed: {item.assumption}</div>}
                      {!item && <div className="hint">Not estimated</div>}
                    </td>
                    <td style={{ textAlign: 'right' }}>{item ? item.calories : '–'}</td>
                    <td style={{ textAlign: 'right' }}>{item ? `${item.protein_g} g` : '–'}</td>
                  </tr>
                )
              })}
              <tr style={{ borderTop: '2px solid var(--color-border)', fontWeight: 600 }}>
                <td>Whole recipe</td>
                <td style={{ textAlign: 'right' }}>{Math.round(total.calories)}</td>
                <td style={{ textAlign: 'right' }}>{Math.round(total.protein_g)} g</td>
              </tr>
            </tbody>
          </table>
        </div>
        {(nutrition.notes || missing > 0) && (
          <p className="hint" style={{ marginTop: 'var(--space-2)' }}>
            {nutrition.notes}
            {missing > 0 && ` ${missing} ${missing === 1 ? 'line was' : 'lines were'} not estimated, so totals are low.`}
          </p>
        )}
        <p className="hint">
          Estimates use typical values. Brands, cuts, and how much oil is absorbed can change the real numbers.
        </p>
        {!stale && estimateButton('Estimate again')}
      </details>
      {busy ? (
        <Working label="Gemini is estimating each ingredient…" typical="5 to 15 seconds" />
      ) : (
        <p role="status" className={error ? 'error' : 'hint'}>
          {error}
        </p>
      )}
    </section>
  )
}
