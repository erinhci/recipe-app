import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPrompt, cleanSplit, readInput } from './index.ts'

test('the prompt numbers each step', () => {
  const input = readInput({ title: 'Pasta', ingredients: ['pasta', 'tomatoes'], steps: ['Boil water', ' ', 'Make sauce', 'Combine'] })
  assert.equal(typeof input, 'object')
  const prompt = buildPrompt(input as Exclude<typeof input, string>)
  assert.match(prompt, /Recipe: Pasta/)
  assert.match(prompt, /1\. Boil water\n2\. Make sauce\n3\. Combine/)
})

test('one step is not enough to split', () => {
  assert.match(String(readInput({ steps: ['Eat'] })), /at least two steps/)
})

test('skipped or bad steps become shared steps', () => {
  const split = cleanSplit(
    {
      splittable: true,
      name_a: ' Pasta ',
      name_b: 'Sauce',
      steps: [
        { number: 1, track: 'a' },
        { number: 2, track: 'b' },
        { number: 2, track: 'a' }, // duplicate
        { number: 9, track: 'a' }, // no such step
        { number: 3, track: 'chef' }, // unknown track
      ],
    },
    4,
  )
  assert.deepEqual(split.tracks, ['a', 'b', 'both', 'both'])
  assert.deepEqual(split.names, { a: 'Pasta', b: 'Sauce' })
  assert.equal(split.splittable, true)
})

test('a split where one cook gets nothing is not splittable', () => {
  const split = cleanSplit({ splittable: true, name_a: 'Mochi', name_b: 'Mochi', steps: [{ number: 1, track: 'a' }, { number: 2, track: 'a' }] }, 2)
  assert.equal(split.splittable, false)
  assert.match(split.reason, /nothing for a second cook/)
  assert.deepEqual(split.names, { a: 'Mochi', b: 'Mochi 2' })
})

test('Gemini saying it cannot be split keeps its reason', () => {
  const split = cleanSplit({ splittable: false, reason: 'It is one dough worked start to finish.', name_a: '', name_b: '', steps: [] }, 3)
  assert.equal(split.splittable, false)
  assert.equal(split.reason, 'It is one dough worked start to finish.')
  assert.deepEqual(split.names, { a: 'Track 1', b: 'Track 2' })
  assert.deepEqual(split.tracks, ['both', 'both', 'both'])
})

test('step times, heads-ups, and cleanup tasks are kept tidy', () => {
  const split = cleanSplit(
    {
      splittable: true,
      name_a: 'Pan and Fillings',
      name_b: 'Egg Mixture',
      steps: [
        { number: 1, track: 'a', minutes: 10, heads_up: ' The oven takes about 10 minutes to heat. ' },
        { number: 2, track: 'b', minutes: 3, heads_up: '' },
        { number: 3, track: 'both', minutes: 9999 },
      ],
      while_waiting_a: ['Wipe the cutting board.', ' ', 'Put away the vegetables', 'Rinse the knife', 'One too many'],
      while_waiting_b: ['Toss the egg shells'],
    },
    3,
  )
  assert.deepEqual(split.timing, [
    { minutes: 10, heads_up: 'The oven takes about 10 minutes to heat.' },
    { minutes: 3, heads_up: null },
    { minutes: null, heads_up: null },
  ])
  assert.deepEqual(split.while_waiting, {
    a: ['Wipe the cutting board', 'Put away the vegetables', 'Rinse the knife'],
    b: ['Toss the egg shells'],
  })
})
