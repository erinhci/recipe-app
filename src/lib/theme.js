// Appearance: follow the phone (system), or always light or dark. Saved on
// this phone only, since each phone can have its own preference. The same
// key is read by a small script in index.html before the app draws, so the
// page never flashes the wrong theme.
export const THEME_KEY = 'appearance'
export const THEMES = [
  { id: 'system', label: 'Match phone' },
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
]
const BAR = { light: '#ffffff', dark: '#121212' }

export function getTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system'
  }
}

export function applyTheme(theme) {
  const root = document.documentElement
  if (theme === 'light' || theme === 'dark') root.dataset.theme = theme
  else delete root.dataset.theme
  // The browser bar color: both tags take the forced color, or go back to
  // following the phone.
  for (const meta of document.querySelectorAll('meta[name="theme-color"]')) {
    const scheme = /dark/.test(meta.media) ? 'dark' : 'light'
    meta.content = BAR[theme === 'system' ? scheme : theme]
  }
}

export function setTheme(theme) {
  try {
    if (theme === 'system') localStorage.removeItem(THEME_KEY)
    else localStorage.setItem(THEME_KEY, theme)
  } catch {
    // Not saved (private mode); it still applies until the app closes.
  }
  applyTheme(theme)
}
