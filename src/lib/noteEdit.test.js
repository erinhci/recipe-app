import { test } from 'node:test'
import assert from 'node:assert/strict'
import { applyChanges } from './noteEdit.js'

const recipe = {
  ingredients: [
    { id: 'i1', quantity: 2, unit: 'cup', item: 'glutinous rice flour', prep_note: null },
    { id: 'i2', quantity: 2, unit: 'tbsp', item: 'soy sauce', prep_note: null },
    { id: 'i3', quantity: 4, unit: 'sheet', item: 'nori', prep_note: null },
  ],
  steps: [
    { id: 's1', text: 'Mix the flour and water.' },
    { id: 's2', text: 'Brush with soy sauce and wrap in nori.' },
  ],
}

test('a changed line keeps its id and is read again', () => {
  const out = applyChanges(recipe, [{ target: 'ingredient', action: 'change', number: 2, text: '1 tbsp soy sauce' }])
  assert.equal(out.ingredients[1].id, 'i2')
  assert.equal(out.ingredients[1].quantity, 1)
  assert.equal(out.ingredients[0], recipe.ingredients[0]) // untouched lines are the same objects
  assert.deepEqual(out.items, [
    { target: 'ingredient', action: 'change', number: 2, before: '2 tbsp soy sauce', after: '1 tbsp soy sauce', needsReview: false },
  ])
})

test('numbers refer to the original list, whatever order changes come in', () => {
  const out = applyChanges(recipe, [
    { target: 'ingredient', action: 'add', number: 3, text: '1 tsp sugar' },
    { target: 'ingredient', action: 'remove', number: 1 },
    { target: 'ingredient', action: 'add', number: 0, text: '1 cup water' },
    { target: 'step', action: 'add', number: 1, text: 'Steam for 20 minutes.' },
  ])
  assert.deepEqual(out.ingredients.map((i) => i.item), ['water', 'soy sauce', 'nori', 'sugar'])
  assert.equal(out.ingredients[0].id, undefined) // new lines get ids when saved
  assert.deepEqual(out.steps.map((s) => s.text), [
    'Mix the flour and water.',
    'Steam for 20 minutes.',
    'Brush with soy sauce and wrap in nori.',
  ])
  assert.deepEqual(
    out.items.map((i) => [i.target, i.action, i.number]),
    [['ingredient', 'add', 0], ['ingredient', 'remove', 1], ['ingredient', 'add', 3], ['step', 'add', 1]],
  )
  assert.equal(out.items[1].before, '2 cups glutinous rice flour')
})

test('changes pointing at missing lines are ignored; lines without amounts are flagged', () => {
  const out = applyChanges(recipe, [
    { target: 'step', action: 'change', number: 9, text: 'Nope.' },
    { target: 'ingredient', action: 'change', number: 3, text: 'nori' },
  ])
  assert.deepEqual(out.steps.map((s) => s.id), ['s1', 's2'])
  assert.equal(out.items.length, 1)
  assert.equal(out.items[0].needsReview, true)
})
