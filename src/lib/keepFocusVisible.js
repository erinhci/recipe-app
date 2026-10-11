// WCAG 2.4.11: a focused control must not end up hidden behind the sticky
// bottom bar (or the update banner at the top). Browsers scroll a focused
// field "into view" without counting fixed bars, so this nudges the page
// when that happens.
const MARGIN = 16

export function keepFocusVisible() {
  function onFocus(event) {
    const el = event.target
    if (!(el instanceof HTMLElement) || el === document.body) return
    // Let the browser's own scroll finish first.
    requestAnimationFrame(() => {
      const rect = el.getBoundingClientRect()
      const bars = [...document.querySelectorAll('.bottom-nav, .cook-nav')].filter((bar) => !bar.contains(el))
      const bottomLimit = bars.length ? Math.min(...bars.map((bar) => bar.getBoundingClientRect().top)) : window.innerHeight
      const banner = [...document.querySelectorAll('.update-banner')].find((b) => !b.contains(el))
      const topLimit = banner ? banner.getBoundingClientRect().bottom : 0
      if (rect.bottom > bottomLimit - MARGIN) window.scrollBy(0, rect.bottom - bottomLimit + MARGIN)
      else if (rect.top < topLimit + MARGIN) window.scrollBy(0, rect.top - topLimit - MARGIN)
    })
  }
  document.addEventListener('focusin', onFocus)
  return () => document.removeEventListener('focusin', onFocus)
}
