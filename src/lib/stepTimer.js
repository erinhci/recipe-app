import { useEffect, useRef, useState } from 'react'

// Step timers. A timer is offered only on the large current step, and only
// when the step names a wait of 3 minutes or more ("Bake for 18-20
// minutes", "simmer 1 hour"). Short times ("whisk for 30 seconds") get none.

export const MIN_TIMER_MINUTES = 3

const WAIT = /(\d+(?:\.\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:\.\d+)?))?\s*(hours?|hrs?|minutes?|mins?)\b/gi

// The longest wait the step names, as { low, high } in minutes, or null.
// A range starts the timer at its low end; the high end becomes a note.
export function findWait(text) {
  let best = null
  for (const [, a, b, unit] of String(text ?? '').matchAll(WAIT)) {
    const perUnit = /^h/i.test(unit) ? 60 : 1
    const low = Number(a) * perUnit
    const high = (b ? Number(b) : Number(a)) * perUnit
    if (!(low >= MIN_TIMER_MINUTES)) continue
    if (!best || low > best.low) best = { low, high }
  }
  return best
}

// "18 min", "1 hr", "1 hr 30 min"
export function waitLabel(minutes) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h && m) return `${h} hr ${m} min`
  if (h) return `${h} hr`
  return `${m} min`
}

// 702 seconds -> "11:42"; an hour or more -> "1:05:00"
export function clock(seconds) {
  const s = Math.max(0, Math.ceil(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}

// Three short beeps. The audio context is made on the Start tap, since
// phones only allow sound that a tap started.
function beep(context) {
  if (!context) return
  try {
    for (let i = 0; i < 3; i += 1) {
      const osc = context.createOscillator()
      const gain = context.createGain()
      osc.frequency.value = 880
      gain.gain.value = 0.2
      osc.connect(gain).connect(context.destination)
      const at = context.currentTime + i * 0.35
      osc.start(at)
      osc.stop(at + 0.2)
    }
  } catch {
    // No sound; the alert and vibration still show it's done.
  }
}

// Timers for one cook, by step id. They keep running when you move to the
// next step (bake, then prep while it bakes). Times come from the clock,
// not from counting ticks, so a dimmed or backgrounded phone stays right.
export function useStepTimers() {
  const [timers, setTimers] = useState({})
  const [now, setNow] = useState(() => Date.now())
  const audio = useRef(null)
  const alerted = useRef(new Set())

  const isDue = (t) => t.endsAt != null && t.endsAt <= now
  const running = Object.values(timers).some((t) => t.endsAt != null && !isDue(t))
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(id)
  }, [running])

  // A finished timer vibrates and beeps once.
  useEffect(() => {
    for (const [id, t] of Object.entries(timers)) {
      if (t.endsAt == null || t.endsAt > now || alerted.current.has(id)) continue
      alerted.current.add(id)
      navigator.vibrate?.([300, 150, 300, 150, 300])
      beep(audio.current)
    }
  }, [timers, now])

  function start(id, minutes, label) {
    try {
      const Ctx = window.AudioContext ?? window.webkitAudioContext
      if (Ctx && !audio.current) audio.current = new Ctx()
      audio.current?.resume?.()
    } catch {
      audio.current = null
    }
    alerted.current.delete(id)
    const total = minutes * 60 * 1000
    setNow(Date.now())
    setTimers((all) => ({ ...all, [id]: { label, total, endsAt: Date.now() + total, paused: null } }))
  }
  function pause(id) {
    setTimers((all) => {
      const t = all[id]
      if (!t?.endsAt) return all
      return { ...all, [id]: { ...t, paused: t.endsAt - Date.now(), endsAt: null } }
    })
  }
  function resume(id) {
    setNow(Date.now())
    setTimers((all) => {
      const t = all[id]
      if (t?.paused == null) return all
      return { ...all, [id]: { ...t, endsAt: Date.now() + t.paused, paused: null } }
    })
  }
  function clear(id) {
    setTimers((all) => {
      const next = { ...all }
      delete next[id]
      return next
    })
  }

  // Seconds left, and the share done (0-1), for a step's timer.
  function view(id) {
    const t = timers[id]
    if (!t) return null
    const finished = isDue(t)
    const leftMs = finished ? 0 : t.paused ?? t.endsAt - now
    return { ...t, secondsLeft: leftMs / 1000, done: 1 - leftMs / t.total, state: finished ? 'done' : t.paused != null ? 'paused' : 'running' }
  }

  return { timers, view, start, pause, resume, clear }
}
