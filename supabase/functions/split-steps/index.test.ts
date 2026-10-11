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
  assert.deepEqual(split, { splittable: true, reason: null, names: { a: 'Pasta', b: 'Sauce' }, tracks: ['a', 'b', 'both', 'both'] })
})

test('a split where one cook gets nothing is not splittable', () => {
  const split = cleanSplit({ splittable: true, name_a: 'Mochi', name_b: 'Mochi', steps: [{ number: 1, track: 'a' }, { number: 2, track: 'a' }] }, 2)
  assert.equal(split.splittable, false)
  assert.match(split.reason, /nothing for a second cook/)
  assert.deepEqual(split.names, { a: 'Mochi', b: 'Mochi 2' })
})

test('Gemini saying it cannot be split keeps its reason', () => {
  const split = cleanSplit({ splittable: false, reason: 'It is one dough worked start to finish.', name_a: '', name_b: '', steps: [] }, 3)
  assert.deepEqual(split, {
    splittable: false,
    reason: 'It is one dough worked start to finish.',
    names: { a: 'Track 1', b: 'Track 2' },
    tracks: ['both', 'both', 'both'],
  })
})
