import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ingredientsForStep, keyWords, scaleStepText } from './cooking.js'

const ingredients = [
  { id: 1, item: 'silken tofu' },
  { id: 2, item: 'potato starch' },
  { id: 3, item: 'soy sauce' },
  { id: 4, item: 'mirin' },
  { id: 5, item: 'large yellow onions' },
  { id: 6, item: 'tomato sauce' },
]
const ids = (step) => ingredientsForStep(step, ingredients).map((i) => i.id)

test('key words drop sizes and preparation words', () => {
  assert.deepEqual(keyWords('2 large yellow onions'), ['yellow', 'onion'])
  assert.deepEqual(keyWords('fresh tomatoes'), ['tomato'])
  assert.deepEqual(keyWords('glutinous rice flour'), ['glutinous', 'rice', 'flour'])
})

test('finds ingredients named in a step', () => {
  assert.deepEqual(ids('Whisk tofu, add potato starch, try to get it smooth.'), [1, 2])
  assert.deepEqual(ids('Glaze with soy sauce and mirin.'), [3, 4])
  assert.deepEqual(ids('Dice the onion.'), [5])
})

test('a shared word like "sauce" only matches the full name', () => {
  assert.deepEqual(ids('Add the sauce.'), [])
  assert.deepEqual(ids('Stir in the tomato sauce.'), [6])
})

test('steps that mention nothing get no list', () => {
  assert.deepEqual(ids('Heat a pan on low.'), [])
})

// Egg bites, written for 6 servings.
const eggBites = [
  { id: 'e', quantity: 4, unit: null, item: 'large eggs' },
  { id: 'w', quantity: 2, unit: 'tbsp', item: 'water' },
  { id: 'gp', quantity: 0.25, unit: 'tsp', item: 'garlic powder' },
  { id: 'op', quantity: 0.25, unit: 'tsp', item: 'onion powder' },
  { id: 's', quantity: 0.25, unit: 'tsp', item: 'salt' },
  { id: 'bp', quantity: 0.125, unit: 'tsp', item: 'black pepper' },
  { id: 'go', quantity: 2, unit: 'tbsp', item: 'green onions' },
  { id: 'yo', quantity: 2, unit: 'tbsp', item: 'yellow or white onion' },
  { id: 'c', quantity: 1 / 3, unit: 'cup', item: 'diced chicken' },
]
const scaled = (text, factor) => scaleStepText(text, eggBites, factor, 'us').map((p) => p.text).join('')

test('amounts in a step match the scaled ingredient list', () => {
  assert.equal(
    scaled('In a bowl, whisk 4 large eggs, 2 tbsp water, 1/4 tsp garlic powder, 1/4 tsp onion powder, 1/4 tsp salt, 1/8 tsp black pepper for 30 seconds.', 2 / 6),
    'In a bowl, whisk 1 1/3 large eggs, 2 tsp water, 1/8 tsp garlic powder, 1/8 tsp onion powder, 1/8 tsp salt, a pinch black pepper for 30 seconds.',
  )
})

test('similar ingredients with the same amount go to the right one', () => {
  const parts = scaleStepText('Add 2 tbsp sliced green onions and 2 tbsp diced yellow onion.', eggBites, 3, 'us')
  assert.deepEqual(parts.filter((p) => p.scaled).map((p) => p.text), ['6 tbsp', '6 tbsp'])
})

test('counts, times, and ranges that are not ingredients stay as written', () => {
  const text = 'Divide among the 6 greased muffin cups. Bake for 18–20 minutes until 3/4 set.'
  assert.equal(scaled(text, 2 / 6), text)
})

test('nothing changes at the original servings', () => {
  const parts = scaleStepText('Whisk 4 large eggs and 1/3 cup diced chicken.', eggBites, 1, 'us')
  assert.equal(parts.some((p) => p.scaled), false)
  assert.equal(parts.map((p) => p.text).join(''), 'Whisk 4 large eggs and 1/3 cup diced chicken.')
})

test('actions, amounts, temperatures, and times are emphasized for scanning', async () => {
  const { emphasize } = await import('./cooking.js')
  const strong = (t) => emphasize(t).filter((p) => p.strong).map((p) => p.text)
  assert.deepEqual(strong('Preheat your oven to 350°F (175°C).'), ['Preheat', '350°F', '175°C'])
  assert.deepEqual(strong('In a bowl, whisk 2 tsp water, then bake 18–20 minutes.'), ['whisk', '2 tsp', 'bake', '18–20 minutes'])
  // "heat" as a noun mid-sentence isn't an action; a bare count isn't an amount.
  assert.deepEqual(strong('Cook over medium heat until 6 cups are full.'), ['Cook', '6 cups'])
  assert.equal(emphasize('Plain text.').map((p) => p.text).join(''), 'Plain text.')
})

test('an amount rounded on import still matches its step (0.3 cup vs 1/3 cup)', async () => {
  const { scaleStepText } = await import('./cooking.js')
  const ingredients = [{ id: 'c', quantity: 0.3, unit: 'cup', item: 'diced chicken' }]
  const parts = scaleStepText('Toss together 1/3 cup diced chicken.', ingredients, 2)
  assert.ok(parts.some((p) => p.scaled))
})

// Tofu pudding with ginger syrup: water is listed twice, once per part.
const tofuPudding = [
  { id: 'soy', quantity: 2, unit: 'cup', item: 'unsweetened soy milk' },
  { id: 'gdl', quantity: 0.25, unit: 'tsp', item: 'GDL powder' },
  { id: 'corn', quantity: 1.5, unit: 'tsp', item: 'cornstarch' },
  { id: 'w1', quantity: 1, unit: 'tbsp', item: 'water', prep_note: 'room temperature, to dissolve the powders' },
  { id: 'sugar', quantity: 1, unit: 'cup', item: 'brown sugar or palm sugar' },
  { id: 'w2', quantity: 0.5, unit: 'cup', item: 'water' },
  { id: 'ginger', quantity: 4, unit: 'slices', item: 'thick slices fresh ginger' },
]
const tofuSteps = [
  'Combine the brown sugar, water, and sliced ginger in a small saucepan.',
  'Bring to a boil, then simmer 10 minutes.',
  'In a heatproof bowl or container that will fit inside your steamer, combine the GDL powder, cornstarch, and 1–2 tablespoons of water. Stir until completely dissolved.',
  'Heat the soy milk until steaming.',
  'Pour the hot soy milk into the bowl in one go.',
  'Cover the bowl tightly with aluminum foil or a heat-safe plate to prevent water droplets from dripping into your pudding.',
]
const needFor = (n) => ingredientsForStep(tofuSteps[n], tofuPudding, tofuSteps.slice(0, n)).map((i) => i.id)

test('a duplicated ingredient shows once, next to its own part', () => {
  assert.deepEqual(needFor(0), ['sugar', 'w2', 'ginger'])
})

test('an amount in the step picks the matching duplicate', () => {
  assert.deepEqual(needFor(2), ['gdl', 'corn', 'w1'])
})

test('"water droplets" is not a use of water', () => {
  assert.deepEqual(needFor(5), [])
})

test('"boil" does not match oil', () => {
  assert.deepEqual(ingredientsForStep('Bring to a boil.', [{ id: 'o', item: 'olive oil' }]), [])
})

test('the same ingredient listed twice shows once, in order of use', () => {
  const garlic = [
    { id: 'g1', quantity: 1, unit: 'tsp', item: 'minced garlic' },
    { id: 'on', quantity: 1, unit: null, item: 'onion' },
    { id: 'g2', quantity: 1, unit: 'tsp', item: 'minced garlic' },
  ]
  const steps = ['Stir in 1 tsp minced garlic and cook 30 seconds.', 'Make the sauce: whisk 1 tsp minced garlic with the soy sauce.']
  assert.deepEqual(ingredientsForStep(steps[0], garlic, []).map((i) => i.id), ['g1'])
  assert.deepEqual(ingredientsForStep(steps[1], garlic, steps.slice(0, 1)).map((i) => i.id), ['g2'])
})

// Napa cabbage rolls: the sauce is its own part of the ingredient list.
const napa = [
  { id: 'cab', quantity: 8, unit: null, item: 'large napa cabbage leaves', section: null },
  { id: 'chk', quantity: 2, unit: 'cup', item: 'rotisserie chicken', prep_note: 'finely chopped', section: null },
  { id: 'g1', quantity: 1, unit: 'tsp', item: 'minced garlic', section: null },
  { id: 'oy1', quantity: 1, unit: 'tbsp', item: 'oyster sauce', section: null },
  { id: 'soy1', quantity: 1, unit: 'tsp', item: 'soy sauce', section: null },
  { id: 'w1', quantity: 3, unit: 'tbsp', item: 'water', section: null },
  { id: 'soy2', quantity: 2, unit: 'tbsp', item: 'soy sauce', section: 'Sauce' },
  { id: 'oy2', quantity: 1, unit: 'tbsp', item: 'oyster sauce', section: 'Sauce' },
  { id: 'mirin', quantity: 1, unit: 'tbsp', item: 'mirin', section: 'Sauce' },
  { id: 'g2', quantity: 1, unit: 'tsp', item: 'minced garlic', section: 'Sauce' },
  { id: 'w2', quantity: 2, unit: 'tbsp', item: 'water', section: 'Sauce' },
]
const napaNeed = (text, earlier = []) => ingredientsForStep(text, napa, earlier).map((i) => i.id)

test('"the sauce ingredients" shows the Sauce part of the list', () => {
  assert.deepEqual(napaNeed('In the same pan, add the sauce ingredients. Simmer about 1 minute.'), ['soy2', 'oy2', 'mirin', 'g2', 'w2'])
})

test('using the finished sauce is not making it', () => {
  assert.deepEqual(napaNeed('Pour the sauce over the rolls and top with the green onion greens.'), [])
})

test('a step outside the sauce gets the filling copy', () => {
  assert.deepEqual(napaNeed('Add 3 tbsp water, cover, and steam about 4 minutes.'), ['w1'])
  assert.deepEqual(napaNeed('Stir in 1 tsp minced garlic and cook 30 seconds.'), ['g1'])
})

test('a short name inside a longer one only matches on its own', () => {
  const soup = [
    { id: 'g', item: 'green onion', prep_note: 'chopped, divided' },
    { id: 'o', item: 'onion', prep_note: 'diced' },
    { id: 'z', item: 'zucchini', prep_note: 'diced' },
  ]
  const ids = (text) => ingredientsForStep(text, soup).map((i) => i.id)
  assert.deepEqual(ids('Chop the green onion.'), ['g'])
  assert.deepEqual(ids('Dice the onion and zucchini.'), ['o', 'z'])
  assert.deepEqual(ids('Fry the onion and half the green onion.'), ['g', 'o'])
})

test('"egg mixture" is not the eggs', () => {
  const list = [{ id: 'e', item: 'large eggs' }, { id: 'w', item: 'water' }]
  assert.deepEqual(ingredientsForStep('Pour the egg mixture into the cups.', list).map((i) => i.id), [])
  assert.deepEqual(ingredientsForStep('Whisk the eggs and water.', list).map((i) => i.id), ['e', 'w'])
})
