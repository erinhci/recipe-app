// Run with: node --experimental-strip-types --test supabase/functions/import-recipe/index.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { pageText, recipeFromHtml } from './index.ts'

const page = (jsonLd: unknown) =>
  `<html><head><script type="application/ld+json">${JSON.stringify(jsonLd)}</script></head><body>Ads and a long story</body></html>`

test('reads a plain Recipe block', () => {
  const draft = recipeFromHtml(
    page({
      '@context': 'https://schema.org',
      '@type': 'Recipe',
      name: 'Weeknight Curry',
      recipeYield: ['4', '4 servings'],
      recipeCuisine: 'indian',
      totalTime: 'PT1H15M',
      recipeIngredient: ['1 1/2 lbs chicken thighs', '2 tbsp oil', '&frac12; tsp salt'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Heat the oil.' },
        { '@type': 'HowToStep', text: 'Brown the <b>chicken</b>.' },
      ],
    }),
    'https://example.com/curry',
  )
  assert.equal(draft.title, 'Weeknight Curry')
  assert.equal(draft.servings, 4)
  assert.equal(draft.cuisine, 'Indian')
  assert.equal(draft.total_time_minutes, 75)
  assert.equal(draft.ingredient_lines.length, 3)
  assert.deepEqual(draft.steps, ['Heat the oil.', 'Brown the chicken.'])
  assert.equal(draft.ingredient_lines[2], '½ tsp salt')
  assert.equal(draft.source_url, 'https://example.com/curry')
})

test('finds a recipe inside @graph with sections and a type array', () => {
  const draft = recipeFromHtml(
    page({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebPage', name: 'Blog' },
        {
          '@type': ['Recipe', 'NewsArticle'],
          name: 'Pancakes',
          recipeYield: 'Makes 8 pancakes',
          recipeIngredient: ['2 cups flour', '2 eggs'],
          recipeInstructions: [
            {
              '@type': 'HowToSection',
              name: 'Batter',
              itemListElement: [{ '@type': 'HowToStep', text: 'Whisk.' }],
            },
            { '@type': 'HowToSection', name: 'Cook', itemListElement: [{ '@type': 'HowToStep', text: 'Fry.' }] },
          ],
        },
      ],
    }),
  )
  assert.equal(draft.title, 'Pancakes')
  assert.equal(draft.servings, 8)
  assert.deepEqual(draft.steps, ['Whisk.', 'Fry.'])
})

test('reads steps written as one HTML string', () => {
  const draft = recipeFromHtml(
    page({ '@type': 'Recipe', name: 'Tea', recipeIngredient: ['1 tea bag'], recipeInstructions: '<p>Boil water.</p><p>Steep 3 minutes.</p>' }),
  )
  assert.deepEqual(draft.steps, ['Boil water.', 'Steep 3 minutes.'])
})

test('returns null when the page has no recipe data', () => {
  assert.equal(recipeFromHtml('<html><body>No data here</body></html>'), null)
  assert.equal(recipeFromHtml(page({ '@type': 'Article', name: 'News' })), null)
  assert.equal(recipeFromHtml('<script type="application/ld+json">{not json</script>'), null)
})

test('page text drops scripts and navigation', () => {
  const text = pageText('<nav>Menu</nav><script>var x = 1</script><p>2 cups rice</p><p>Cook it.</p>')
  assert.ok(text.includes('2 cups rice'))
  assert.ok(!text.includes('Menu'))
  assert.ok(!text.includes('var x'))
})
