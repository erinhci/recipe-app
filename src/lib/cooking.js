import { displayIngredient, normalizeUnit, parseQuantity } from './units.js'

// Which ingredients a step mentions, so cooking mode can show their
// scaled amounts right under that step.

const STOP_WORDS = new Set([
  'fresh', 'large', 'small', 'medium', 'chopped', 'diced', 'minced', 'sliced', 'ground', 'whole',
  'dried', 'frozen', 'boneless', 'skinless', 'extra', 'virgin', 'unsalted', 'salted', 'light',
  'dark', 'raw', 'cooked', 'of', 'and', 'or', 'the', 'a', 'to', 'for',
])

function words(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/[^a-z\s-]/g, ' ')
    .split(/[\s-]+/)
    .filter(Boolean)
}

function singular(word) {
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`
  if (word.endsWith('oes')) return word.slice(0, -2)
  // Leave words like "glutinous", "hummus", and "asparagus" whole.
  if (word.endsWith('s') && !/(ss|us|is)$/.test(word) && word.length > 3) return word.slice(0, -1)
  return word
}

// The words that identify an ingredient: "2 large yellow onions" -> "yellow onion".
export function keyWords(item) {
  return words(item)
    .filter((w) => !STOP_WORDS.has(w))
    .map(singular)
}

// True when the step names the ingredient: either its full key phrase, or
// its main word (the last one, as in "soy sauce" -> "sauce") when that word
// isn't shared with another ingredient in the recipe.
function mentions(stepWords, stepText, ingredient, mainWordCounts) {
  const keys = keyWords(ingredient.item)
  if (keys.length === 0) return false
  if (stepText.includes(keys.join(' '))) return true
  const main = keys[keys.length - 1]
  return main.length > 2 && mainWordCounts.get(main) === 1 && stepWords.has(main)
}

export function ingredientsForStep(stepText, ingredients) {
  const stepWords = new Set(words(stepText).map(singular))
  const normalizedStep = words(stepText).map(singular).join(' ')
  const mainWordCounts = new Map()
  for (const ing of ingredients) {
    const keys = keyWords(ing.item)
    const main = keys[keys.length - 1]
    if (main) mainWordCounts.set(main, (mainWordCounts.get(main) ?? 0) + 1)
  }
  return ingredients.filter((ing) => mentions(stepWords, normalizedStep, ing, mainWordCounts))
}

// One ingredient as a line of text, scaled and in the chosen units.
export function ingredientLine(ing, factor, system) {
  const shown = displayIngredient(ing, factor, system)
  return [shown.text, ing.item].filter(Boolean).join(' ') + (ing.prep_note ? `, ${ing.prep_note}` : '')
}

// ---------------------------------------------------------------------------
// Amounts inside step text
// ---------------------------------------------------------------------------

// An amount like "4", "1/4", "1 1/2", or "½", optionally a range ("2-3"),
// then the next word, which may be its unit.
const AMOUNT = /(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+|[¼½¾⅓⅔⅛])(\s*(?:-|–|to)\s*(?:\d+\/\d+|\d*\.?\d+))?(\s+(fl\.?\s?oz\.?|[A-Za-z]+\.?))?/g

// Steps often repeat the ingredient amounts ("whisk 4 large eggs, 2 tbsp
// water"). This rewrites those amounts to match the scaled ingredient
// list, so the step and "You'll need" never disagree. An amount is only
// changed when it equals an ingredient's original amount and unit and is
// followed by that ingredient's name; anything else ("6 muffin cups",
// "18-20 minutes") is left alone.
// Returns parts: [{ text, scaled }], where scaled marks a changed amount.
export function scaleStepText(text, ingredients, factor = 1, system = 'us') {
  const source = String(text ?? '')
  const parts = []
  let last = 0
  for (const match of source.matchAll(AMOUNT)) {
    const [whole, number, range, , word] = match
    const start = match.index
    // Part of a longer number or word ("x2", "1/4-inch" is fine).
    if (start > 0 && /[\w/.]/.test(source[start - 1])) continue
    if (range) continue
    const value = parseQuantity(number)
    if (value == null) continue

    const wordUnit = word ? normalizeUnit(word) : null
    const best = bestIngredient(source, start + number.length, start + whole.length, value, word, wordUnit, ingredients)
    if (!best) continue

    const consumesUnit = Boolean(best.unit)
    const original = consumesUnit ? whole.trim() : number
    const shown = displayIngredient(best, factor, system).text
    if (!shown) continue
    if (start > last) parts.push({ text: source.slice(last, start), scaled: false })
    const changed = shown.replace(/\s+/g, ' ') !== original.replace(/\s+/g, ' ')
    parts.push({ text: changed ? shown : original, scaled: changed })
    last = start + original.length
  }
  if (last < source.length) parts.push({ text: source.slice(last), scaled: false })
  return parts
}

// The ingredient an amount in a step refers to, or null.
function bestIngredient(source, afterNumber, afterUnit, value, word, wordUnit, ingredients) {
  let best = null
  let bestScore = 0
  for (const ing of ingredients) {
    if (ing.quantity == null || Math.abs(Number(ing.quantity) - value) > 0.01) continue
    const ingUnit = ing.unit ? normalizeUnit(ing.unit) : null
    if (ingUnit && wordUnit !== ingUnit) continue
    if (!ingUnit && word && ['tsp', 'tbsp', 'cup', 'oz', 'lb', 'g', 'kg', 'ml', 'l'].includes(wordUnit)) continue
    // The words right after the amount (and unit), up to the next comma.
    const rest = source.slice(ingUnit ? afterUnit : afterNumber)
    const following = new Set(words(rest.split(/[,.;:(]/)[0]).slice(0, 7).map(singular))
    const keys = keyWords(ing.item)
    if (keys.length === 0 || !following.has(keys[keys.length - 1])) continue
    const score = keys.filter((k) => following.has(k)).length / keys.length
    if (score > bestScore) {
      best = ing
      bestScore = score
    }
  }
  return best
}

// Step text as plain text, with amounts scaled.
export function scaledStepString(text, ingredients, factor, system) {
  return scaleStepText(text, ingredients, factor, system).map((p) => p.text).join('')
}
