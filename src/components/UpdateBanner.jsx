import { useEffect, useRef } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_EVERY = 30 * 60 * 1000

// The home-screen app keeps a copy of itself for offline use. This checks
// for a newer version whenever the app comes back to the front (and every
// 30 minutes), and offers to switch. It never reloads on its own, so it
// can't interrupt cooking.
export default function UpdateBanner() {
  const registration = useRef(null)
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      registration.current = r
    },
  })

  useEffect(() => {
    const check = () => {
      if (navigator.onLine) registration.current?.update().catch(() => {})
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') check()
    }
    const timer = setInterval(check, CHECK_EVERY)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [])

  if (!needRefresh) return null
  return (
    <div className="offline-banner" role="status" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
      <span>A new version of the app is ready.</span>
      <button className="btn" type="button" onClick={() => updateServiceWorker(true)}>
        Update now
      </button>
    </div>
  )
}
