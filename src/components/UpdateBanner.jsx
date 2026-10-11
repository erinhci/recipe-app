import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'

const CHECK_EVERY = 10 * 60 * 1000
const MIN_GAP = 60 * 1000

// The home-screen app keeps a copy of itself for offline use. This checks
// for a newer version when the app comes back to the front, when the phone
// reconnects, when moving between screens (at most once a minute), and every
// 10 minutes. A new version downloads in the background; the banner then
// offers to switch. It never reloads on its own, so it can't interrupt
// cooking. If ignored, the new version starts the next time the app opens.
export default function UpdateBanner() {
  const registration = useRef(null)
  const lastCheck = useRef(0)
  const [dismissed, setDismissed] = useState(false)
  const { pathname } = useLocation()
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, r) {
      registration.current = r
    },
  })

  const check = (force = false) => {
    const now = Date.now()
    if (!navigator.onLine || !registration.current) return
    if (!force && now - lastCheck.current < MIN_GAP) return
    lastCheck.current = now
    registration.current.update().catch(() => {})
  }

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') check(true)
    }
    const onOnline = () => check(true)
    const timer = setInterval(() => check(true), CHECK_EVERY)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  // Moving between screens is a cheap moment to look for a new version.
  useEffect(() => {
    check()
  }, [pathname])

  if (!needRefresh || dismissed) return null
  return (
    <div className="update-banner" role="status">
      <span>A new version of the app is ready.</span>
      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
        <button className="btn" type="button" onClick={() => updateServiceWorker(true)}>
          Update now
        </button>
        <button className="btn btn-secondary" type="button" onClick={() => setDismissed(true)}>
          Later
        </button>
      </div>
    </div>
  )
}
