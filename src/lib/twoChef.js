// Two-chef mode: a recipe's steps split into track "a", track "b", and
// shared steps ("both") where the two parts come together. Pure
// functions; the screen passes in the steps and the live cook record.

// A recipe is ready for two chefs when it has track names and every step
// has a track. Steps added after the split have none, so it's redone.
export function splitIsCurrent(recipe, steps) {
  return Boolean(recipe?.chef_tracks?.a && recipe?.chef_tracks?.b && steps.length > 1 && steps.every((s) => s.track))
}

// A step's track for this cook, after any move made during the cook.
export function trackOf(step, cook) {
  return cook?.moved_steps?.[step.id] ?? step.track ?? 'both'
}

// Each step with its track, whether it's done, and whether it's waiting.
// A shared step waits until every step before it is done. Any step after
// a shared step waits until that shared step is done.
export function stepStates(steps, cook) {
  const done = new Set(cook?.done_steps ?? [])
  const ordered = [...steps].sort((a, b) => a.position - b.position)
  return ordered.map((step, index) => {
    const track = trackOf(step, cook)
    // Earlier steps this one waits for, as { step, number }.
    const before = ordered.slice(0, index).map((s, i) => ({ step: s, number: i + 1 }))
    const waitingOn = before.filter(
      ({ step: s }) => !done.has(s.id) && (track === 'both' || trackOf(s, cook) === 'both'),
    )
    return { step, number: index + 1, track, done: done.has(step.id), waitingOn }
  })
}

// Which track the signed-in cook has: 'a', 'b', or null if not picked.
export function sideOf(cook, userId) {
  if (!cook || !userId) return null
  if (cook.chef_a === userId) return 'a'
  if (cook.chef_b === userId) return 'b'
  return null
}

export const otherSide = (side) => (side === 'a' ? 'b' : 'a')

// What this cook should do now: their first step not yet checked off.
// side: 'a', 'b', or 'all' (one phone running both tracks).
// Shared steps don't lock while the other part is unchecked, since cooks
// often skip check-offs with busy hands. The returned state's waitingOn
// says which earlier steps aren't checked off, so the screen can mention it.
// Returns { kind: 'step', state } | { kind: 'mine-done' } | { kind: 'all-done' }
export function nextFor(states, side) {
  if (states.every((s) => s.done)) return { kind: 'all-done' }
  const open = states.filter((s) => isMine(s, side) && !s.done)
  if (open.length === 0) return { kind: 'mine-done' }
  return { kind: 'step', state: open[0] }
}

const isMine = (state, side) => side === 'all' || state.track === side || state.track === 'both'

// The steps to mark done when a cook checks one off, in order. Cooks with
// busy hands catch up by checking the step they're on, so their own
// earlier steps are checked too. A shared step means both parts before it
// are finished, so checking one also checks every step before it.
export function catchUpIds(states, target, side) {
  const before = states.filter((s) => s.number < target.number && !s.done)
  const ids = new Set([target.step.id])
  for (const s of before) if (isMine(s, side)) ids.add(s.step.id)
  const lastShared = Math.max(0, ...states.filter((s) => ids.has(s.step.id) && s.track === 'both').map((s) => s.number))
  for (const s of before) if (s.number < lastShared) ids.add(s.step.id)
  return states.filter((s) => ids.has(s.step.id)).map((s) => s.step.id)
}

// "3", "2 and 3", "2, 3 and 5"
export function listNumbers(numbers) {
  if (numbers.length <= 1) return numbers.join('')
  return `${numbers.slice(0, -1).join(', ')} and ${numbers[numbers.length - 1]}`
}

// The first step still to do on a track, for "Brian is on step 3".
export function currentOn(states, side) {
  return states.find((s) => !s.done && (s.track === side || s.track === 'both')) ?? null
}

// The next shared step not yet done, where the two parts meet.
export function meetAt(states) {
  return states.find((s) => !s.done && s.track === 'both') ?? null
}

// About how many minutes are left, from the split's step times: the
// longer of the two parts still to do, plus the shared steps (the two
// parts run at the same time). Null when the split has no step times.
export function minutesLeft(states, timing) {
  if (!Array.isArray(timing) || timing.every((t) => !t?.minutes)) return null
  const left = { a: 0, b: 0, both: 0 }
  for (const s of states) {
    if (!s.done) left[s.track] += timing[s.number - 1]?.minutes ?? 0
  }
  return Math.max(left.a, left.b) + left.both
}
