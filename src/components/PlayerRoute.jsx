import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { signInHref } from '../api/auth'
import { BASE, goTo } from '../api/client'
import { useSession } from '../context/SessionContext'

// Player pages. On LWW, the folder's login redirect gets there first; this
// covers dev and a session that ended while the app was open.
export default function PlayerRoute() {
  const { user, loading, isOrganizer } = useSession()
  const { pathname, search } = useLocation()

  useEffect(() => {
    if (!loading && !user) goTo(signInHref(`${BASE}${pathname}${search}`))
  }, [loading, user, pathname, search])

  if (loading || !user) return null
  if (isOrganizer) {
    return (
      <p className="card p-6 text-fg-2">
        Organizers have no player account, so the player pages aren&apos;t available. Sign in with a player userid to play.
      </p>
    )
  }
  return <Outlet />
}
