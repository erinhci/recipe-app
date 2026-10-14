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

// Words that, right after an ingredient's name, mean the step isn't using
// it as an ingredient: "water droplets", "water bath", "oil level".
const NOT_AN_INGREDIENT_AFTER = new Set([
  'droplet', 'drip', 'bath', 'level', 'line', 'vapor', 'steam', 'spot', 'mark', 'bead', 'splash',
  // "the egg mixture" is something already made, not the eggs.
  'mixture',
])

// True when the phrase appears as whole words in the step, and at least
// once not followed by one of the words above.
// skip: word positions already taken by a longer ingredient name, so
// "onion" doesn't match inside "green onion".
function phraseStarts(stepWords, phrase) {
  const starts = []
  for (let i = 0; i + phrase.length <= stepWords.length; i += 1) {
    if (phrase.every((w, j) => stepWords[i + j] === w) && !NOT_AN_INGREDIENT_AFTER.has(stepWords[i + phrase.length])) {
      starts.push(i)
    }
  }
  return starts
}

function hasPhrase(stepWords, phrase, skip = null) {
  return phraseStarts(stepWords, phrase).some((i) => !skip || !phrase.some((_, j) => skip.has(i + j)))
}

// True when phrase appears as a run of words inside a longer one:
// "onion" in "green onion".
function isInside(phrase, longer) {
  if (phrase.length >= longer.length) return false
  for (let i = 0; i + phrase.length <= longer.length; i += 1) {
    if (phrase.every((w, j) => longer[i + j] === w)) return true
  }
  return false
}

// The word positions each ingredient can't use because a longer name
// that contains it is written there.
function takenPositions(stepWords, ingredients) {
  const names = ingredients.map((ing) => keyWords(ing.item))
  return names.map((name) => {
    const taken = new Set()
    for (const other of names) {
      if (!isInside(name, other)) continue
      for (const start of phraseStarts(stepWords, other)) {
        for (let j = 0; j < other.length; j += 1) taken.add(start + j)
      }
    }
    return taken
  })
}

// True when the step names the ingredient: either its full key phrase, or
// its main word (the last one, as in "soy sauce" -> "sauce") when that word
// isn't shared with another ingredient in the recipe. Matching is by whole
// words, so "boil" never matches "oil".
function mentions(stepWords, ingredient, mainWordCounts, taken) {
  const keys = keyWords(ingredient.item)
  if (keys.length === 0) return false
  if (hasPhrase(stepWords, keys, taken)) return true
  const main = keys[keys.length - 1]
  return main.length > 2 && mainWordCounts.get(main) === 1 && hasPhrase(stepWords, [main], taken)
}

// Amounts written in the step, as { low, high, unit }: "1-2 tablespoons"
// is { low: 1, high: 2, unit: 'tbsp' }.
function stepAmounts(stepText) {
  const found = []
  const re = /(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+|[¼½¾⅓⅔⅛])(?:\s*(?:-|–|to)\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.\d+|\d+))?\s+(fl\.?\s?oz\.?|[A-Za-z]+\.?)/g
  for (const [, a, b, word] of String(stepText ?? '').matchAll(re)) {
    const low = parseQuantity(a)
    const high = b ? parseQuantity(b) : low
    if (low == null || high == null) continue
    found.push({ low, high, unit: normalizeUnit(word) })
  }
  return found
}

function amountMatches(ing, amounts) {
  if (ing.quantity == null) return false
  const unit = ing.unit ? normalizeUnit(ing.unit) : null
  return amounts.some((a) => a.unit === unit && ing.quantity >= a.low - 1e-9 && ing.quantity <= a.high + 1e-9)
}

// Recipes often list the same thing twice for two parts ("1 tbsp water" for
// the pudding, "1/2 cup water" for the syrup). A step shows only one of
// them, picked in this order:
// 1. the one whose amount the step names ("1-2 tablespoons of water");
// 2. the one listed nearest the step's other ingredients (the syrup's
//    water sits next to its brown sugar and ginger);
// 3. otherwise by order: the first step to mention it gets the first one,
//    the next step the second, and so on.
function pickOne(group, { stepText, anchors, ingredients, earlierMentions }) {
  let candidates = group
  const amounts = stepAmounts(stepText)
  const byAmount = candidates.filter((ing) => amountMatches(ing, amounts))
  if (byAmount.length > 0) candidates = byAmount
  if (candidates.length === 1) return candidates[0]

  if (anchors.length > 0) {
    const index = (ing) => ingredients.indexOf(ing)
    const distance = (ing) => anchors.reduce((sum, a) => sum + Math.abs(index(a) - index(ing)), 0)
    const best = Math.min(...candidates.map(distance))
    const nearest = candidates.filter((ing) => distance(ing) === best)
    if (nearest.length === 1) return nearest[0]
    candidates = nearest
  }
  return candidates[Math.min(earlierMentions, candidates.length - 1)]
}

// True when a step refers to a whole part of the ingredient list: "add
// the sauce ingredients", "For the sauce, whisk...", "make the dressing".
// "Pour the sauce over the rolls" uses the finished sauce, so it doesn't.
function namesSection(stepWords, section) {
  const s = keyWords(section).join(' ')
  if (!s) return false
  const text = ` ${stepWords.join(' ')} `
  return [
    ` ${s} ingredient `,
    ` ingredient for the ${s} `,
    ` ingredient for ${s} `,
    ` make the ${s} `,
    ` prepare the ${s} `,
    ` mix the ${s} `,
    ` whisk together the ${s} `,
    ` stir together the ${s} `,
  ].some((phrase) => text.includes(phrase)) || text.startsWith(` for the ${s} `) || text.startsWith(` ${s} `)
}

// The ingredients a step uses, in recipe order. earlierSteps (the text of
// the steps before this one) only matters when an ingredient is listed
// more than once.
export function ingredientsForStep(stepText, ingredients, earlierSteps = []) {
  const stepWords = words(stepText).map(singular)
  const mainWordCounts = new Map()
  for (const ing of ingredients) {
    const keys = keyWords(ing.item)
    const main = keys[keys.length - 1]
    if (main) mainWordCounts.set(main, (mainWordCounts.get(main) ?? 0) + 1)
  }
  const sections = [...new Set(ingredients.map((ing) => ing.section).filter(Boolean))]
  const fromSections = new Set(
    ingredients.filter((ing) => ing.section && sections.includes(ing.section) && namesSection(stepWords, ing.section)),
  )
  const taken = takenPositions(stepWords, ingredients)
  const matched = ingredients.filter((ing, i) => fromSections.has(ing) || mentions(stepWords, ing, mainWordCounts, taken[i]))

  // Group matches that share a name.
  const groups = new Map()
  for (const ing of matched) {
    const name = keyWords(ing.item).join(' ')
    groups.set(name, [...(groups.get(name) ?? []), ing])
  }
  const anchors = [...groups.values()].filter((g) => g.length === 1).map((g) => g[0])
  const keep = new Set([...anchors, ...fromSections])
  for (const [name, group] of groups) {
    if (group.length === 1) continue
    // A named part of the list already settles which copy this step uses.
    if (group.some((ing) => fromSections.has(ing))) {
      for (const ing of group) if (!fromSections.has(ing)) keep.delete(ing)
      continue
    }
    const phrase = name.split(' ')
    const earlierMentions = earlierSteps.filter((text) => hasPhrase(words(text).map(singular), phrase)).length
    keep.add(pickOne(group, { stepText, anchors, ingredients, earlierMentions }))
  }
  return ingredients.filter((ing) => keep.has(ing))
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
    // Close enough counts: imports often round 1/3 cup to 0.3.
    if (ing.quantity == null || Math.abs(Number(ing.quantity) - value) > Math.max(0.01, Number(ing.quantity) * 0.12)) continue
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

// Words worth bolding in a step so it can be scanned: the action that
// starts a sentence or clause ("Whisk", ", then bake"), and amounts with a
// unit, temperatures, and times ("2 tsp", "350°F", "18–20 minutes").
const ACTIONS = [
  'preheat', 'heat', 'whisk', 'beat', 'stir', 'mix', 'combine', 'toss', 'pour', 'add', 'bake', 'roast', 'boil',
  'simmer', 'fry', 'stir-fry', 'saute', 'sauté', 'sear', 'grill', 'broil', 'toast', 'steam', 'microwave', 'cook',
  'chop', 'dice', 'slice', 'mince', 'cut', 'grate', 'peel', 'fold', 'knead', 'roll', 'season', 'sprinkle', 'drain',
  'rinse', 'thaw', 'press', 'squeeze', 'divide', 'spread', 'cover', 'remove', 'rest', 'cool', 'chill', 'serve',
  'garnish', 'blend', 'puree', 'mash', 'strain', 'whip', 'marinate', 'coat', 'grease', 'line', 'transfer', 'flip',
  'reduce', 'melt', 'top', 'fill', 'scoop', 'wrap', 'brush', 'crack', 'soak', 'place', 'arrange', 'shape', 'form',
  'let', 'set', 'bring', 'turn', 'run', 'pop', 'dip', 'dust', 'freeze', 'refrigerate', 'store', 'repeat', 'flatten',
]
const UNIT_WORDS =
  '°\\s?[FC]\\b|degrees(?:\\s[FC]\\b)?|minutes?\\b|mins?\\b|seconds?\\b|secs?\\b|hours?\\b|hrs?\\b|cups?\\b|tbsp\\b|tablespoons?\\b|tsp\\b|teaspoons?\\b|oz\\b|ounces?\\b|lbs?\\b|pounds?\\b|g\\b|grams?\\b|kg\\b|ml\\b|liters?\\b|l\\b|inch(?:es)?\\b|cloves?\\b|pinch\\b|dash\\b'
const NUMBER = '\\d+(?:[./]\\d+)?(?:\\s\\d/\\d)?|[½⅓⅔¼¾⅛]'
const EMPHASIS = new RegExp(
  `((?:${NUMBER})(?:\\s?[–-]\\s?(?:${NUMBER}))?\\s?(?:${UNIT_WORDS}))` +
    `|((?:^|(?<=[.;:!?]\\s)|(?<=,\\s)|(?<=\\band\\s)|(?<=\\bthen\\s))(?:${ACTIONS.join('|')})\\b)`,
  'gi',
)

// Splits plain step text into [{ text, strong }].
export function emphasize(text) {
  const source = String(text ?? '')
  const parts = []
  let last = 0
  for (const match of source.matchAll(EMPHASIS)) {
    const start = match.index
    // Part of a longer word or number ("x2", "12" inside "112").
    if (start > 0 && /[\w/.]/.test(source[start - 1]) && match[1]) continue
    if (start > last) parts.push({ text: source.slice(last, start), strong: false })
    parts.push({ text: match[0], strong: true })
    last = start + match[0].length
  }
  if (last < source.length) parts.push({ text: source.slice(last), strong: false })
  return parts
}
