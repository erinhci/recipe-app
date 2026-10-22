import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";
import {
  AddPhoto,
  PhotoClose,
  PhotoImg,
  useBackdropClose,
} from "./MealPhotos";
import { PHOTOS_PER_COOK, removeMealPhotos } from "../lib/photos";

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
});
const formatDay = (day) => dateFormat.format(new Date(`${day}T12:00:00`));

// The recipe's photos, edge to edge, newest first, with an Add photo slide
// at the end. Swipe between them, or use the dots: every dot is a button,
// so swiping is never the only way (WCAG 2.5.7). The caption under the
// dots (date and who took it) is announced when the slide changes.
// Tapping a photo opens it with its options: Replace for your own photo and
// Remove. The X in the corner, a tap outside, or Escape closes it.
// addDay: the latest meal, which new photos belong to, or null, which hides
// the Add slide (nothing logged yet).
// photosLeft: how many more this cook can add (3 each per recipe). The Add
// slide says so up front; at 0 it explains instead of offering a picker.
export default function PhotoCarousel({
  recipe,
  photos,
  photoBy,
  addDay,
  photosLeft,
  member,
  onStatus,
}) {
  const track = useRef(null);
  const dialogRef = useRef(null);
  const closeRef = useRef(null);
  const backdrop = useBackdropClose(dialogRef);
  const [current, setCurrent] = useState(0);
  const [open, setOpen] = useState(null); // the photo shown in the dialog
  const slides = photos.length + (addDay ? 1 : 0);

  // Which slide is showing, from the scroll position.
  useEffect(() => {
    const el = track.current;
    if (!el) return undefined;
    const onScroll = () =>
      setCurrent(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [slides]);

  // Open the dialog once its photo has rendered, then start on the X.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog || dialog.open) return;
    dialog.showModal();
    closeRef.current?.focus();
  }, [open]);

  if (slides === 0) return null;

  function goTo(index) {
    const el = track.current;
    if (!el) return;
    const reduce = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollTo({
      left: index * el.clientWidth,
      behavior: reduce ? "auto" : "smooth",
    });
    setCurrent(index);
  }

  const openPhoto = (photo) => setOpen(photo);

  async function remove() {
    const by = photoBy(open);
    if (
      !window.confirm(
        `Remove ${by === "You" ? "your" : `${by}’s`} photo from ${formatDay(open.cooked_on)}?`,
      )
    )
      return;
    dialogRef.current?.close();
    await removeMealPhotos([open]);
    onStatus?.({ text: "Photo removed." });
  }

  const describe = (photo) =>
    `${recipe.title} as made on ${formatDay(photo.cooked_on)}, photo by ${photoBy(photo)}`;
  const shown = photos[current];
  const caption = shown
    ? `${formatDay(shown.cooked_on)} · ${photoBy(shown)}`
    : `Add a photo from ${formatDay(addDay)}`;
  const mine = open && open.added_by === member.user_id;

  return (
    <section
      className="carousel"
      aria-roledescription="carousel"
      aria-label={`Photos of ${recipe.title}`}
    >
      <ul className="carousel-track" ref={track}>
        {photos.map((photo, i) => (
          <li
            key={photo.id}
            aria-roledescription="slide"
            aria-label={`${i + 1} of ${slides}`}
          >
            <button
              type="button"
              className="carousel-open"
              onClick={() => openPhoto(photo)}
            >
              <PhotoImg
                photo={photo}
                className="carousel-photo"
                alt={`${describe(photo)}. Open for options`}
              />
              {photo.added_by === member.user_id && (
                <span className="carousel-edit" aria-hidden="true">
                  Edit
                </span>
              )}
            </button>
          </li>
        ))}
        {addDay && (
          <li
            aria-roledescription="slide"
            aria-label={`${slides} of ${slides}`}
          >
            {photosLeft > 0 ? (
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
                    Add photo
                    <span className="carousel-add-note">
                      {photosLeft} of {PHOTOS_PER_COOK} left for you
                    </span>
                  </>
                }
              />
            ) : (
              <div className="carousel-add is-full">
                <span>You’ve added {PHOTOS_PER_COOK} photos</span>
                <span className="carousel-add-note">
                  Tap one of yours to replace or remove it.
                </span>
              </div>
            )}
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
              aria-current={current === i ? "true" : undefined}
              onClick={() => goTo(i)}
            >
              <span />
            </button>
          ))}
          {addDay && (
            <button
              type="button"
              className="carousel-dot is-add"
              aria-label="Add photo"
              aria-current={current === photos.length ? "true" : undefined}
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

      <dialog
        ref={dialogRef}
        className="photo-dialog"
        aria-label={open ? describe(open) : "Photo"}
        onClose={() => setOpen(null)}
        {...backdrop}
      >
        {open && (
          <div className="photo-dialog-body">
            <div className="photo-frame">
              <PhotoImg
                photo={open}
                alt={describe(open)}
                className="photo-large"
              />
              <PhotoClose ref={closeRef} dialogRef={dialogRef} />
            </div>
            <p className="hint" style={{ margin: "var(--space-2) 0" }}>
              {formatDay(open.cooked_on)} · {photoBy(open)}
            </p>
            <div className="actions">
              <button className="link-btn" type="button" onClick={remove}>
                Remove photo
              </button>
              {mine && (
                <AddPhoto
                  recipeId={recipe.id}
                  cookedOn={open.cooked_on}
                  member={member}
                  className="btn btn-secondary"
                  label="Replace photo"
                  replacing={open}
                  onStatus={(status) => {
                    onStatus?.(status);
                    if (!status.error && status.text !== "Saving photo…")
                      dialogRef.current?.close();
                  }}
                />
              )}
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
