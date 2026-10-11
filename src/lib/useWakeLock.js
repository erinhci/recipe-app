import { useEffect, useState } from 'react'

// Keeps the screen on while cooking. Returns 'checking', 'on', 'failed',
// or 'unsupported'.
export function useWakeLock() {
  const supported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [status, setStatus] = useState(supported ? 'checking' : 'unsupported')
  useEffect(() => {
    if (!supported) return undefined
    let lock = null
    let active = true
    async function request() {
      try {
        lock = await navigator.wakeLock.request('screen')
        if (active) setStatus('on')
        else lock.release()
      } catch {
        if (active) setStatus('failed')
      }
    }
    // The lock drops when the phone locks or the app is hidden; ask again on return.
    const onVisible = () => {
      if (document.visibilityState === 'visible') request()
    }
    request()
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      active = false
      document.removeEventListener('visibilitychange', onVisible)
      lock?.release().catch(() => {})
    }
  }, [supported])
  return status
}
