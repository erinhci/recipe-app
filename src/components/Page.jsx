import { useEffect, useRef } from 'react'

// Every screen renders inside Page. On arrival it sets the document title
// and moves focus to the heading, so screen reader users hear where they
// landed after navigating.
// close: { label, onClick } puts an X at the top right (cooking modes).
export default function Page({ title, children, close }) {
  const headingRef = useRef(null)

  useEffect(() => {
    document.title = `${title} · Our Kitchen`
    headingRef.current?.focus()
  }, [title])

  return (
    <main id="main" className={close ? 'page has-close' : 'page'}>
      <h1 ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      {close && (
        <button className="close-btn" type="button" onClick={close.onClick} aria-label={close.label}>
          <span aria-hidden="true">×</span>
        </button>
      )}
      {children}
    </main>
  )
}
