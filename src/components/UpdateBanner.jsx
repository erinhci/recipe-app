import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { compareVersions, current } from '../lib/releases'

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
  const [next, setNext] = useState(null) // the waiting version's release entry
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

  // Read what the waiting version changes, straight from the server.
  useEffect(() => {
    if (!needRefresh) return
    fetch('/releases.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((list) => {
        const newest = Array.isArray(list) ? list[0] : null
        if (newest && compareVersions(newest.version, current.version) > 0) setNext(newest)
      })
      .catch(() => {})
  }, [needRefresh])

  if (!needRefresh || dismissed) return null
  return (
    <div className="update-banner" role="status">
      <span>
        {next ? `Version ${next.version} is ready` : 'A new version of the app is ready'}
        {next?.notes?.[0] && <span style={{ display: 'block', fontWeight: 400 }}>{next.notes[0]}</span>}
      </span>
      <div className="actions" style={{ margin: 0 }}>
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
