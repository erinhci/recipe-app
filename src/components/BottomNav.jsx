import { NavLink } from 'react-router-dom'
import Icon from './Icon'

const links = [
  { to: '/', label: 'Library', icon: 'library', end: true },
  { to: '/import', label: 'Add', icon: 'add' },
  { to: '/stats', label: 'Stats', icon: 'stats' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <ul>
        {links.map((link) => (
          <li key={link.to}>
            <NavLink to={link.to} end={link.end}>
              <Icon name={link.icon} size={22} />
              <span>{link.label}</span>
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
