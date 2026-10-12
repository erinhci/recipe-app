import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { updateMeal } from '../lib/data'
import { changesEstimated, estimateChanges, formatNutrient, mealTotals } from '../lib/nutrition'

const SERVING_CHOICES = Array.from({ length: 12 }, (_, i) => i + 1)

// What was made that day: servings, the changes logged while cooking, and
// nutrition for what was actually made (the recipe estimate scaled to the
// servings, plus the changes).
export default function MealDetails({ recipe, meal, changes, online }) {
  const id = useId()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const record = meal.entries.find((e) => e.servings) ?? meal.entries.find((e) => e.nutrition) ?? null
  const servings = record?.servings ? Number(record.servings) : null
  const saved = meal.entries.find((e) => e.nutrition)?.nutrition ?? null
  const changeTexts = changes.map((c) => c.body)
  const estimated = changesEstimated(saved, changeTexts)
  const totals = mealTotals(recipe, servings, saved, estimated && changeTexts.length > 0)

  async function estimate() {
    setBusy(true)
    setError('')
    const result = await estimateChanges(recipe, changeTexts)
    if (result.ok) await updateMeal(meal.ids, { nutrition: result.nutrition })
    else setError(result.message)
    setBusy(false)
  }

  return (
    <span className="meal-details">
      <span className="meal-servings">
        <label htmlFor={`${id}-servings`}>Made</label>{' '}
        <select id={`${id}-servings`} value={servings ?? ''} onChange={(e) => updateMeal(meal.ids, { servings: Number(e.target.value) })}>
          {!servings && <option value="">–</option>}
          {SERVING_CHOICES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>{' '}
        {servings === 1 ? 'serving' : 'servings'}
      </span>

      {changes.length > 0 && (
        <ul className="meal-changes">
          {changes.map((change) => (
            <li key={change.id}>
              <span>{change.body}</span>{' '}
              <Link to={`/recipe/${recipe.id}/note/${change.id}`} className="small-link">
                Update recipe<span className="sr-only"> with this change</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {totals ? (
        <span className="meal-nutrition">
          {formatNutrient('calories', totals.perServing.calories)} cal, {formatNutrient('protein_g', totals.perServing.protein_g)} protein per serving
          {changeTexts.length > 0 && estimated && ' (with changes)'}
        </span>
      ) : (
        servings &&
        !recipe.nutrition?.items?.length && <span className="meal-nutrition">Estimate the recipe's nutrition to see this cook's.</span>
      )}
      {totals && changeTexts.length > 0 && !estimated && (
        <button className="link-btn" type="button" onClick={estimate} disabled={!online || busy}>
          {busy ? 'Estimating…' : 'Add your changes to the nutrition'}
        </button>
      )}
      {error && (
        <span className="error" role="alert" style={{ display: 'block' }}>
          {error}
        </span>
      )}
    </span>
  )
}
