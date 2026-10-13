import { useEffect, useRef } from 'react'

// Every screen renders inside Page. On arrival it sets the document title
// and moves focus to the heading, so screen reader users hear where they
// landed after navigating.
// close: { label, onClick } puts an X at the top right (cooking modes).
// aside: something small to sit on the title's row, at the right (Settings'
// sync status and button).
// subtitle: a short line right under the title (a recipe's cuisine).
export default function Page({ title, children, close, aside, subtitle }) {
  const headingRef = useRef(null)

  useEffect(() => {
    document.title = `${title} · Our Kitchen`
    headingRef.current?.focus()
  }, [title])

  return (
    <main id="main" className={close ? 'page has-close' : 'page'}>
      {aside ? (
        <div className="page-head">
          <h1 ref={headingRef} tabIndex={-1}>
            {title}
          </h1>
          {aside}
        </div>
      ) : (
        <h1 ref={headingRef} tabIndex={-1}>
          {title}
        </h1>
      )}
      {subtitle && <p className="page-subtitle">{subtitle}</p>}
      {close && (
        <button className="close-btn" type="button" onClick={close.onClick} aria-label={close.label}>
          <span aria-hidden="true">×</span>
        </button>
      )}
      {children}
    </main>
  )
}
