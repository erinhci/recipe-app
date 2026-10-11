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

// What this cook should do now.
// side: 'a', 'b', or 'all' (one phone running both tracks).
// Returns { kind: 'step', state } | { kind: 'waiting', state, on } |
//   { kind: 'mine-done' } | { kind: 'all-done' }
export function nextFor(states, side) {
  const mine = (s) => side === 'all' || s.track === side || s.track === 'both'
  const open = states.filter((s) => mine(s) && !s.done)
  if (states.every((s) => s.done)) return { kind: 'all-done' }
  if (open.length === 0) return { kind: 'mine-done' }
  const ready = open.find((s) => s.waitingOn.length === 0)
  if (ready) return { kind: 'step', state: ready }
  return { kind: 'waiting', state: open[0], on: open[0].waitingOn }
}

// The first step still to do on a track, for "Brian is on step 3".
export function currentOn(states, side) {
  return states.find((s) => !s.done && (s.track === side || s.track === 'both')) ?? null
}
