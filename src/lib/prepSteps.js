import { keyWords } from './cooking.js'

// Prep the ingredient list implies but no step says to do: "2 green
// onions, chopped, divided" or "1/2 cup diced onion" means someone has to
// chop or dice first. These become suggested steps the cook confirms when
// adding or editing a recipe, so the prep shows in cooking mode and can be
// shared in two-chef mode.

// What the ingredient list says -> the step's verb.
const VERBS = {
  chopped: 'chop', diced: 'dice', minced: 'mince', sliced: 'slice', grated: 'grate', peeled: 'peel',
  crushed: 'crush', cubed: 'cube', shredded: 'shred', julienned: 'julienne', zested: 'zest',
  juiced: 'juice', beaten: 'beat', whisked: 'whisk', halved: 'halve', quartered: 'quarter',
  trimmed: 'trim', cored: 'core', seeded: 'seed', deseeded: 'seed', deveined: 'devein',
  rinsed: 'rinse', drained: 'drain', toasted: 'toast', melted: 'melt', thawed: 'thaw', pitted: 'pit',
  mashed: 'mash', torn: 'tear', smashed: 'smash', crumbled: 'crumble', softened: 'soften',
  sifted: 'sift', snipped: 'snip', stemmed: 'stem', hulled: 'hull', scrubbed: 'scrub',
  shelled: 'shell', soaked: 'soak', washed: 'wash', cut: 'cut', pounded: 'pound', butterflied: 'butterfly',
}

// Words that can come before the verb and stay with it: "finely chopped".
const ADVERBS = new Set(['finely', 'thinly', 'roughly', 'coarsely', 'thickly', 'lightly', 'very'])
// Words that can come before the verb and are dropped: "freshly grated".
const DROPPED = new Set(['freshly', 'well', 'then'])

// What can follow the verb and belongs in the step: "cut into 1-inch
// pieces", "sliced 1/4 inch thick", "halved lengthwise".
const TAIL = /^(into|in|lengthwise|crosswise|on the|diagonally|\d|½|¼|¾|⅓|thin|thick)/

// Things usually bought already prepped, when the prep is part of the
// name: "1 can diced tomatoes" needs no step. Written after a comma
// ("parmesan, grated") it's the cook's to do.
const BOUGHT_THAT_WAY = /\b(can|cans|canned|jar|jarred|frozen|store[- ]bought|packaged|bag|bagged|tomato|tomatoes|cheese|parmesan|parmigiano|pecorino|mozzarella|cheddar|coconut|red pepper flakes|chili flakes|ginger paste|garlic paste|bread ?crumbs|panko)\b/i

const SIZE = /^(large|medium|small|big|extra[- ]large)\s+/i

// "peeled and cut into 1-inch pieces" -> [{ verb: 'peel' }, { verb: 'cut', tail: 'into 1-inch pieces' }]
function actionsIn(phrase) {
  const actions = []
  for (const part of phrase.split(/\s+and\s+|\s*&\s*/)) {
    const words = part.trim().split(/\s+/).filter(Boolean)
    const adverbs = []
    let i = 0
    while (i < words.length && (ADVERBS.has(words[i].toLowerCase()) || DROPPED.has(words[i].toLowerCase()))) {
      if (ADVERBS.has(words[i].toLowerCase())) adverbs.push(words[i].toLowerCase())
      i += 1
    }
    const verb = VERBS[words[i]?.toLowerCase()]
    if (!verb) continue
    const rest = words.slice(i + 1).join(' ')
    actions.push({ verb, adverbs, tail: TAIL.test(rest.toLowerCase()) ? rest : '' })
  }
  return actions
}

// One ingredient -> { actions, name, optional }, or null when the list
// doesn't say it's prepped.
export function prepFor(ingredient) {
  const item = String(ingredient?.item ?? '').trim()
  const note = String(ingredient?.prep_note ?? '').replace(/\([^)]*\)/g, ' ').trim()
  let name = item.replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim()
  let actions = []
  let optional = /\boptional\b/i.test(note) || /\boptional\b/i.test(item)

  // "chopped, divided" / "peeled and diced" / "chopped or sliced"
  for (const piece of note.split(/[,;]/)) {
    const firstChoice = piece.split(/\s+or\s+/)[0]
    actions.push(...actionsIn(firstChoice))
  }

  // "1/2 cup finely chopped onion": the prep is at the front of the name.
  if (actions.length === 0) {
    const m = name.match(/^((?:(?:finely|thinly|roughly|coarsely|thickly|lightly|very|freshly)\s+)*)([a-z]+)(?:\s+and\s+([a-z]+))?\s+(.+)$/i)
    if (m && VERBS[m[2].toLowerCase()] && (!m[3] || VERBS[m[3].toLowerCase()])) {
      // "diced tomatoes" and "shredded cheese" usually come that way.
      if (BOUGHT_THAT_WAY.test(m[4])) return null
      actions = actionsIn([m[1] + m[2], m[3]].filter(Boolean).join(' and '))
      name = m[4]
    }
  }

  if (actions.length === 0) return null
  if (/\b(canned|jarred|frozen|store[- ]bought)\b/i.test(name)) return null
  name = name.replace(SIZE, '').replace(/^of\s+/i, '').replace(/,.*$/, '').trim()
  if (!name) return null
  // "Green onion" -> "green onion", but leave "PX sherry" alone.
  if (/^[A-Z][a-z]/.test(name)) name = name.charAt(0).toLowerCase() + name.slice(1)
  return { actions, name, optional }
}

function verbPhrase(actions) {
  return actions.map((a) => [...a.adverbs, a.verb].join(' ')).join(' and ')
}

function listNames(names) {
  if (names.length <= 2) return names.join(' and ')
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`
}

// The forms a step would use to say it does the prep itself: "chop",
// "chops", "chopping". Not "chopped", since "add the chopped onion"
// assumes the chopping is already done.
function doesForms(verb) {
  const base = verb.replace(/e$/, '')
  const doubled = /[^aeiou][aeiou][bdgmnpt]$/.test(verb) ? verb + verb.slice(-1) : verb
  return new Set([verb, `${verb}s`, `${verb}es`, `${base}ing`, `${doubled}ing`, verb.replace(/y$/, 'ies')])
}

function stepWords(text) {
  return String(text ?? '').toLowerCase().replace(/[^a-z\s-]/g, ' ').split(/[\s-]+/).filter(Boolean)
}

// True when some step already does this prep to this ingredient.
function covered(prep, steps) {
  const keys = keyWords(prep.name)
  const main = keys[keys.length - 1]
  if (!main) return false
  return steps.some((step) => {
    const words = stepWords(step)
    const named = keyWords(step).includes(main)
    return named && prep.actions.every((a) => words.some((w) => doesForms(a.verb).has(w)))
  })
}

// The suggested steps for a recipe, in ingredient order, with the same
// prep combined: [{ text, names, optional }].
// "Dice the onion and zucchini." / "Chop the chili pepper (optional)."
export function prepSuggestions(ingredients, steps = []) {
  const groups = new Map()
  for (const ing of ingredients ?? []) {
    const prep = prepFor(ing)
    if (!prep || covered(prep, steps)) continue
    const tail = prep.actions[prep.actions.length - 1].tail
    const key = `${verbPhrase(prep.actions)}|${tail}|${prep.optional}`
    const group = groups.get(key) ?? { verbs: verbPhrase(prep.actions), tail, optional: prep.optional, names: [] }
    if (!group.names.some((n) => n.toLowerCase() === prep.name.toLowerCase())) group.names.push(prep.name)
    groups.set(key, group)
  }
  return [...groups.values()].map((g) => {
    const verbs = g.verbs.charAt(0).toUpperCase() + g.verbs.slice(1)
    const text = `${verbs} the ${listNames(g.names)}${g.tail ? ` ${g.tail}` : ''}${g.optional ? ' (optional)' : ''}.`
    return { text, names: g.names, optional: g.optional }
  })
}

// The steps box with the chosen prep steps put first, one per line.
export function withPrepSteps(stepText, prepTexts) {
  const prep = prepTexts.filter(Boolean)
  if (prep.length === 0) return stepText
  const rest = String(stepText ?? '').trim()
  // Match how the box already separates steps: a blank line or a new line.
  const gap = rest.includes('\n\n') ? '\n\n' : '\n'
  return rest ? `${prep.join(gap)}${gap}${rest}` : prep.join(gap)
}
