import { useEffect, useState } from 'react'

// Keeps the screen on while cooking. Returns 'checking', 'on', 'failed',
// or 'unsupported'.
//
// Safari only grants a wake lock during a user gesture (a tap or key
// press), and drops it whenever the app is hidden or the phone locks. So
// asking once when the screen opens often fails, and asking again on
// return to the app always fails. Instead, whenever the lock isn't held,
// the next tap anywhere asks for it again. Tapping "Done with step" is
// enough. The status follows the lock's own release event, so 'on' means
// the lock is actually held.
export function useWakeLock() {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [status, setStatus] = useState(supported ? 'checking' : 'unsupported')
  useEffect(() => {
    if (!supported) return undefined
    let lock = null
    let active = true
    let pending = false

    async function request() {
      if (lock || pending || document.visibilityState !== 'visible') return
      pending = true
      try {
        const next = await navigator.wakeLock.request('screen')
        if (!active) {
          next.release().catch(() => {})
          return
        }
        lock = next
        setStatus('on')
        next.addEventListener('release', () => {
          if (lock === next) lock = null
          if (active) setStatus('failed')
        })
      } catch {
        if (active) setStatus('failed')
      } finally {
        pending = false
      }
    }

    const onVisible = () => {
      if (document.visibilityState === 'visible') request()
    }
    // These count as a user gesture on a phone (a touch only does once the
    // finger lifts, so not pointerdown), so a request made here succeeds
    // where the earlier ones were refused.
    const onGesture = () => {
      if (!lock) request()
    }

    request()
    document.addEventListener('visibilitychange', onVisible)
    const GESTURES = ['touchend', 'click', 'keydown']
    for (const type of GESTURES) document.addEventListener(type, onGesture, true)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      for (const type of GESTURES) document.removeEventListener(type, onGesture, true)
      lock?.release().catch(() => {})
    }
  }, [supported])
  return status
}
