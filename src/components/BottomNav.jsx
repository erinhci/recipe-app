import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Library', end: true },
  { to: '/import', label: 'Import' },
  { to: '/stats', label: 'Stats' },
  { to: '/settings', label: 'Settings' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Main">
      <ul>
        {links.map((link) => (
          <li key={link.to}>
            <NavLink to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
