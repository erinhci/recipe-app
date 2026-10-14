import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import Icon from './Icon'

// Every screen renders inside Page. On arrival it sets the document title
// and moves focus to the heading, so screen reader users hear where they
// landed after navigating.
// close: { label, onClick } puts an X at the top right (cooking modes).
// aside: something small to sit on the title's row, at the right (Settings'
// sync status and button).
// subtitle: a short line right under the title (a recipe's cuisine).
// back: { to, label } puts a link back to the screen this one opened from
// above the title (Badges back to Stats).
// above: a band shown over the title (two-chef mode's label). With it,
// the close button sits in a row with the title instead of floating.
export default function Page({ title, children, close, aside, subtitle, back, above }) {
  const headingRef = useRef(null)

  useEffect(() => {
    document.title = `${title} · Our Kitchen`
    headingRef.current?.focus()
  }, [title])

  return (
    <main id="main" className={close && !above ? 'page has-close' : 'page'}>
      {back && (
        <Link className="back-link" to={back.to}>
          <span className="back-chev">
            <Icon name="chevron" size={20} />
          </span>
          {back.label}
        </Link>
      )}
      {above}
      {above && close ? (
        <div className="page-head">
          <h1 ref={headingRef} tabIndex={-1}>
            {title}
          </h1>
          <button className="close-btn is-inline" type="button" onClick={close.onClick} aria-label={close.label}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
      ) : aside ? (
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
      {close && !above && (
        <button className="close-btn" type="button" onClick={close.onClick} aria-label={close.label}>
          <span aria-hidden="true">×</span>
        </button>
      )}
      {children}
    </main>
  )
}
