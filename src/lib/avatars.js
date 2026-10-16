import { db } from './db.js'
import { enqueue, syncNow } from './sync.js'
import { HAIR_COLORS } from './hairDraw.js'

// Each cook's color, avatar, and the kitchen's shared scene.
//
// Colors: five choices, the same in light and dark. Two cooks can't have
// the same one. Ink is what sits on the color (a check, the "You" pill's
// label): white on berry and ocean, near-black on orange, green and
// violet, so it's at least 4.5:1 on each. Orange and green are under 3:1
// against the light page, so swatches and pills always get a gray edge.
// Orange and green, and ocean and violet, can look alike with red-green
// color blindness; a face and a name always go with the color.
export const COLORS = [
  { id: 'berry', label: 'Berry', hex: '#c2185b', ink: '#ffffff' },
  { id: 'orange', label: 'Orange', hex: '#f58a27', ink: '#111111' },
  { id: 'green', label: 'Green', hex: '#8bc34a', ink: '#111111' },
  { id: 'ocean', label: 'Ocean', hex: '#0077b6', ink: '#ffffff' },
  { id: 'violet', label: 'Violet', hex: '#9c72ac', ink: '#111111' },
]

// Colors from before the five (coral, blue, magenta) map to their nearest.
const OLD_COLORS = { coral: 'berry', blue: 'ocean', magenta: 'violet' }
export const normalizeColor = (id) => (COLORS.some((c) => c.id === id) ? id : OLD_COLORS[id] ?? null)

// The CSS color and ink for a color id (set in index.css).
export const cookColor = (id) => `var(--cook-${normalizeColor(id) ?? 'berry'})`
export const cookInk = (id) => `var(--ink-${normalizeColor(id) ?? 'berry'})`

// Each active cook's color by user id. Someone who hasn't picked one gets
// the first color nobody has, in the order they joined, so two cooks
// never share a color on screen.
export function colorsFor(members) {
  const active = members.filter((m) => !m.removed_at).sort((a, b) => (a.joined_at ?? '').localeCompare(b.joined_at ?? ''))
  const taken = new Set(active.map((m) => normalizeColor(m.color)).filter(Boolean))
  const out = {}
  for (const m of active) {
    const own = normalizeColor(m.color)
    if (own) {
      out[m.user_id] = own
      continue
    }
    const free = COLORS.find((c) => !taken.has(c.id))?.id ?? 'berry'
    taken.add(free)
    out[m.user_id] = free
  }
  return out
}

// What can be worn or chosen, and which badge unlocks it. Badges belong to
// the kitchen, so an unlock is there for both cooks. Items with no badge
// are always available: everyday clothes, all headwear (religious headwear
// is never locked), glasses and kitchen tools. Costumes are the silly,
// food-shaped rewards for the bigger badges. reward: how it's named when a
// badge unlocks it.
export const OPTIONS = {
  outfit: [
    { id: 'none', label: 'None' },
    { id: 'shirt', label: 'Shirt and pants' },
    { id: 'dress', label: 'Dress' },
    { id: 'apron', label: 'Apron', badge: 'meals-5' },
    { id: 'striped', label: 'Striped apron', badge: 'meals-10' },
    { id: 'egg', label: 'Fried egg', costume: true, badge: 'meals-1', reward: 'Fried egg costume' },
    { id: 'pizza', label: 'Pizza slice', costume: true, badge: 'rated-10', reward: 'Pizza slice costume' },
    { id: 'taco', label: 'Taco', costume: true, badge: 'meals-25', reward: 'Taco costume' },
    { id: 'hotdog', label: 'Hot dog', costume: true, badge: 'together-10', reward: 'Hot dog costume' },
    { id: 'avocado', label: 'Avocado', costume: true, badge: 'hours-10', reward: 'Avocado costume' },
    { id: 'sushi', label: 'Sushi roll', costume: true, badge: 'cuisines-10', reward: 'Sushi roll costume' },
    { id: 'peapod', label: 'Pea pod', costume: true, badge: 'rated-25', reward: 'Pea pod costume' },
    { id: 'banana', label: 'Banana suit', costume: true, badge: 'meals-50', reward: 'Banana suit' },
  ],
  hat: [
    { id: 'none', label: 'None' },
    { id: 'chef', label: 'Chef hat', badge: 'joined-1' },
    { id: 'beanie', label: 'Beanie' },
    { id: 'cap', label: 'Cap' },
    { id: 'turban', label: 'Turban' },
    { id: 'hijab', label: 'Hijab' },
    { id: 'bonnet', label: 'Bonnet' },
    { id: 'beret', label: 'Beret' },
    { id: 'cowboy', label: 'Cowboy hat' },
    { id: 'fedora', label: 'Fedora' },
    { id: 'headband', label: 'Headband' },
  ],
  glasses: [
    { id: 'none', label: 'None' },
    { id: 'round', label: 'Round' },
    { id: 'square', label: 'Square' },
    { id: 'cateye', label: 'Cat-eye' },
    { id: 'sun', label: 'Sunglasses' },
  ],
  utensil: [
    { id: 'none', label: 'None' },
    { id: 'spoon', label: 'Wooden spoon' },
    { id: 'whisk', label: 'Whisk' },
    { id: 'spatula', label: 'Spatula' },
    { id: 'ladle', label: 'Ladle' },
    { id: 'pin', label: 'Rolling pin' },
  ],
  scene: [
    { id: 'home', label: 'Kitchen' },
    { id: 'market', label: 'Night market', badge: 'cuisines-3' },
    { id: 'picnic', label: 'Picnic', badge: 'cuisines-5' },
  ],
  pose: [
    { id: 'wave', label: 'Waving' },
    { id: 'highfive', label: 'High five', badge: 'together-1' },
    { id: 'taste', label: 'Taste test', badge: 'hours-5' },
    { id: 'cheers', label: 'Cheers', badge: 'together-5' },
  ],
}

// Free choices: hair styles and skin tones, never locked.
export const HAIR_STYLES = [
  { id: 'none', label: 'None' },
  { id: 'buzz', label: 'Buzz' },
  { id: 'short', label: 'Short' },
  { id: 'curly', label: 'Curly' },
  { id: 'midcurly', label: 'Medium curly' },
  { id: 'afro', label: 'Afro' },
  { id: 'bob', label: 'Bob' },
  { id: 'bun', label: 'Bun' },
  { id: 'puffs', label: 'Two puffs' },
  { id: 'ponytail', label: 'Ponytail' },
  { id: 'braids', label: 'Two braids' },
  { id: 'braid', label: 'One braid' },
  { id: 'locs', label: 'Locs' },
  { id: 'long', label: 'Long' },
  { id: 'longcurly', label: 'Long curly' },
  { id: 'mullet', label: 'Mullet' },
]
// Numbered for screen readers, never named by ethnicity.
export const SKIN_CHOICES = Array.from({ length: 12 }, (_, i) => ({
  id: String(i + 1),
  label: `Tone ${i + 1} of 12${i === 0 ? ', lightest' : i === 11 ? ', deepest' : ''}`,
}))

const REWARD_NOUN = { outfit: '', hat: '', glasses: '', utensil: '', scene: ' scene', pose: ' pose' }

// The reward for a badge ({ kind, threshold }), as "Chef hat" or
// "Night market scene", or null when it doesn't unlock anything.
export function rewardFor(badge) {
  const key = `${badge.kind}-${badge.threshold}`
  for (const [type, items] of Object.entries(OPTIONS)) {
    const item = items.find((o) => o.badge === key)
    if (item) return { type, id: item.id, label: item.reward ?? `${item.label}${REWARD_NOUN[type]}` }
  }
  return null
}

// Badge keys earned so far, from computeStats().milestones.
export function earnedKeys(stats) {
  return new Set((stats?.milestones ?? []).filter((m) => m.reached).map((m) => `${m.kind}-${m.threshold}`))
}

export const isUnlocked = (option, earned) => !option.badge || earned.has(option.badge)

// The option if it exists and is unlocked, otherwise the fallback (a badge
// can be lost if meals are removed from the log). Without `earned`, any
// existing option is kept.
function keep(type, value, fallback, earned) {
  const option = OPTIONS[type].find((o) => o.id === value)
  return option && (!earned || isUnlocked(option, earned)) ? option.id : fallback
}

// What a cook's avatar is wearing. The chef hat comes with signing up, so
// it's on until the cook takes it off.
export function wornAvatar(member, earned) {
  const look = member?.avatar ?? {}
  return {
    outfit: keep('outfit', look.outfit, 'none', earned),
    hat: keep('hat', look.hat ?? 'chef', 'none', earned),
    glasses: keep('glasses', look.glasses, 'none', earned),
    utensil: keep('utensil', look.utensil, 'none', earned),
    // Until a tone is picked, the neutral gray placeholder.
    skin: SKIN_CHOICES.some((t) => t.id === String(look.skin)) ? String(look.skin) : 'plain',
    hair: HAIR_STYLES.some((h) => h.id === look.hair) ? look.hair : 'none',
    hairColor: HAIR_COLORS.some((c) => c.id === look.hairColor) ? look.hairColor : 'black',
  }
}

const named = (type, id) => OPTIONS[type].find((o) => o.id === id && o.id !== 'none')

// A short description of a look for alt text:
// "chef hat, round glasses, apron, holding a whisk, brown locs".
export function describeLook(look) {
  const parts = []
  const hat = named('hat', look?.hat)
  const glasses = named('glasses', look?.glasses)
  const outfit = named('outfit', look?.outfit)
  const tool = named('utensil', look?.utensil)
  const hair = HAIR_STYLES.find((h) => h.id === look?.hair && h.id !== 'none')
  const color = HAIR_COLORS.find((c) => c.id === look?.hairColor)
  if (hat) parts.push(hat.label.toLowerCase())
  if (glasses) parts.push(glasses.id === 'sun' ? 'sunglasses' : `${glasses.label.toLowerCase()} glasses`)
  if (outfit) parts.push(outfit.costume ? (outfit.reward ?? outfit.label).toLowerCase() : outfit.label.toLowerCase())
  if (tool) parts.push(`holding a ${tool.label.toLowerCase()}`)
  // Covering headwear hides the hair, so it isn't named.
  if (hair && !['turban', 'hijab', 'bonnet'].includes(look?.hat)) {
    parts.push(`${color && color.id !== 'black' ? `${color.label.toLowerCase()} ` : ''}${hair.label.toLowerCase()} hair`)
  }
  return parts.join(', ')
}

// The kitchen's scene and pose.
export function kitchenScene(kitchen, earned) {
  return { scene: keep('scene', kitchen?.scene, 'home', earned), pose: keep('pose', kitchen?.duo_pose, 'wave', earned) }
}

// Saves part of this cook's own member row (color or avatar) on this
// phone first, then sends it. Only these fields can be changed from the app.
export async function saveMyMember(userId, fields) {
  const row = await db.members.filter((m) => m.user_id === userId && !m.removed_at).first()
  if (!row) return
  const updated = { ...row, ...fields }
  await db.transaction('rw', [db.members, db.outbox], async () => {
    await db.members.put(updated)
    await enqueue('members', 'update', { id: row.id, ...fields })
  })
  syncNow()
}

export async function saveKitchen(kitchenId, fields) {
  const row = (await db.kitchens.get(kitchenId)) ?? { id: kitchenId }
  await db.transaction('rw', [db.kitchens, db.outbox], async () => {
    await db.kitchens.put({ ...row, ...fields })
    await enqueue('kitchens', 'update', { id: kitchenId, ...fields })
  })
  syncNow()
}
