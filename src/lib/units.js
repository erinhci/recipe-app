// Quantities, units, scaling, and display.
//
// Ingredients are stored as written (quantity + a standardized unit name),
// and converted only when shown. That keeps a metric recipe exact instead
// of rounding it into ounces at save time.

// ---------------------------------------------------------------------------
// Units
// ---------------------------------------------------------------------------

// Volume in teaspoons, weight in grams.
const VOLUME_TSP = {
  tsp: 1,
  tbsp: 3,
  fl_oz: 6,
  cup: 48,
  pint: 96,
  quart: 192,
  gallon: 768,
  ml: 1 / 4.92892,
  l: 1000 / 4.92892,
}
const WEIGHT_G = {
  oz: 28.3495,
  lb: 453.592,
  g: 1,
  kg: 1000,
}

const ALIASES = {
  tsp: ['t', 'tsp', 'tsps', 'teaspoon', 'teaspoons', 'tsp.'],
  tbsp: ['T', 'tbsp', 'tbsps', 'tbs', 'tbl', 'tablespoon', 'tablespoons', 'tbsp.'],
  fl_oz: ['fl oz', 'fl. oz.', 'fl.oz', 'fluid ounce', 'fluid ounces'],
  cup: ['c', 'cup', 'cups', 'c.'],
  pint: ['pt', 'pint', 'pints'],
  quart: ['qt', 'quart', 'quarts'],
  gallon: ['gal', 'gallon', 'gallons'],
  ml: ['ml', 'mL', 'milliliter', 'milliliters', 'millilitre', 'millilitres'],
  l: ['l', 'L', 'liter', 'liters', 'litre', 'litres'],
  oz: ['oz', 'ounce', 'ounces', 'oz.'],
  lb: ['lb', 'lbs', 'pound', 'pounds', 'lb.', 'lbs.'],
  g: ['g', 'gram', 'grams', 'gr', 'g.'],
  kg: ['kg', 'kilogram', 'kilograms', 'kgs'],
  pinch: ['pinch', 'pinches'],
}

const ALIAS_LOOKUP = new Map()
for (const [unit, names] of Object.entries(ALIASES)) {
  for (const name of names) {
    // "T" (tablespoon) and "t" (teaspoon) differ only by case, so
    // single-letter aliases are matched exactly; the rest ignore case.
    ALIAS_LOOKUP.set(name.length === 1 ? name : name.toLowerCase(), unit)
  }
}

// Returns a standard unit name ("tbsp", "cup", "g", …), the original word
// for units we don't convert ("clove", "can"), or null for none.
export function normalizeUnit(raw) {
  if (raw == null) return null
  const trimmed = String(raw).trim()
  if (!trimmed) return null
  if (ALIAS_LOOKUP.has(trimmed)) return ALIAS_LOOKUP.get(trimmed)
  const lower = trimmed.toLowerCase()
  if (lower.length > 1 && ALIAS_LOOKUP.has(lower)) return ALIAS_LOOKUP.get(lower)
  return singular(lower)
}

export function unitKind(unit) {
  if (unit in VOLUME_TSP) return 'volume'
  if (unit in WEIGHT_G) return 'weight'
  return 'other'
}

// ---------------------------------------------------------------------------
// Parsing quantities
// ---------------------------------------------------------------------------

const UNICODE_FRACTIONS = {
  '¼': 1 / 4, '½': 1 / 2, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3,
  '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8, '⅕': 1 / 5, '⅙': 1 / 6,
}

// "1 1/2", "1½", "2/3", "1.5", "2-3" (uses the first number). Null if none.
export function parseQuantity(text) {
  if (text == null) return null
  if (typeof text === 'number') return Number.isFinite(text) ? text : null
  let s = String(text).trim()
  if (!s) return null
  for (const [glyph, value] of Object.entries(UNICODE_FRACTIONS)) {
    s = s.replace(new RegExp(`(\\d)\\s*${glyph}`), (_, d) => `${d} ${value}`)
    s = s.replace(glyph, ` ${value}`)
  }
  s = s.split(/\s*(?:-|–|to)\s*/)[0].trim()
  let total = 0
  let found = false
  for (const part of s.split(/\s+/)) {
    if (/^\d+\/\d+$/.test(part)) {
      const [n, d] = part.split('/').map(Number)
      if (d === 0) return null
      total += n / d
      found = true
    } else if (/^\d*\.?\d+$/.test(part)) {
      total += Number(part)
      found = true
    } else if (found) {
      break
    } else {
      return null
    }
  }
  return found ? total : null
}

// ---------------------------------------------------------------------------
// Fractions people can measure
// ---------------------------------------------------------------------------

const SPOON_FRACTIONS = [0, 1 / 8, 1 / 4, 1 / 2, 3 / 4, 1]
const CUP_FRACTIONS = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1]
const COUNT_FRACTIONS = [0, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 3 / 4, 1]

const FRACTION_TEXT = new Map([
  [1 / 8, '1/8'], [1 / 4, '1/4'], [1 / 3, '1/3'], [1 / 2, '1/2'],
  [2 / 3, '2/3'], [3 / 4, '3/4'],
])

function roundTo(value, fractions) {
  const whole = Math.floor(value)
  const rest = value - whole
  let best = fractions[0]
  for (const f of fractions) {
    if (Math.abs(rest - f) < Math.abs(rest - best)) best = f
  }
  return whole + best
}

export function formatNumber(value) {
  if (value == null) return ''
  const whole = Math.floor(value + 1e-9)
  const rest = value - whole
  if (rest < 1e-6) return String(whole)
  for (const [f, text] of FRACTION_TEXT) {
    if (Math.abs(rest - f) < 1e-6) return whole ? `${whole} ${text}` : text
  }
  // Not a kitchen fraction (metric or odd values): up to one decimal.
  return String(Math.round(value * 10) / 10)
}

// ---------------------------------------------------------------------------
// Converting and choosing a display unit
// ---------------------------------------------------------------------------

const UNIT_LABEL = {
  tsp: ['tsp', 'tsp'],
  tbsp: ['tbsp', 'tbsp'],
  cup: ['cup', 'cups'],
  fl_oz: ['fl oz', 'fl oz'],
  pint: ['pint', 'pints'],
  quart: ['quart', 'quarts'],
  gallon: ['gallon', 'gallons'],
  ml: ['ml', 'ml'],
  l: ['l', 'l'],
  oz: ['oz', 'oz'],
  lb: ['lb', 'lb'],
  g: ['g', 'g'],
  kg: ['kg', 'kg'],
  pinch: ['pinch', 'pinches'],
}

export function unitLabel(rawUnit, quantity) {
  const plural = quantity != null && quantity > 1
  // Units saved before normalizing (or by hand) may already be plural
  // ("cups", "cloves"), so start from the singular form.
  const unit = normalizeUnit(rawUnit) ?? rawUnit
  const labels = UNIT_LABEL[unit]
  if (labels) return plural ? labels[1] : labels[0]
  // Count words like "clove" or "can": simple English plurals.
  if (!plural) return unit
  return /(ch|sh|x|s)$/.test(unit) ? `${unit}es` : `${unit}s`
}

// Count words are stored singular ("cloves" -> "clove") so display can
// choose the right form for the scaled amount.
function singular(word) {
  if (/(ches|shes|xes)$/.test(word)) return word.slice(0, -2)
  if (/[^s]s$/.test(word)) return word.slice(0, -1)
  return word
}

function usVolume(tsp) {
  if (tsp < 1 / 16) return { quantity: 1, unit: 'pinch' }
  if (tsp >= 12) {
    const cups = roundTo(tsp / 48, CUP_FRACTIONS)
    const cupError = Math.abs(cups * 48 - tsp) / tsp
    // Under half a cup, a whole number of tablespoons is often closer
    // (3/8 cup is exactly 6 tbsp, but rounds to 1/3 cup).
    const tbsp = tsp / 3
    if (cupError > 0.05 && tsp < 24 && Math.abs(tbsp - Math.round(tbsp)) / tbsp < 0.05) {
      return { quantity: Math.round(tbsp), unit: 'tbsp' }
    }
    return { quantity: cups, unit: 'cup' }
  }
  if (tsp >= 3) {
    const tbsp = roundTo(tsp / 3, SPOON_FRACTIONS)
    // 1/3 tbsp and the like read better as teaspoons.
    if (!Number.isInteger(tbsp) && tbsp < 2) {
      return { quantity: roundTo(tsp, SPOON_FRACTIONS), unit: 'tsp' }
    }
    return { quantity: tbsp, unit: 'tbsp' }
  }
  return { quantity: Math.max(roundTo(tsp, SPOON_FRACTIONS), 1 / 8), unit: 'tsp' }
}

function metricVolume(tsp, originalUnit) {
  // Measuring spoons are used everywhere, so amounts written in spoons
  // stay spoons. Cups and fluid ounces become milliliters at any size
  // (a quarter cup scaled down is "20 ml", not "4 tsp").
  if (originalUnit === 'tsp' || originalUnit === 'tbsp') return usVolume(tsp)
  const ml = tsp * 4.92892
  if (ml >= 1000) return { quantity: Math.round(ml / 100) / 10, unit: 'l' }
  const step = ml >= 100 ? 10 : ml >= 20 ? 5 : 1
  return { quantity: Math.max(1, Math.round(ml / step) * step), unit: 'ml' }
}

function usWeight(g) {
  const oz = g / 28.3495
  if (oz >= 16) return { quantity: roundTo(oz / 16, [0, 1 / 4, 1 / 2, 3 / 4, 1]), unit: 'lb' }
  return { quantity: Math.max(roundTo(oz, [0, 1 / 4, 1 / 2, 3 / 4, 1]), 1 / 4), unit: 'oz' }
}

function metricWeight(g) {
  if (g >= 1000) return { quantity: Math.round(g / 100) / 10, unit: 'kg' }
  if (g >= 100) return { quantity: Math.round(g / 5) * 5, unit: 'g' }
  return { quantity: Math.max(Math.round(g), 1), unit: 'g' }
}

const EGG = /\beggs?\b/i

// Scale one ingredient and pick how to show it.
//   ingredient: { quantity, unit, item }
//   factor: target servings / recipe servings
//   system: 'us' | 'metric'
// Returns { quantity, unit, text, note }.
export function displayIngredient(ingredient, factor = 1, system = 'us') {
  const { quantity, unit, item = '' } = ingredient
  if (quantity == null) return { quantity: null, unit: unit ?? null, text: '', note: null }

  const scaled = quantity * factor
  const kind = unitKind(unit)
  let shown

  if (kind === 'volume') {
    const tsp = scaled * VOLUME_TSP[unit]
    shown = system === 'metric' ? metricVolume(tsp, unit) : usVolume(tsp)
  } else if (kind === 'weight') {
    const g = scaled * WEIGHT_G[unit]
    shown = system === 'metric' ? metricWeight(g) : usWeight(g)
  } else {
    shown = { quantity: roundTo(scaled, COUNT_FRACTIONS), unit: unit ?? null }
    if (shown.quantity === 0) shown.quantity = roundTo(scaled, [0, 1 / 8, 1 / 4]) || 1 / 8
  }

  let note = null
  // Eggs don't divide neatly. Suggest something you can actually do.
  if (!unit && EGG.test(item) && !Number.isInteger(shown.quantity)) {
    const up = Math.ceil(scaled)
    const exact = formatNumber(roundTo(scaled, COUNT_FRACTIONS))
    note = `Use ${up} small egg${up > 1 ? 's' : ''}, or beat ${up} and use ${exact} of the mixture.`
  }

  const label = shown.unit ? unitLabel(shown.unit, shown.quantity) : ''
  const amount = shown.unit === 'pinch' ? 'a' : formatNumber(shown.quantity)
  const text = label ? `${amount} ${label}` : amount
  return { quantity: shown.quantity, unit: shown.unit, text, note }
}

// Servings factor, guarded against missing or zero servings.
export function scaleFactor(baseServings, targetServings) {
  const base = Number(baseServings)
  const target = Number(targetServings)
  if (!base || base <= 0 || !target || target <= 0) return 1
  return target / base
}
