import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPrompt, cleanItems, readInput } from './index.ts'

test('the prompt numbers each ingredient line', () => {
  const input = readInput({ title: 'Isobe mochi', base_servings: 4, ingredients: ['2 cups glutinous rice flour', ' ', '2 tbsp soy sauce'] })
  assert.equal(typeof input, 'object')
  const prompt = buildPrompt(input as Exclude<typeof input, string>)
  assert.match(prompt, /Recipe: Isobe mochi \(serves 4\)/)
  assert.match(prompt, /1\. 2 cups glutinous rice flour\n2\. 2 tbsp soy sauce/)
})

test('no ingredients gets a plain message', () => {
  assert.equal(readInput({ ingredients: [] }), 'This recipe has no ingredients to estimate.')
})

test('bad or duplicate items are dropped and numbers are rounded', () => {
  const items = cleanItems(
    [
      { number: 2, calories: 17.6, protein_g: 2.2, carbs_g: 1.6, fat_g: 0, assumption: ' ' },
      { number: 1, calories: 1200, protein_g: 21, carbs_g: 254, fat_g: 4, assumption: null },
      { number: 1, calories: 5, protein_g: 0, carbs_g: 0, fat_g: 0 }, // duplicate line
      { number: 3, calories: 10, protein_g: 0, carbs_g: 0, fat_g: 0 }, // no such line
      { number: 2, calories: -5, protein_g: 0, carbs_g: 0, fat_g: 0 },
      { number: 1, calories: 'lots', protein_g: 0, carbs_g: 0, fat_g: 0 },
    ],
    2,
  )
  assert.deepEqual(items, [
    { number: 1, calories: 1200, protein_g: 21, carbs_g: 254, fat_g: 4, assumption: null },
    { number: 2, calories: 18, protein_g: 2, carbs_g: 2, fat_g: 0, assumption: null },
  ])
})
