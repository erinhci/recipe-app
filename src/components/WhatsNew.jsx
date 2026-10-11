import { useState } from 'react'
import { current, releaseDate, releasesSince } from '../lib/releases'

const KEY = 'seen-version'

function readSeen() {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function saveSeen() {
  try {
    localStorage.setItem(KEY, current.version)
  } catch {
    // Storage unavailable; it'll show again next time, which is harmless.
  }
}

// Shown once after the app updates: what changed since the version this
// phone last ran. On a first install there's nothing to compare, so it
// just remembers the version.
export default function WhatsNew() {
  const [newer] = useState(() => {
    const seen = readSeen()
    if (!seen) {
      saveSeen()
      return []
    }
    return releasesSince(seen)
  })
  const [open, setOpen] = useState(newer.length > 0)

  if (!open) return null
  const close = () => {
    saveSeen()
    setOpen(false)
  }
  return (
    <section className="update-banner" aria-labelledby="whats-new-heading" style={{ display: 'block' }}>
      <h2 id="whats-new-heading" style={{ fontSize: '1.125rem', margin: '0 0 var(--space-2)' }}>
        Updated to version {current.version}
      </h2>
      <div style={{ maxHeight: '40vh', overflowY: 'auto', fontWeight: 400 }}>
        {newer.map((release) => (
          <div key={release.version}>
            {newer.length > 1 && (
              <p className="hint" style={{ margin: 'var(--space-2) 0 0' }}>
                {release.version} · {releaseDate(release)}
              </p>
            )}
            <ul style={{ paddingLeft: 'var(--space-6)', margin: 'var(--space-1) 0' }}>
              {release.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <button className="btn" type="button" onClick={close} style={{ marginTop: 'var(--space-2)' }}>
        Got it
      </button>
    </section>
  )
}
