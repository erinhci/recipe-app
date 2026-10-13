import { forwardRef, useId, useRef, useState } from 'react'
import Icon from './Icon'
import { addMealPhoto, removeMealPhotos, usePhotoUrl } from '../lib/photos'

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})
export const formatPhotoDay = (day) => dateFormat.format(new Date(`${day}T12:00:00`))

// A photo from this phone or downloaded. While it loads (or offline and
// not saved yet) it shows an empty box of the same size.
export function PhotoImg({ photo, alt, className }) {
  const url = usePhotoUrl(photo)
  if (!url) return <span className={`photo-placeholder ${className ?? ''}`} role={alt ? 'img' : undefined} aria-label={alt || undefined} />
  return <img className={className} src={url} alt={alt} width={photo.width ?? undefined} height={photo.height ?? undefined} />
}

// A file picker that looks like a link or a button. The input stays in the
// tab order (visually hidden), so it works with a keyboard and VoiceOver.
// replacing: a photo this one swaps out.
export function AddPhoto({ recipeId, cookedOn, member, label, className = 'link-btn', onStatus, replacing = null }) {
  const id = useId()
  const [busy, setBusy] = useState(false)

  async function handleFile(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setBusy(true)
    onStatus?.({ text: 'Saving photo…' })
    try {
      await addMealPhoto({ recipeId, cookedOn, file, replacing }, member)
      onStatus?.({ text: replacing ? 'Photo replaced.' : `Photo added to ${formatPhotoDay(cookedOn)}.` })
    } catch (error) {
      onStatus?.({ text: error.message, error: true })
    } finally {
      setBusy(false)
    }
  }

  return (
    <label htmlFor={id} className={`file-pick ${className}`} aria-disabled={busy || undefined}>
      <input id={id} className="sr-only" type="file" accept="image/*" onChange={handleFile} disabled={busy} />
      {busy ? 'Saving…' : label}
    </label>
  )
}

// Props for a photo <dialog> that close it on a tap outside the box. A tap
// on the backdrop lands on the dialog element itself, since the content sits
// in a wrapper that fills the box. Both the press and the release have to be
// outside, so dragging out of the photo doesn't close it.
export function useBackdropClose(dialogRef) {
  const downOutside = useRef(false)
  return {
    onPointerDown: (e) => {
      downOutside.current = e.target === dialogRef.current
    },
    onClick: (e) => {
      if (downOutside.current && e.target === dialogRef.current) dialogRef.current.close()
      downOutside.current = false
    },
  }
}

// The X in the photo's top corner.
export const PhotoClose = forwardRef(function PhotoClose({ dialogRef }, ref) {
  return (
    <button ref={ref} className="photo-close" type="button" aria-label="Close photo" onClick={() => dialogRef.current?.close()}>
      <Icon name="close" size={22} />
    </button>
  )
})

// A small photo that opens a larger view with who added it and Remove.
export function PhotoThumb({ photo, recipeTitle, byName, onStatus }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)
  const backdrop = useBackdropClose(dialogRef)
  const alt =`${recipeTitle}, ${formatPhotoDay(photo.cooked_on)}, added by ${byName}`

  async function remove() {
    if (!window.confirm(`Remove ${byName === 'You' ? 'your' : `${byName}'s`} photo from ${formatPhotoDay(photo.cooked_on)}?`)) return
    dialogRef.current?.close()
    await removeMealPhotos([photo])
    onStatus?.({ text: 'Photo removed.' })
  }

  return (
    <>
      <button
        className="photo-thumb"
        type="button"
        onClick={() => {
          dialogRef.current?.showModal()
          // Start on the X, not on Remove photo.
          closeRef.current?.focus()
        }}
      >
        <PhotoImg photo={photo} alt={`Open photo: ${alt}`} />
      </button>
      <dialog ref={dialogRef} className="photo-dialog" aria-label={alt} {...backdrop}>
        <div className="photo-dialog-body">
          <div className="photo-frame">
            <PhotoImg photo={photo} alt={alt} className="photo-large" />
            <PhotoClose ref={closeRef} dialogRef={dialogRef} />
          </div>
          <p className="hint" style={{ margin: 'var(--space-2) 0' }}>
            {formatPhotoDay(photo.cooked_on)} · added by {byName}
          </p>
          <div className="actions">
            <button className="link-btn" type="button" onClick={remove}>
              Remove photo
            </button>
          </div>
        </div>
      </dialog>
    </>
  )
}
