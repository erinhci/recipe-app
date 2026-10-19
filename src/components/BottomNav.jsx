import { NavLink } from 'react-router-dom'
import Icon from './Icon'
import Avatar, { lookProps } from './Avatar'
import { useAuth } from '../lib/auth'
import { useKitchenPeople } from '../lib/useKitchen'

const links = [
  { to: '/', label: 'Recipes', icon: 'library', end: true },
  { to: '/import', label: 'Add', icon: 'add' },
  { to: '/stats', label: 'Stats', icon: 'stats' },
  { to: '/settings', label: 'Settings', icon: 'settings', me: true },
]

// Settings shows your avatar in your color instead of a gear. The label
// stays "Settings" so the tab's purpose is clear, and the current tab's
// avatar gets a ring, so selection never relies on color alone.
function MyFace({ me }) {
  const look = me.look ?? {}
  return (
    <span className="nav-me" aria-hidden="true" style={{ background: `var(--cook-${me.color})` }}>
      <span className="nav-me-drawing">
        <Avatar pose="idle" {...lookProps(look)} size={44} />
      </span>
    </span>
  )
}

export default function BottomNav() {
  const { member } = useAuth()
  const people = useKitchenPeople(member?.user_id)
  const me = people?.me
  return (
    <nav className="bottom-nav" aria-label="Main">
      <ul>
        {links.map((link) => (
          <li key={link.to}>
            <NavLink to={link.to} end={link.end}>
              {link.me && me ? <MyFace me={me} /> : <Icon name={link.icon} size={22} />}
              <span>{link.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
