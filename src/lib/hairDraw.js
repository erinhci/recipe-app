import { HAIR_STYLE_PIECES, PIECES } from './hairShapes.js'

// The pieces a hair style is drawn with, each with its flag (hCap, hAfro…)
// and layer. Unknown or 'none': nothing.
export function HAIR_SHAPES_FOR(hair) {
  return (HAIR_STYLE_PIECES[hair] ?? []).map((key) => ({ flag: key.split('_')[0], ...PIECES[key] }))
}

// Hair colors: natural shades, then brighter ones. light: bright enough
// that the hair's outline stays dark, even on deep skin tones.
export const HAIR_COLORS = [
  { id: 'black', label: 'Black', hex: '#111111' },
  { id: 'darkbrown', label: 'Dark brown', hex: '#3b2417' },
  { id: 'brown', label: 'Brown', hex: '#6b4226' },
  { id: 'auburn', label: 'Auburn', hex: '#8a3b1f' },
  { id: 'ginger', label: 'Ginger', hex: '#c4622d', light: true },
  { id: 'blonde', label: 'Blonde', hex: '#d9b26a', light: true },
  { id: 'platinum', label: 'Platinum', hex: '#ece0c4', light: true },
  { id: 'gray', label: 'Gray', hex: '#9c9c9c', light: true },
  { id: 'white', label: 'White', hex: '#f7f7f7', light: true },
  { id: 'pink', label: 'Pink', hex: '#f06aa8', light: true },
  { id: 'purple', label: 'Purple', hex: '#7d4fc9' },
  { id: 'blue', label: 'Blue', hex: '#2f6fd0' },
  { id: 'teal', label: 'Teal', hex: '#1fa898', light: true },
  { id: 'green', label: 'Green', hex: '#4fae3e', light: true },
]
