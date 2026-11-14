import { Suspense, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { signInHref } from '../api/auth'
import { BASE, goTo } from '../api/client'
import { useSession } from '../context/SessionContext'

// Organizer pages. On LWW the folder's login redirect gets there first; this
// covers dev and a session that ended. Hiding the pages is for the user only:
// the backend's admin check (CTF.ADMIN) protects the data. The admin pages
// are loaded on first use (React.lazy), hence the Suspense.
export default function AdminRoute() {
  const { user, loading, isOrganizer } = useSession()
  const { pathname, search } = useLocation()

  useEffect(() => {
    if (!loading && !user) goTo(signInHref(`${BASE}${pathname}${search}`))
  }, [loading, user, pathname, search])

  if (loading || !user) return null
  if (!isOrganizer) {
    return (
      <p className="card p-6 text-fg-2">
        This page is for organizers. Sign in with &quot;Organizer sign-in&quot; on the sign-in page to use it.
      </p>
    )
  }
  return (
    <Suspense fallback={<p className="text-[13px] text-fg-3">Loading…</p>}>
      <Outlet />
    </Suspense>
  )
}
