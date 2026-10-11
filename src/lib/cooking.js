import { displayIngredient } from './units.js'

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
