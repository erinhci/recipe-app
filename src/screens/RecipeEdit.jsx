import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import Page from '../components/Page'
import { useAuth } from '../lib/auth'
import { loadRecipe, saveRecipe } from '../lib/data'
import OriginalPanel from '../components/OriginalPanel'
import { ingredientToLine, parseIngredientLine, parseSteps } from '../lib/ingredients'
import { CUISINES, MEAL_TYPES } from '../lib/constants'

const SOURCE_TYPES = { images: 'photo', pdf: 'pdf', url: 'url', text: 'text' }

// Add or edit a recipe. Ingredients and steps are typed or pasted one per
// line; the preview shows how each ingredient line was read and flags
// lines that need a look before saving.
export default function RecipeEdit() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const location = useLocation()
  const { member } = useAuth()

  // An imported draft arrives with the original screenshots, PDF, or link.
  const incoming = isNew ? location.state : null
  const draft = incoming?.form
  // A change Gemini drafted from a note, opened here to adjust before saving.
  const proposed = isNew ? null : location.state?.proposed

  const [loaded, setLoaded] = useState(isNew)
  const [existing, setExisting] = useState(null)
  const [title, setTitle] = useState(draft?.title ?? '')
  const [servings, setServings] = useState(draft ? draft.servings : '4')
  const [cuisine, setCuisine] = useState(draft?.cuisine ?? '')
  const [mealType, setMealType] = useState(draft?.mealType ?? '')
  const [totalTime, setTotalTime] = useState(draft?.totalTime ? String(draft.totalTime) : '')
  const [prepTime, setPrepTime] = useState(draft?.prepTime ? String(draft.prepTime) : '')
  const [cookTime, setCookTime] = useState(draft?.cookTime ? String(draft.cookTime) : '')
  const [sourceUrl, setSourceUrl] = useState(draft?.sourceUrl || incoming?.originals?.url || '')
  const [sourceName, setSourceName] = useState(draft?.sourceName ?? '')
  const [ingredientText, setIngredientText] = useState(draft?.ingredientText ?? '')
  const [stepText, setStepText] = useState(draft?.stepText ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isNew) return
    loadRecipe(id).then((data) => {
      if (data) {
        const { recipe, ingredients, steps } = data
        setExisting(data)
        setTitle(recipe.title)
        setServings(String(recipe.base_servings ?? ''))
        setCuisine(recipe.cuisine ?? '')
        setMealType(recipe.meal_type ?? '')
        setTotalTime(recipe.total_time_minutes ? String(recipe.total_time_minutes) : '')
        setPrepTime(recipe.prep_minutes ? String(recipe.prep_minutes) : '')
        setCookTime(recipe.cook_minutes ? String(recipe.cook_minutes) : '')
        setSourceUrl(recipe.source_url ?? '')
        setSourceName(recipe.source_name ?? '')
        setIngredientText(proposed?.ingredientText ?? ingredients.map(ingredientToLine).join('\n'))
        setStepText(proposed?.stepText ?? steps.map((s) => s.text).join('\n\n'))
      }
      setLoaded(true)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isNew])

  const parsed = useMemo(
    () => ingredientText.split('\n').map(parseIngredientLine).filter(Boolean),
    [ingredientText],
  )
  const flagged = parsed.filter((ing) => ing.needs_review).length

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    const base = Number(servings)
    if (!title.trim()) return setError('Add a title.')
    if (!base || base <= 0) return setError('Servings must be a number above 0.')
    // Times are whole minutes or blank. A blank total is prep plus cook.
    const readMinutes = (text) => (text.trim() ? Number(text) : null)
    const prep = readMinutes(prepTime)
    const cook = readMinutes(cookTime)
    let minutes = readMinutes(totalTime)
    for (const [name, value] of [['Prep time', prep], ['Cook time', cook], ['Total time', minutes]]) {
      if (value !== null && !(Number.isInteger(value) && value > 0)) {
        return setError(`${name} must be a whole number of minutes, or left blank.`)
      }
    }
    if (minutes === null && (prep || cook)) minutes = (prep ?? 0) + (cook ?? 0)
    if (parsed.length === 0) return setError('Add at least one ingredient.')

    // Reuse ids by position so an edit changes rows instead of replacing them.
    const ingredients = parsed.map((ing, i) => ({ ...ing, id: existing?.ingredients[i]?.id }))
    const steps = parseSteps(stepText).map((text, i) => ({ text, id: existing?.steps[i]?.id }))

    setBusy(true)
    try {
      const savedId = await saveRecipe(
        {
          recipe: {
            ...(existing?.recipe ?? {}),
            id: existing?.recipe.id,
            title: title.trim(),
            base_servings: base,
            cuisine: cuisine || null,
            meal_type: mealType || null,
            source_url: sourceUrl.trim() || null,
            source_name: sourceName.trim() || null,
            source_type:
              existing?.recipe.source_type ??
              SOURCE_TYPES[incoming?.originals?.kind] ??
              (sourceUrl.trim() ? 'url' : 'manual'),
            total_time_minutes: minutes,
            // Sent only when set (or already stored), so saving works before
            // migration 0009 adds these columns.
            ...(prep !== null || existing?.recipe && 'prep_minutes' in existing.recipe ? { prep_minutes: prep } : {}),
            ...(cook !== null || existing?.recipe && 'cook_minutes' in existing.recipe ? { cook_minutes: cook } : {}),
          },
          ingredients,
          steps,
        },
        member,
        proposed?.change ?? null,
      )
      // The original screenshot or PDF is only for checking the import; it isn't kept.
      navigate(`/recipe/${savedId}`, { replace: true })
    } catch (e) {
      setError(e.message)
      setBusy(false)
    }
  }

  if (!loaded) {
    return (
      <Page title="Edit recipe">
        <p role="status">Loading…</p>
      </Page>
    )
  }

  if (!isNew && !existing) {
    return (
      <Page title="Recipe not found">
        <p>This recipe isn't on this phone. It may have been deleted.</p>
      </Page>
    )
  }

  return (
    <Page title={incoming ? 'Check the recipe' : isNew ? 'New recipe' : 'Edit recipe'}>
      {incoming && (
        <>
          <p>
            {incoming.method === 'gemini'
              ? 'Gemini read this recipe. Compare it with the original and fix anything it got wrong.'
              : incoming.method === 'page-data'
                ? "This came from the recipe data on the page. Give it a quick check."
                : 'This phone sorted the text into a recipe. Check the title, ingredients, and steps.'}
          </p>
          <OriginalPanel originals={incoming.originals} />
          {incoming.originals?.files?.length > 0 && (
            <p className="hint">The original isn't kept after you save. If it credits someone, that goes in Credit below.</p>
          )}
        </>
      )}
      {proposed && (
        <p>Gemini's suggested change is filled in below. Adjust it, then save. Nothing is saved until you do.</p>
      )}
      <form onSubmit={handleSubmit} noValidate>
        <div className="field">
          <label htmlFor="title">Title</label>
          <input id="title" required value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="field">
          <label htmlFor="servings">The recipe as written serves</label>
          <input
            id="servings"
            inputMode="decimal"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            aria-describedby="servings-hint"
          />
          <span id="servings-hint" className="hint">
            Enter the original amount. The recipe opens scaled to 2.
          </span>
        </div>

        <fieldset className="time-fields" aria-describedby="time-hint">
          <legend>Time, in minutes</legend>
          <div className="field">
            <label htmlFor="prep-time">Prep</label>
            <input id="prep-time" inputMode="numeric" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cook-time">Cook</label>
            <input id="cook-time" inputMode="numeric" value={cookTime} onChange={(e) => setCookTime(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="total-time">Total</label>
            <input
              id="total-time"
              inputMode="numeric"
              value={totalTime}
              placeholder={prepTime || cookTime ? String((Number(prepTime) || 0) + (Number(cookTime) || 0)) : ''}
              onChange={(e) => setTotalTime(e.target.value)}
            />
          </div>
          <p id="time-hint" className="hint">
            Shown before you start cooking, so you can plan when to start things like preheating. A blank total is prep
            plus cook. Each time you log this recipe, the total adds to your time cooking together in Stats.
          </p>
        </fieldset>

        <div className="field">
          <label htmlFor="cuisine">Cuisine</label>
          <select id="cuisine" value={cuisine} onChange={(e) => setCuisine(e.target.value)}>
            <option value="">Not set</option>
            {CUISINES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="meal-type">Meal type</label>
          <select id="meal-type" value={mealType} onChange={(e) => setMealType(e.target.value)}>
            <option value="">Not set</option>
            {MEAL_TYPES.map((m) => (
              <option key={m} value={m}>
                {m[0].toUpperCase() + m.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="ingredients">Ingredients</label>
          <textarea
            id="ingredients"
            rows={8}
            value={ingredientText}
            onChange={(e) => setIngredientText(e.target.value)}
            aria-describedby="ingredients-hint"
          />
          <span id="ingredients-hint" className="hint">
            One per line, like "1 1/2 cups flour, sifted". Pasting a list works.
          </span>
        </div>

        {parsed.length > 0 && (
          <section className="card" aria-labelledby="preview-heading">
            <h2 id="preview-heading" style={{ fontSize: 'var(--text-md)' }}>
              How the ingredients were read
            </h2>
            {flagged > 0 && (
              <p className="hint">
                {flagged} {flagged === 1 ? 'line has' : 'lines have'} no amount. Check{' '}
                {flagged === 1 ? 'it' : 'them'} before saving.
              </p>
            )}
            <ul>
              {parsed.map((ing, i) => (
                <li
                  key={i}
                  className={ing.needs_review ? 'flagged' : undefined}
                >
                  {ing.quantity != null ? <strong>{ingredientToLine({ ...ing, item: '', prep_note: null }).trim()}</strong> : <em>no amount</em>}
                  {' · '}
                  {ing.item}
                  {ing.prep_note ? ` (${ing.prep_note})` : ''}
                  {ing.needs_review && <span className="sr-only"> (needs a look)</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="field">
          <label htmlFor="steps">Steps</label>
          <textarea
            id="steps"
            rows={8}
            value={stepText}
            onChange={(e) => setStepText(e.target.value)}
            aria-describedby="steps-hint"
          />
          <span id="steps-hint" className="hint">
            One step per line or paragraph. Numbers are removed automatically.
          </span>
        </div>

        <div className="field">
          <label htmlFor="credit">Credit (optional)</label>
          <input
            id="credit"
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            aria-describedby="credit-hint"
          />
          <span id="credit-hint" className="hint">
            Who the recipe is from, like a website, cookbook, or person.
          </span>
        </div>

        <div className="field">
          <label htmlFor="source">Source link (optional)</label>
          <input
            id="source"
            type="url"
            inputMode="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />
        </div>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button className="btn" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save recipe'}
        </button>{' '}
        <button className="btn btn-secondary" type="button" onClick={() => navigate(-1)}>
          Cancel
        </button>
      </form>
    </Page>
  )
}
