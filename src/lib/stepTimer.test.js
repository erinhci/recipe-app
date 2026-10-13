import { test } from 'node:test'
import assert from 'node:assert/strict'
import { clock, findWait, waitLabel } from './stepTimer.js'

test('a wait of 3 minutes or more gets a timer', () => {
  assert.deepEqual(findWait('Bake for 18–20 minutes until set.'), { low: 18, high: 20 })
  assert.deepEqual(findWait('Let sit in the pan for 3-5 minutes, then serve.'), { low: 3, high: 5 })
  assert.deepEqual(findWait('Simmer 1 hour, stirring now and then.'), { low: 60, high: 60 })
})

test('short times get no timer', () => {
  assert.equal(findWait('Whisk for 30 seconds until blended.'), null)
  assert.equal(findWait('Cook 2 minutes more.'), null)
  assert.equal(findWait('Preheat the oven to 350°F.'), null)
})

test('the longest wait in a step wins', () => {
  assert.deepEqual(findWait('Microwave 1 minute, stir, then rest 10 minutes.'), { low: 10, high: 10 })
})

test('labels and the countdown', () => {
  assert.equal(waitLabel(18), '18 min')
  assert.equal(waitLabel(90), '1 hr 30 min')
  assert.equal(clock(702), '11:42')
  assert.equal(clock(3900), '1:05:00')
  assert.equal(clock(-3), '0:00')
})
