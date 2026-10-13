import { useEffect, useRef, useState } from 'react'
import Icon from './Icon'
import { AddPhoto, PhotoImg } from './MealPhotos'

const dateFormat = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
const formatDay = (day) => dateFormat.format(new Date(`${day}T12:00:00`))

// The recipe's photos, edge to edge, newest first, with an Add photo slide
// at the end. Swipe between them, or use the dots: every dot is a button,
// so swiping is never the only way (WCAG 2.5.7). The caption under the
// dots (date and who took it) is announced when the slide changes.
// addDay: the meal a new photo belongs to (the latest one), or null when
// nothing has been logged yet, which hides the Add slide.
export default function PhotoCarousel({ recipe, photos, photoBy, addDay, addLabel, member, onStatus }) {
  const track = useRef(null)
  const [current, setCurrent] = useState(0)
  const slides = photos.length + (addDay ? 1 : 0)

  // Which slide is showing, from the scroll position.
  useEffect(() => {
    const el = track.current
    if (!el) return undefined
    const onScroll = () => setCurrent(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)))
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [slides])

  if (slides === 0) return null

  function goTo(index) {
    const el = track.current
    if (!el) return
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    el.scrollTo({ left: index * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' })
    setCurrent(index)
  }

  const shown = photos[current]
  const caption = shown ? `${formatDay(shown.cooked_on)} · ${photoBy(shown)}` : 'Add a photo of how it turned out'

  return (
    <section className="carousel" aria-roledescription="carousel" aria-label={`Photos of ${recipe.title}`}>
      <ul className="carousel-track" ref={track}>
        {photos.map((photo, i) => (
          <li key={photo.id} aria-roledescription="slide" aria-label={`${i + 1} of ${slides}`}>
            <PhotoImg
              photo={photo}
              className="carousel-photo"
              alt={`${recipe.title} as made on ${formatDay(photo.cooked_on)}, photo by ${photoBy(photo)}`}
            />
          </li>
        ))}
        {addDay && (
          <li aria-roledescription="slide" aria-label={`${slides} of ${slides}`}>
            <AddPhoto
              recipeId={recipe.id}
              cookedOn={addDay}
              member={member}
              className="carousel-add"
              onStatus={onStatus}
              label={
                <>
                  <span className="carousel-add-icon" aria-hidden="true">
                    <Icon name="plus" size={28} />
                  </span>
                  {addLabel}
                </>
              }
            />
          </li>
        )}
      </ul>
      {slides > 1 && (
        <div className="carousel-dots" role="group" aria-label="Choose photo">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              type="button"
              className="carousel-dot"
              aria-label={`Photo ${i + 1} of ${photos.length}, ${photoBy(photo)}`}
              aria-current={current === i ? 'true' : undefined}
              onClick={() => goTo(i)}
            >
              <span />
            </button>
          ))}
          {addDay && (
            <button
              type="button"
              className="carousel-dot is-add"
              aria-label={addLabel}
              aria-current={current === photos.length ? 'true' : undefined}
              onClick={() => goTo(photos.length)}
            >
              <Icon name="plus" size={14} />
            </button>
          )}
        </div>
      )}
      <p className="carousel-caption hint" aria-live="polite">
        {caption}
      </p>
    </section>
  )
}
