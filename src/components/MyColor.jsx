import { useEffect } from 'react'
import { useAuth } from '../lib/auth'
import { useKitchenPeople } from '../lib/useKitchen'

// Sets --me, --me-ink, --me-line and --me-fill on the page to this cook's color, so screens can
// use it (see "Your color across screens" in index.css). Renders nothing.
export default function MyColor() {
  const { member } = useAuth()
  const people = useKitchenPeople(member?.user_id)
  const color = people?.me?.color
  useEffect(() => {
    const root = document.documentElement.style
    if (!color) return undefined
    root.setProperty('--me', `var(--cook-${color})`)
    root.setProperty('--me-ink', `var(--ink-${color})`)
    root.setProperty('--me-line', `var(--line-${color})`)
    root.setProperty('--me-fill', `var(--fill-${color})`)
    return () => {
      root.removeProperty('--me')
      root.removeProperty('--me-ink')
      root.removeProperty('--me-line')
      root.removeProperty('--me-fill')
    }
  }, [color])
  return null
}
