import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPrompt, readQuestion } from './index.ts'

const body = {
  title: 'Isobe mochi',
  servings: 4,
  base_servings: 2,
  ingredients: ['2 cups glutinous rice flour', '2 tbsp soy sauce'],
  steps: ['Mix the flour and water.', 'Steam for 20 minutes.'],
  step_number: 2,
  question: 'How do I know it is done?',
}

test('a valid question is read and the prompt names the step and scaling', () => {
  const q = readQuestion(body)
  assert.equal(typeof q, 'object')
  const prompt = buildPrompt(q as Exclude<typeof q, string>)
  assert.match(prompt, /They are on step 2: Steam for 20 minutes\./)
  assert.match(prompt, /written for 2 servings; the cooks are making 4/)
  assert.match(prompt, /- 2 tbsp soy sauce/)
  assert.match(prompt, /Their question: How do I know it is done\?/)
})

test('bad questions get a plain message', () => {
  assert.equal(readQuestion({ ...body, question: '  ' }), 'Type a question first.')
  assert.equal(readQuestion({ ...body, step_number: 3 }), 'That step does not exist.')
  assert.equal(readQuestion({ ...body, steps: [] }), 'This recipe has no steps to ask about.')
  assert.match(String(readQuestion({ ...body, question: 'x'.repeat(501) })), /too long/)
})

test('suggested questions: one short list per step, padded or trimmed to fit', async () => {
  const { readSuggest, buildSuggestPrompt, cleanSuggestions } = await import('./index.ts')
  const input = readSuggest({ title: 'Egg bites', ingredients: ['6 eggs'], steps: ['Preheat the oven.', 'Bake 20 minutes.'] })
  assert.equal(typeof input, 'object')
  assert.match(buildSuggestPrompt(input as any), /exactly 2 lists/)
  const cleaned = cleanSuggestions(
    { questions: [['How hot should the oven be', 'Can I use a toaster oven?', 'Third?'], ['x', 'How do I know they are set?']] },
    3,
  )
  assert.deepEqual(cleaned, [['How hot should the oven be?', 'Can I use a toaster oven?'], ['How do I know they are set?'], []])
  assert.equal(readSuggest({ steps: [] }), 'This recipe has no steps to ask about.')
})
