import { useEffect, useState } from 'react'

// Shown while waiting on Gemini or the phone's own reader: a spinner, what's
// happening, and how long it has been, so a wait never looks like a frozen
// screen. Screen readers hear the message once (and once more if it runs
// long), not a count every second.
export default function Working({ label, typical, detail, slowAfter = 20 }) {
  const [seconds, setSeconds] = useState(0)

  useEffect(() => {
    const started = Date.now()
    const timer = setInterval(() => setSeconds(Math.floor((Date.now() - started) / 1000)), 1000)
    return () => clearInterval(timer)
  }, [])

  const slow = seconds >= slowAfter
  return (
    <div className="working" aria-busy="true">
      <span className="spinner" aria-hidden="true" />
      <div>
        <p role="status" style={{ margin: 0, fontWeight: 600 }}>
          {label}
          {slow && <span> Taking longer than usual. Gemini may be busy; you can keep waiting.</span>}
        </p>
        <p className="hint" style={{ margin: 0 }} aria-hidden="true">
          {seconds >= 2 ? `${seconds} seconds` : ' '}
          {detail ? ` · ${detail}` : typical && !slow ? ` · usually ${typical}` : ''}
        </p>
      </div>
    </div>
  )
}
