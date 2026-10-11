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
