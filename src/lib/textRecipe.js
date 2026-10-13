import { parseQuantity } from './units.js'
import { sectionHeading } from './ingredients.js'

// Splits raw recipe text (pasted, read from a PDF, or read by OCR) into a
// title, ingredient lines, and steps, using section headers when present
// and the shape of each line when not. The review screen is where any
// mistakes get fixed.

const INGREDIENT_HEADER = /^\s*(ingredients?|you(?:'ll)? need|what you need)\s*:?\s*$/i
const STEP_HEADER = /^\s*(instructions?|directions?|method|steps|preparation|how to make( it)?)\s*:?\s*$/i
const SERVINGS = /\b(?:serves|servings?|yield|makes)\b\D{0,12}(\d+)/i
const STEP_NUMBER = /^\s*(?:step\s*)?\d+[.):]\s+/i

function startsWithAmount(line) {
  const first = line.trim().split(/\s+/).slice(0, 2).join(' ')
  return parseQuantity(first.split(' ')[0]) != null || /^[½¼¾⅓⅔⅛]/.test(first)
}

export function splitRecipeText(text) {
  const lines = String(text ?? '')
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)

  let servings = null
  for (const line of lines) {
    const match = line.match(SERVINGS)
    if (match) {
      servings = Number(match[1])
      break
    }
  }

  const ingredientStart = lines.findIndex((line) => INGREDIENT_HEADER.test(line))
  const stepStart = lines.findIndex((line) => STEP_HEADER.test(line))

  let title = ''
  let ingredientLines = []
  let steps = []

  if (ingredientStart !== -1) {
    const before = lines.slice(0, ingredientStart).filter((l) => !SERVINGS.test(l))
    title = before[0] ?? ''
    const ingredientEnd = stepStart > ingredientStart ? stepStart : lines.length
    ingredientLines = lines.slice(ingredientStart + 1, ingredientEnd)
    if (stepStart > ingredientStart) steps = lines.slice(stepStart + 1)
  } else {
    // No headers: lines that start with an amount are ingredients, longer
    // sentences are steps, and the first other line is the title.
    for (const line of lines) {
      if (SERVINGS.test(line) && line.length < 40) continue
      // "Sauce:" between ingredient lines starts a part of the list.
      if (ingredientLines.length > 0 && steps.length === 0 && sectionHeading(line)) ingredientLines.push(line)
      else if (startsWithAmount(line) && line.length < 80 && !STEP_NUMBER.test(line)) ingredientLines.push(line)
      else if (!title && line.length < 80 && steps.length === 0 && ingredientLines.length === 0) title = line
      else steps.push(line)
    }
  }

  // Steps often wrap across lines in OCR and PDFs: join lines that don't
  // start a new numbered step onto the previous one when numbers are used.
  if (steps.some((s) => STEP_NUMBER.test(s))) {
    const joined = []
    for (const line of steps) {
      if (STEP_NUMBER.test(line) || joined.length === 0) joined.push(line)
      else joined[joined.length - 1] += ` ${line}`
    }
    steps = joined
  }

  return {
    title: title.replace(/[:]$/, ''),
    servings,
    ingredientLines,
    steps: steps.map((s) => s.replace(STEP_NUMBER, '')),
  }
}
