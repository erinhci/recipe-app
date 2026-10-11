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

test('changes that point at missing lines or lack text are dropped', () => {
  const counts = { ingredient: 2, step: 2 }
  const kept = cleanChanges(
    [
      { target: 'ingredient', action: 'change', number: 2, text: '1 tbsp soy sauce' },
      { target: 'ingredient', action: 'change', number: 3, text: 'nope' },
      { target: 'step', action: 'add', number: 0, text: 'Soak the rice.' },
      { target: 'step', action: 'add', number: 2, text: 'Serve warm.' },
      { target: 'step', action: 'change', number: 1, text: '' },
      { target: 'ingredient', action: 'remove', number: 1, text: 'ignored' },
      { target: 'title', action: 'change', number: 1, text: 'x' },
    ],
    counts,
  )
  assert.deepEqual(kept, [
    { target: 'ingredient', action: 'change', number: 2, text: '1 tbsp soy sauce' },
    { target: 'step', action: 'add', number: 0, text: 'Soak the rice.' },
    { target: 'step', action: 'add', number: 2, text: 'Serve warm.' },
    { target: 'ingredient', action: 'remove', number: 1, text: null },
  ])
})
