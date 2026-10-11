import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPrompt, cleanChanges, readRequest } from './index.ts'

const body = {
  title: 'Isobe mochi',
  base_servings: 4,
  usual_servings: 2,
  ingredients: ['2 cups glutinous rice flour', '2 tbsp soy sauce'],
  steps: ['Mix the flour and water.', 'Brush with soy sauce.'],
  note: 'Too salty, use 1/2 tbsp soy sauce next time',
}

test('the prompt numbers lines and explains which servings a note means', () => {
  const r = readRequest(body)
  assert.equal(typeof r, 'object')
  const prompt = buildPrompt(r as Exclude<typeof r, string>)
  assert.match(prompt, /2\. 2 tbsp soy sauce/)
  assert.match(prompt, /assume it is for 2 servings and convert it to the recipe's 4/)
  assert.match(prompt, /Note: Too salty/)
})

test('bad requests get a plain message', () => {
  assert.equal(readRequest({ ...body, note: ' ' }), 'There is no note to work from.')
  assert.equal(readRequest({ ...body, ingredients: [], steps: [] }), 'This recipe has no ingredients or steps yet.')
})

test('changes that point at missing lines or lack text are dropped and counted', () => {
  const counts = { ingredient: 2, step: 2 }
  const kept = cleanChanges(
    [
      { target: 'ingredient', action: 'change', number: 2, text: '1 tbsp soy sauce', reason: 'Halves the soy sauce' },
      { target: 'ingredient', action: 'change', number: 3, text: 'nope' },
      { target: 'step', action: 'add', number: 0, text: 'Soak the rice.' },
      { target: 'step', action: 'add', number: 2, text: 'Serve warm.' },
      { target: 'step', action: 'change', number: 1, text: '' },
      { target: 'ingredient', action: 'remove', number: 1, text: 'ignored' },
      { target: 'title', action: 'change', number: 1, text: 'x' },
    ],
    counts,
  )
  assert.deepEqual(kept.changes, [
    { target: 'ingredient', action: 'change', number: 2, text: '1 tbsp soy sauce', reason: 'Halves the soy sauce' },
    { target: 'step', action: 'add', number: 0, text: 'Soak the rice.', reason: null },
    { target: 'step', action: 'add', number: 2, text: 'Serve warm.', reason: null },
    { target: 'ingredient', action: 'remove', number: 1, text: null, reason: null },
  ])
  assert.equal(kept.skipped, 3)
})

test('an ingredient added past the end goes at the end instead of being dropped', () => {
  // The avocado oil case: 5 ingredients, Gemini says "add as number 6".
  const { changes, skipped } = cleanChanges(
    [
      { target: 'ingredient', action: 'add', number: 6, text: 'avocado oil, for greasing the pan', reason: 'Adds the oil' },
      { target: 'step', action: 'change', number: 3, text: 'Glaze over medium heat.', reason: 'Lowers the heat' },
    ],
    { ingredient: 5, step: 4 },
  )
  assert.equal(skipped, 0)
  assert.deepEqual(changes.map((c) => [c.target, c.action, c.number]), [['ingredient', 'add', 5], ['step', 'change', 3]])
})
