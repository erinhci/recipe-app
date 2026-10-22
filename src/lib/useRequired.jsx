import { useRef, useState } from 'react'

// A text field that needs something before its form submits. The submit
// button stays enabled; submitting it empty marks the field invalid, shows
// why under it and moves focus there, so a screen reader hears the field
// and the reason together (WCAG 3.3.1). Typing clears it.
//
//   const note = useRequired('note', 'Write a note first.')
//   <textarea ref={note.ref} {...note.field(otherDescribedBy)} />
//   {note.error}
//   on submit: if (!note.check(text)) return
export function useRequired(id, message) {
  const ref = useRef(null)
  const [missing, setMissing] = useState(false)
  const errorId = `${id}-required`
  return {
    ref,
    missing,
    field: (describedBy) => ({
      'aria-invalid': missing || undefined,
      'aria-describedby': [describedBy, missing && errorId].filter(Boolean).join(' ') || undefined,
    }),
    error: missing ? (
      <p id={errorId} className="error field-error">
        {message}
      </p>
    ) : null,
    check(value) {
      if (String(value ?? '').trim()) return true
      setMissing(true)
      ref.current?.focus()
      return false
    },
    clear: () => setMissing(false),
  }
}
