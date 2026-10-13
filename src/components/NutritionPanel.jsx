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
    <table className="nutrients">
      <caption>{caption}</caption>
      <tbody>
        {NUTRIENTS.map((n) => (
          <tr key={n.key}>
            <th scope="row" style={{ fontWeight: 400 }}>
              {n.label}
            </th>
            <td className="num" style={{ fontWeight: n.key === 'calories' || n.key === 'protein_g' ? 600 : 400 }}>
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
// headless: no section or heading, for when the recipe page's own
// collapsible section already gives it one.
export default function NutritionPanel({ recipe, ingredients, member, online, shownServings, headless = false }) {
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
    <div className="actions">
      <button className="btn btn-secondary" type="button" onClick={handleEstimate} disabled={!online || busy || ingredients.length === 0}>
        {busy ? 'Estimating…' : label}
      </button>
    </div>
  )

  if (!nutrition) {
    const Wrap = headless ? 'div' : 'section'
    return (
      <Wrap aria-labelledby={headless ? undefined : 'nutrition-heading'}>
        {!headless && <h2 id="nutrition-heading">Nutrition</h2>}
        {estimateButton('Estimate calories and protein')}
        {!online && <p className="hint">Needs the internet.</p>}
        {busy ? (
          <Working label="Gemini is estimating each ingredient…" typical="5 to 15 seconds" />
        ) : (
          <p role="status" className={error ? 'error' : 'hint'}>
            {error}
          </p>
        )}
      </Wrap>
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

  const Wrap = headless ? 'div' : 'section'
  return (
    <Wrap aria-labelledby={headless ? undefined : 'nutrition-heading'}>
      {headless ? (
        <p className="hint" style={{ marginTop: 0 }}>
          Per serving, estimated.
        </p>
      ) : (
        <h2 id="nutrition-heading">
          Nutrition <span className="heading-note">per serving, estimated</span>
        </h2>
      )}

      {stale && (
        <>
          <p className="notice-line">The recipe changed since this estimate.</p>
          {estimateButton('Estimate again')}
        </>
      )}

      <ul className="nutrient-tiles">
        {NUTRIENTS.map((n) => (
          <li key={n.key}>
            <span className="nutrient-value">{formatNutrient(n.key, perServing[n.key])}</span>
            <span className="nutrient-label">{n.label}</span>
          </li>
        ))}
      </ul>

      <details className="card">
        <summary>Portions and breakdown</summary>
        <p style={{ margin: 'var(--space-3) 0 var(--space-1)', fontWeight: 600 }}>How much you ate</p>
        <div className="stepper" role="group" aria-label="How much you ate" style={{ marginBottom: 'var(--space-3)' }}>
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
        <NutrientTable caption={eaten === 1 ? 'Per serving' : `For ${servingText(eaten)}`} values={portion} />
        <p className="hint" style={{ margin: 0 }}>
          All {servingText(shownServings)}: {Math.round(batch.calories)} calories, {Math.round(batch.protein_g)} g protein.
        </p>
        <h3 className="subheading" style={{ marginTop: 'var(--space-4)' }}>
          By ingredient
        </h3>
        <p className="hint">
          By ingredient, for the recipe as written (serves {basisServings}). Estimated {dateFormat.format(new Date(nutrition.estimated_at))}.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ fontSize: 'var(--text-sm)' }}>
            <caption className="sr-only">Estimate for each ingredient, whole recipe</caption>
            <thead>
              <tr>
                <th scope="col">
                  Ingredient
                </th>
                <th scope="col" className="num">
                  Calories
                </th>
                <th scope="col" className="num">
                  Protein
                </th>
              </tr>
            </thead>
            <tbody>
              {basis.lines.map((line, i) => {
                const item = byNumber.get(i + 1)
                return (
                  <tr key={i}>
                    <td>
                      {line}
                      {item?.assumption && <div className="hint">Assumed: {item.assumption}</div>}
                      {!item && <div className="hint">Not estimated</div>}
                    </td>
                    <td className="num">{item ? item.calories : '–'}</td>
                    <td className="num">{item ? `${item.protein_g} g` : '–'}</td>
                  </tr>
                )
              })}
              <tr className="total">
                <td>Whole recipe</td>
                <td className="num">{Math.round(total.calories)}</td>
                <td className="num">{Math.round(total.protein_g)} g</td>
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
        <p className="hint">Typical values; brands and cuts vary.</p>
        {!stale && estimateButton('Estimate again')}
      </details>
      {busy ? (
        <Working label="Gemini is estimating each ingredient…" typical="5 to 15 seconds" />
      ) : (
        <p role="status" className={error ? 'error' : 'hint'}>
          {error}
        </p>
      )}
    </Wrap>
  )
}
