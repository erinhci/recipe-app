import Icon from './Icon'
import Avatar, { lookProps } from './Avatar'
import { COLORS } from '../lib/avatars'

// Radio buttons for a cook's color. Yours has a check and a solid ring.
// The other cook's color stays at full strength with their face in it and
// a dashed ring, can't be picked, and a line under the row says whose it
// is, so it isn't told by color or fading alone.
// takenBy: { colorId: "Brian" } or { colorId: { name, look } }.
// large: the tiles used in setup.
export default function ColorPicker({ value, onChange, takenBy = {}, large = false, name = 'cook-color', legend = 'Your color', showLegend = false }) {
  const owner = (id) => {
    const t = takenBy[id]
    return typeof t === 'string' ? { name: t } : t
  }
  const takenColor = COLORS.find((c) => owner(c.id))
  const noteId = `${name}-note`
  return (
    <fieldset className={`color-picker${large ? ' is-large' : ''}`} aria-describedby={!large && takenColor ? noteId : undefined}>
      <legend className={showLegend ? 'color-legend' : 'sr-only'}>{legend}</legend>
      <div className="color-options">
        {COLORS.map((color) => {
          const taken = owner(color.id)
          const checked = value === color.id
          // Their face, cropped to the swatch (the drawing is about 3x the circle).
          const face = taken?.look && (
            <span className="swatch-face">
              <Avatar pose="idle" {...lookProps(taken.look)} size={large ? 160 : 111} />
            </span>
          )
          return (
            <label key={color.id} className={`color-option${taken ? ' is-taken' : ''}`}>
              <input
                type="radio"
                className="sr-only"
                name={name}
                value={color.id}
                checked={checked}
                disabled={Boolean(taken)}
                onChange={() => onChange(color.id)}
              />
              <span className="color-swatch" aria-hidden="true" style={{ background: `var(--cook-${color.id})`, color: `var(--ink-${color.id})` }}>
                {checked && <Icon name="check" size={large ? 24 : 18} />}
                {face}
              </span>
              <span className={large ? 'color-name' : 'sr-only'}>
                {color.label}
                {taken && <span className={large ? 'color-taken' : ''}>{large ? <br /> : ', '}taken by {taken.name}</span>}
              </span>
            </label>
          )
        })}
      </div>
      {!large && takenColor && (
        <p id={noteId} className="color-note">
          <span className="cook-dot" aria-hidden="true" style={{ background: `var(--cook-${takenColor.id})` }} />
          {takenColor.label} is {owner(takenColor.id).name}'s. Two cooks can't share a color.
        </p>
      )}
    </fieldset>
  )
}
