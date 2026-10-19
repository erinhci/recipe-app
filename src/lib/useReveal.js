import { useEffect } from 'react'

// Marks each .reveal element on the page with .is-seen the first time it
// scrolls into view, so its animations start then instead of on load
// (see "Stats: animations wait" in index.css). Without IntersectionObserver
// everything counts as seen.
export function useReveal(deps = []) {
  useEffect(() => {
    const items = [...document.querySelectorAll('.reveal:not(.is-seen)')]
    if (!('IntersectionObserver' in window)) {
      for (const item of items) item.classList.add('is-seen')
      return undefined
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-seen')
          observer.unobserve(entry.target)
        }
      },
      { threshold: 0.35 },
    )
    for (const item of items) observer.observe(item)
    return () => observer.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
