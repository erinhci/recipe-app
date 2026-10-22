import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

// Text people read uses a typographic apostrophe (’), not the straight
// keyboard one ('). This checks every screen and component, plus the
// library files that hold messages shown in the app. Comment lines are
// skipped; code that compares against a straight apostrophe should use a
// ' escape instead.
const ROOT = new URL('..', import.meta.url).pathname
const SHOWN = ['lib/importRecipe.js', 'lib/functions.js', 'lib/sync.js', 'lib/photos.js', 'lib/twoChefLive.js']

function jsxFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return jsxFiles(path)
    return path.endsWith('.jsx') ? [path] : []
  })
}

test('shown text uses typographic apostrophes', () => {
  const files = [...jsxFiles(ROOT), ...SHOWN.map((f) => join(ROOT, f))]
  const found = []
  for (const file of files) {
    readFileSync(file, 'utf8').split('\n').forEach((line, i) => {
      if (/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(line)) return
      if (/([A-Za-z]|[})])'[a-z]/.test(line)) found.push(`${file.replace(ROOT, '')}:${i + 1}`)
    })
  }
  assert.deepEqual(found, [])
})

test('release notes use typographic apostrophes', () => {
  const notes = JSON.parse(readFileSync(join(ROOT, 'releases.json'), 'utf8')).flatMap((r) => r.notes)
  assert.deepEqual(notes.filter((n) => /[A-Za-z]'[a-z]/.test(n)), [])
})
