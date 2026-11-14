import { Link, NavLink } from 'react-router'
import { useSession } from '../context/SessionContext'
import { ADMIN_PATHS, PATHS } from '../routes'
import UserBadge from './UserBadge'

const linkClass = ({ isActive }) => `header-link ${isActive ? 'header-link-active' : ''}`

export default function TopBar() {
  const { isPlayer, isOrganizer } = useSession()
  return (
    <header className="app-header">
      <div className="mx-auto flex h-[52px] max-w-5xl items-center gap-3 px-4">
        <Link to={PATHS.events} className="flex items-center gap-2 text-[14px] font-medium tracking-[-0.3px]">
          <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
          Y-Innovate CTF
        </Link>
        <nav className="flex items-center gap-1" aria-label="Main">
          <NavLink to={PATHS.events} end className={linkClass}>
            Events
          </NavLink>
          {isPlayer && (
            <NavLink to={PATHS.my} className={linkClass}>
              My events
            </NavLink>
          )}
          {isOrganizer && (
            <NavLink to={ADMIN_PATHS.events} className={linkClass}>
              Admin
            </NavLink>
          )}
        </nav>
        <div className="ml-auto">
          <UserBadge />
        </div>
      </div>
    </header>
  )
}
