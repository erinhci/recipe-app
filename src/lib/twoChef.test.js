import { test } from 'node:test'
import assert from 'node:assert/strict'
import { catchUpIds, currentOn, listNumbers, nextFor, sideOf, splitIsCurrent, stepStates, trackOf } from './twoChef.js'

// Pasta: 1 boil (a), 2 cook pasta (a), 3 make sauce (b), 4 combine (both), 5 plate (a)
const steps = [
  { id: 's1', position: 0, text: 'Boil water', track: 'a' },
  { id: 's2', position: 1, text: 'Cook pasta', track: 'a' },
  { id: 's3', position: 2, text: 'Make sauce', track: 'b' },
  { id: 's4', position: 3, text: 'Combine', track: 'both' },
  { id: 's5', position: 4, text: 'Plate', track: 'a' },
]
const cook = (done = [], moved = {}) => ({ chef_a: 'erin', chef_b: 'brian', done_steps: done, moved_steps: moved })

test('a split is current only when every step has a track', () => {
  const recipe = { chef_tracks: { a: 'Pasta', b: 'Sauce' } }
  assert.equal(splitIsCurrent(recipe, steps), true)
  assert.equal(splitIsCurrent(recipe, [...steps, { id: 's6', position: 5, text: 'Eat' }]), false)
  assert.equal(splitIsCurrent({}, steps), false)
})

test('each cook starts on their own track at the same time', () => {
  const states = stepStates(steps, cook())
  assert.equal(nextFor(states, 'a').state.step.id, 's1')
  assert.equal(nextFor(states, 'b').state.step.id, 's3')
})

test("the shared step doesn't lock, but says what isn't checked off", () => {
  const states = stepStates(steps, cook(['s1', 's2']))
  const erin = nextFor(states, 'a')
  assert.equal(erin.kind, 'step')
  assert.equal(erin.state.step.id, 's4')
  assert.deepEqual(erin.state.waitingOn.map((w) => [w.step.id, w.number]), [['s3', 3]])
  assert.equal(nextFor(states, 'b').state.step.id, 's3')
})

test('checking a step catches up your own earlier steps', () => {
  const states = stepStates(steps, cook())
  // Erin checks "Cook pasta": "Boil water" is hers too; the sauce isn't.
  assert.deepEqual(catchUpIds(states, states[1], 'a'), ['s1', 's2'])
  // Partner checks "Make sauce": nothing of his comes before it.
  assert.deepEqual(catchUpIds(states, states[2], 'b'), ['s3'])
})

test('checking a shared step checks both parts before it', () => {
  const states = stepStates(steps, cook(['s1']))
  assert.deepEqual(catchUpIds(states, states[3], 'a'), ['s2', 's3', 's4'])
  // Checking "Plate" after skipping the shared step checks everything.
  assert.deepEqual(catchUpIds(states, states[4], 'a'), ['s2', 's3', 's4', 's5'])
})

test('step numbers read as a list', () => {
  assert.equal(listNumbers([3]), '3')
  assert.equal(listNumbers([2, 3]), '2 and 3')
  assert.equal(listNumbers([2, 3, 5]), '2, 3 and 5')
})

test('steps after a shared step wait for it', () => {
  const states = stepStates(steps, cook(['s1', 's2', 's3']))
  assert.equal(nextFor(states, 'a').state.step.id, 's4')
  const plate = states.find((s) => s.step.id === 's5')
  assert.deepEqual(plate.waitingOn.map((w) => w.step.id), ['s4'])
})

test('one cook can finish their part before the other', () => {
  const states = stepStates(steps, cook(['s1', 's2', 's3', 's4', 's5']))
  assert.equal(nextFor(states, 'a').kind, 'all-done')
  const partly = stepStates(steps.slice(0, 3), cook(['s1', 's2']))
  assert.equal(nextFor(partly, 'a').kind, 'mine-done')
  assert.equal(currentOn(partly, 'b').step.id, 's3')
})

test('a moved step belongs to the other cook for this cook only', () => {
  const moved = cook([], { s2: 'b' })
  assert.equal(trackOf(steps[1], moved), 'b')
  const states = stepStates(steps, moved)
  assert.equal(states[1].track, 'b')
  assert.equal(steps[1].track, 'a')
})

test('one phone running both tracks goes in order of what is ready', () => {
  const states = stepStates(steps, cook(['s1']))
  assert.equal(nextFor(states, 'all').state.step.id, 's2')
})

test('which track the signed-in cook has', () => {
  assert.equal(sideOf(cook(), 'brian'), 'b')
  assert.equal(sideOf(cook(), 'someone'), null)
  assert.equal(sideOf(null, 'erin'), null)
})

test('where the two parts meet next', async () => {
  const { meetAt } = await import('./twoChef.js')
  assert.equal(meetAt(stepStates(steps, cook(['s1']))).step.id, 's4')
  assert.equal(meetAt(stepStates(steps, cook(['s1', 's2', 's3', 's4']))), null)
})

test('time left counts the longer part plus shared steps', async () => {
  const { minutesLeft } = await import('./twoChef.js')
  const timing = [{ minutes: 10 }, { minutes: 12 }, { minutes: 15 }, { minutes: 3 }, { minutes: 2 }]
  // Pasta 10 + 12 + 2 = 24, sauce 15, together 3 -> 27
  assert.equal(minutesLeft(stepStates(steps, cook()), timing), 27)
  // After boiling: pasta 12 + 2 = 14, sauce 15, together 3 -> 18
  assert.equal(minutesLeft(stepStates(steps, cook(['s1'])), timing), 18)
  assert.equal(minutesLeft(stepStates(steps, cook()), undefined), null)
})
