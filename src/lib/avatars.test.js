import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'

const { colorsFor, rewardFor, wornAvatar, kitchenScene, earnedKeys } = await import('./avatars.js')

test('each cook gets a different color, picked or not', () => {
  const colors = colorsFor([
    { user_id: 'a', joined_at: '2026-01-01' },
    { user_id: 'b', joined_at: '2026-01-02', color: 'coral' }, // an old color, now berry
    { user_id: 'c', joined_at: '2026-01-03', removed_at: '2026-02-01', color: 'blue' },
  ])
  assert.deepEqual(colors, { a: 'orange', b: 'berry' })
})

test('rewards are named for the badge that unlocks them', () => {
  assert.deepEqual(rewardFor({ kind: 'joined', threshold: 1 }), { type: 'hat', id: 'chef', label: 'Chef hat' })
  assert.equal(rewardFor({ kind: 'cuisines', threshold: 3 }).label, 'Night market scene')
  assert.equal(rewardFor({ kind: 'meals', threshold: 25 }), null)
})

test('locked items come off; the chef hat is on until taken off', () => {
  const earned = earnedKeys({ milestones: [{ kind: 'joined', threshold: 1, reached: true }, { kind: 'meals', threshold: 5, reached: false }] })
  assert.deepEqual(wornAvatar({ avatar: {} }, earned), { outfit: 'none', hat: 'chef', skin: 'plain', hair: 'none' })
  assert.deepEqual(wornAvatar({ avatar: { outfit: 'apron', hat: 'none', skin: 9, hair: 'locs' } }, earned), { outfit: 'none', hat: 'none', skin: '9', hair: 'locs' })
  assert.deepEqual(kitchenScene({ scene: 'picnic', duo_pose: 'nope' }, earned), { scene: 'home', pose: 'wave' })
})
