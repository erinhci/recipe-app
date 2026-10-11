import { useEffect, useRef } from 'react'

// Every screen renders inside Page. On arrival it sets the document title
// and moves focus to the heading, so screen reader users hear where they
// landed after navigating.
export default function Page({ title, children }) {
  const headingRef = useRef(null)

  useEffect(() => {
    document.title = `${title} · Our Kitchen`
    headingRef.current?.focus()
  }, [title])

  return (
    <main id="main" className="page">
      <h1 ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      {children}
    </main>
  )
}
