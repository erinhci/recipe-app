// Run with: node --experimental-strip-types --test supabase/functions/import-recipe/index.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isBlockedPage, pageProblem, pageText, recipeFromHtml } from './index.ts'

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
      author: [{ '@type': 'Person', name: 'Priya Rao' }],
      publisher: { '@type': 'Organization', name: 'Example Kitchen' },
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
  assert.equal(draft.source_name, 'Priya Rao')
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

test('thinking is lowered only on Gemini 3 Flash, and dropped if a model rejects it', async () => {
  const { callGemini, thinkingFor } = await import('./index.ts')
  assert.deepEqual(thinkingFor('gemini-3.8-flash'), { thinkingLevel: 'low' })
  assert.equal(thinkingFor('gemini-3.5-flash-lite'), null)
  assert.equal(thinkingFor('gemini-2.5-flash'), null)

  const sent: any[] = []
  const realFetch = globalThis.fetch
  const realLog = console.log
  console.log = () => {}
  globalThis.fetch = (async (_url: string, init: any) => {
    const body = JSON.parse(init.body)
    sent.push(body.generationConfig)
    return new Response('{}', { status: body.generationConfig.thinkingConfig ? 400 : 200 })
  }) as typeof fetch
  try {
    const response = await callGemini('gemini-3.8-flash', 'key', [], { temperature: 0 })
    assert.equal(response.status, 200)
    assert.deepEqual(sent, [{ temperature: 0, thinkingConfig: { thinkingLevel: 'low' } }, { temperature: 0 }])
  } finally {
    globalThis.fetch = realFetch
    console.log = realLog
  }
})

test('reads a WordPress recipe plugin page inside a site graph', () => {
  const draft = recipeFromHtml(
    page({
      '@context': 'https://schema.org',
      '@graph': [
        { '@type': 'WebSite', name: 'Cookerru' },
        { '@type': ['Article', 'BlogPosting'], headline: 'Soondubu jjigae' },
        {
          '@type': 'Recipe',
          name: 'Easy Soondubu Jjigae (Korean Soft Tofu Stew)',
          author: { '@type': 'Person', name: 'Cookerru' },
          recipeYield: ['1', '1 person'],
          prepTime: 'PT5M',
          cookTime: 'PT10M',
          totalTime: 'PT15M',
          recipeIngredient: ['1 tbsp vegetable oil', '1 package (320 g) Korean or regular soft tofu', '1 egg'],
          recipeInstructions: [
            { '@type': 'HowToStep', text: 'Heat the oils and fry the aromatics.' },
            { '@type': 'HowToStep', text: 'Add the water and tofu and simmer.' },
            { '@type': 'HowToStep', text: 'Crack in the egg and serve.' },
          ],
        },
      ],
    }),
    'https://www.cookerru.com/soondubu-jjigae/',
  )
  assert.equal(draft?.title, 'Easy Soondubu Jjigae (Korean Soft Tofu Stew)')
  assert.equal(draft?.servings, 1)
  assert.equal(draft?.total_time_minutes, 15)
  assert.equal(draft?.ingredient_lines?.length, 3)
  assert.equal(draft?.steps.length, 3)
  assert.equal(draft?.source_name, 'Cookerru')
})

test('a "checking your browser" page is not the recipe', () => {
  assert.equal(isBlockedPage('<html><head><title>Just a moment...</title></head></html>'), true)
  assert.equal(isBlockedPage('<html><head><title>Soondubu</title></head></html>'), false)
})

test('page errors say what happened and what to try', () => {
  assert.match(pageProblem(403), /doesn't let apps read its pages \(error 403\)\. Save the page as a PDF/)
  assert.match(pageProblem(404), /wasn't found/)
  assert.match(pageProblem(0, true), /took too long/)
})
