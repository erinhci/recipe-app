import { db } from './db.js'
import { enqueue, syncNow } from './sync.js'

// Each cook's color, avatar, and the kitchen's shared scene.
//
// Colors: four choices, checked as a set (every pair stays apart for
// common color blindness, each is at least 3:1 against the page, and the
// ink on top is at least 4.5:1). Two cooks can't have the same one.
export const COLORS = [
  { id: 'coral', label: 'Coral' },
  { id: 'blue', label: 'Blue' },
  { id: 'green', label: 'Green' },
  { id: 'magenta', label: 'Magenta' },
]

// The CSS color for a color id (light and dark are set in index.css).
export const cookColor = (id) => `var(--cook-${id ?? 'coral'})`

// Each active cook's color by user id. Someone who hasn't picked one gets
// the first color nobody has, in the order they joined, so two cooks
// never share a color on screen.
export function colorsFor(members) {
  const active = members.filter((m) => !m.removed_at).sort((a, b) => (a.joined_at ?? '').localeCompare(b.joined_at ?? ''))
  const taken = new Set(active.map((m) => m.color).filter(Boolean))
  const out = {}
  for (const m of active) {
    if (m.color) {
      out[m.user_id] = m.color
      continue
    }
    const free = COLORS.find((c) => !taken.has(c.id))?.id ?? 'coral'
    taken.add(free)
    out[m.user_id] = free
  }
  return out
}

// What can be worn or chosen, and which badge unlocks it. Badges belong to
// the kitchen, so an unlock is there for both cooks. Items with no badge
// are always available.
export const OPTIONS = {
  outfit: [
    { id: 'none', label: 'None' },
    { id: 'apron', label: 'Apron', badge: 'meals-5' },
    { id: 'striped', label: 'Striped apron', badge: 'meals-10' },
  ],
  hat: [
    { id: 'none', label: 'None' },
    { id: 'chef', label: 'Chef hat', badge: 'joined-1' },
    { id: 'beanie', label: 'Beanie', badge: 'rated-10' },
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
  ],
}

const REWARD_NOUN = { outfit: '', hat: '', scene: ' scene', pose: ' pose' }

// The reward for a badge ({ kind, threshold }), as "Chef hat" or
// "Night market scene", or null when it doesn't unlock anything.
export function rewardFor(badge) {
  const key = `${badge.kind}-${badge.threshold}`
  for (const [type, items] of Object.entries(OPTIONS)) {
    const item = items.find((o) => o.badge === key)
    if (item) return { type, id: item.id, label: `${item.label}${REWARD_NOUN[type]}` }
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
  return { outfit: keep('outfit', look.outfit, 'none', earned), hat: keep('hat', look.hat ?? 'chef', 'none', earned) }
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
