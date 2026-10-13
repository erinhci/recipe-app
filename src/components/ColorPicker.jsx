import Icon from './Icon'
import { COLORS } from '../lib/avatars'

// Radio buttons for a cook's color. A color the other cook has is
// disabled and says so. The swatch has a check and an outline ring when
// chosen, so it isn't told by color alone.
// takenBy: { colorId: "Brian" }. large: the tiles used in setup.
export default function ColorPicker({ value, onChange, takenBy = {}, large = false, name = 'cook-color', legend = 'Your color', showLegend = false }) {
  return (
    <fieldset className={`color-picker${large ? ' is-large' : ''}`}>
      <legend className={showLegend ? 'color-legend' : 'sr-only'}>{legend}</legend>
      <div className="color-options">
        {COLORS.map((color) => {
          const taken = takenBy[color.id]
          const checked = value === color.id
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
              <span className="color-swatch" aria-hidden="true" style={{ background: `var(--cook-${color.id})` }}>
                {checked && <Icon name="check" size={large ? 24 : 18} />}
              </span>
              <span className={large ? 'color-name' : 'sr-only'}>
                {color.label}
                {taken && <span className={large ? 'color-taken' : ''}>{large ? <br /> : ', '}taken by {taken}</span>}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
