import { Link, useLocation } from 'react-router'
import { SIGN_OUT_URL } from '../api/auth'
import { BASE } from '../api/client'
import { useSession } from '../context/SessionContext'
import { PATHS } from '../routes'

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
}

// Who is signed in, or a sign-in link that returns to this page
export default function UserBadge() {
  const { user, loading, isOrganizer } = useSession()
  const { pathname, search } = useLocation()

  if (loading) return null
  if (!user) {
    if (pathname === PATHS.login) return null
    // LWW refuses paths that end in "/": the root is /ctf
    const returnTo = `${BASE}${pathname === '/' ? '' : pathname}${search}`
    return (
      <Link to={`${PATHS.login}?returnTo=${encodeURIComponent(returnTo)}`} className="btn-secondary header-signin">
        <i className="ti ti-login" aria-hidden="true" />
        Sign in
      </Link>
    )
  }

  const name = user.displayName || user.name || user.racfUserid
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-info-bg text-[11px] font-medium text-info-fg">
        {initials(name)}
      </div>
      <div className="hidden min-w-0 sm:block">
        <div className="truncate text-[13px] leading-tight">{name}</div>
        <div className="truncate text-[11px] text-header-fg-2">{isOrganizer ? 'Organizer' : user.racfUserid}</div>
      </div>
      <a href={SIGN_OUT_URL} className="btn-secondary header-signin ml-1">
        <i className="ti ti-logout" aria-hidden="true" />
        Sign out
      </a>
    </div>
  )
}
