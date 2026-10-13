import { formatNumber, normalizeUnit, parseQuantity, unitKind, unitLabel } from './units.js'

// Count words that work like units ("2 cloves garlic").
const COUNT_UNITS = new Set([
  'clove', 'can', 'bunch', 'slice', 'piece', 'sprig', 'head', 'stalk', 'package',
  'pkg', 'jar', 'bottle', 'stick', 'handful', 'dash', 'pinch', 'sheet', 'bag',
  'box', 'container', 'carton', 'fillet', 'leaf', 'ear', 'strip', 'cube',
])

// Lines that are fine without an amount.
const NO_AMOUNT_OK = /\b(to taste|as needed|optional|for serving|for garnish|for frying|for greasing|for the pan|for brushing|pinch of|dash of)\b/i

// Splits a typed or pasted line like "1 1/2 cups flour, sifted" into
// { quantity, unit, item, prep_note, raw_text, needs_review }.
export function parseIngredientLine(line) {
  const raw_text = String(line ?? '').trim().replace(/^[-•*]\s*/, '')
  if (!raw_text) return null

  const tokens = raw_text.split(/\s+/)
  let quantity = null
  let index = 0

  // Take the longest run of leading tokens that reads as a quantity
  // ("1", "1 1/2", "½").
  for (let take = Math.min(3, tokens.length); take >= 1; take--) {
    const candidate = parseQuantity(tokens.slice(0, take).join(' '))
    if (candidate != null && /^[\d½¼¾⅓⅔⅛⅜⅝⅞⅕⅙.\s/-]+$/.test(tokens.slice(0, take).join(' '))) {
      quantity = candidate
      index = take
      break
    }
  }

  let unit = null
  if (quantity != null && index < tokens.length) {
    // Two-word units first ("fl oz"), then one word.
    const two = tokens.slice(index, index + 2).join(' ').replace(/[.,]$/, '')
    const one = tokens[index].replace(/[.,]$/, '')
    const twoUnit = normalizeUnit(two)
    const oneUnit = normalizeUnit(one)
    if (unitKind(twoUnit) !== 'other') {
      unit = twoUnit
      index += 2
    } else if (unitKind(oneUnit) !== 'other' || COUNT_UNITS.has(oneUnit)) {
      unit = oneUnit
      index += 1
    }
  }

  let rest = tokens.slice(index).join(' ').replace(/^of\s+/i, '')
  let prep_note = null
  const comma = rest.indexOf(',')
  if (comma > 0) {
    prep_note = rest.slice(comma + 1).trim() || null
    rest = rest.slice(0, comma).trim()
  }
  const item = rest || raw_text

  const needs_review = quantity == null && !NO_AMOUNT_OK.test(raw_text)

  return { quantity, unit, item, prep_note, raw_text, needs_review }
}

// The reverse, for showing a saved ingredient in the edit box.
export function ingredientToLine({ quantity, unit, item, prep_note }) {
  const parts = []
  if (quantity != null) parts.push(formatNumber(quantity))
  if (unit) parts.push(unitLabel(unit, quantity))
  parts.push(item)
  let line = parts.join(' ')
  if (prep_note) line += `, ${prep_note}`
  return line
}

// Steps: one per line or paragraph, with any leading "1." or "Step 1:" removed.
export function parseSteps(text) {
  return String(text ?? '')
    .split(/\n+/)
    .map((line) => line.trim().replace(/^(step\s*)?\d+[.):]\s*/i, ''))
    .filter(Boolean)
}

// ---------------------------------------------------------------------------
// Sections ("Filling:", "For the sauce:")
// ---------------------------------------------------------------------------

// A line that names a part of the ingredient list instead of an
// ingredient: it ends in a colon and has no amount. "For the sauce:" and
// "SAUCE:" both become "Sauce". "Ingredients:" isn't a section.
export function sectionHeading(line) {
  const text = String(line ?? '').trim().replace(/^[-•*#]+\s*/, '')
  const match = text.match(/^([^:\d½¼¾⅓⅔⅛]{1,60}):$/)
  if (!match) return null
  const name = match[1]
    .trim()
    .replace(/^for\s+(the\s+)?/i, '')
    .replace(/\s+/g, ' ')
  if (!name || /^(ingredients?|you(?:'ll)? need|what you need)$/i.test(name)) return ''
  return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
}

// The ingredient box's text into ingredients, each with the section it
// sits under (or null before any heading).
export function parseIngredientText(text) {
  let section = null
  const out = []
  for (const line of String(text ?? '').split('\n')) {
    if (!line.trim()) continue
    const heading = sectionHeading(line)
    if (heading !== null) {
      section = heading || null
      continue
    }
    const ing = parseIngredientLine(line)
    if (ing) out.push({ ...ing, section })
  }
  return out
}

// The reverse: one line per ingredient, with a "Section:" line wherever
// the section changes.
export function ingredientsToText(ingredients) {
  const lines = []
  let current = null
  for (const ing of ingredients) {
    const section = ing.section || null
    if (section !== current) {
      if (section) lines.push(`${section}:`)
      else if (lines.length) lines.push('Other:')
      current = section
    }
    lines.push(ingredientToLine(ing))
  }
  return lines.join('\n')
}

// Ingredients grouped for display: [{ section, items }], in list order.
export function groupBySection(ingredients) {
  const groups = []
  for (const ing of ingredients) {
    const section = ing.section || null
    const last = groups[groups.length - 1]
    if (last && last.section === section) last.items.push(ing)
    else groups.push({ section, items: [ing] })
  }
  return groups
}
