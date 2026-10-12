import { useEffect } from 'react'

// Marks the item of a list nearest the middle of the screen with
// .in-focus as the page scrolls, so the step being read stands out.
// The styling lives in CSS (and drops the motion for reduced motion).
export function useScrollFocus(ref, deps = []) {
  useEffect(() => {
    const list = ref.current
    if (!list) return undefined
    let frame = 0
    const update = () => {
      frame = 0
      const middle = window.innerHeight * 0.45
      let best = null
      let distance = Infinity
      for (const item of list.children) {
        const box = item.getBoundingClientRect()
        if (box.bottom < 0 || box.top > window.innerHeight) continue
        const d = box.top <= middle && box.bottom >= middle ? 0 : Math.min(Math.abs(box.top - middle), Math.abs(box.bottom - middle))
        if (d < distance) {
          distance = d
          best = item
        }
      }
      for (const item of list.children) item.classList.toggle('in-focus', item === best)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
