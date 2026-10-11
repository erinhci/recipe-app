import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { compareVersions, releasesSince } from './releases.helpers.js'

const releases = JSON.parse(readFileSync(new URL('../releases.json', import.meta.url)))

test('versions compare as numbers, not text', () => {
  assert.ok(compareVersions('0.10.0', '0.9.2') > 0)
  assert.ok(compareVersions('0.9.1', '0.9.2') < 0)
  assert.equal(compareVersions('1.0', '1.0.0'), 0)
})

test('the history is newest first, with unique versions, dates, and notes', () => {
  const versions = releases.map((r) => r.version)
  assert.equal(new Set(versions).size, versions.length)
  for (let i = 1; i < releases.length; i++) assert.ok(compareVersions(versions[i - 1], versions[i]) > 0)
  for (const r of releases) assert.ok(r.notes.length > 0 && /^\d{4}-\d{2}-\d{2}$/.test(r.date))
})

test("what's new since a version lists only the newer releases", () => {
  const list = [{ version: '0.10.0' }, { version: '0.9.2' }, { version: '0.9.1' }]
  assert.deepEqual(releasesSince('0.9.1', list).map((r) => r.version), ['0.10.0', '0.9.2'])
  assert.deepEqual(releasesSince('0.10.0', list), [])
})
