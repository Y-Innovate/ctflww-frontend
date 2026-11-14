import { Outlet, useLocation, useSearchParams } from 'react-router'
import { useSession } from '../context/SessionContext'
import { EVENT_PAGES, PATHS } from '../routes'
import ErrorBanner from './ErrorBanner'
import EventBar from './EventBar'
import TopBar from './TopBar'

const EVENT_PATHS = new Set([...EVENT_PAGES.map((p) => p.path), PATHS.challenge])

export default function Layout() {
  const { pathname } = useLocation()
  const [params] = useSearchParams()
  const { error, reload, isPlayer } = useSession()
  const eventID = params.get('eventID')
  const showEventBar = isPlayer && eventID && EVENT_PATHS.has(pathname)

  return (
    <div className="flex min-h-full flex-col">
      <TopBar />
      {showEventBar && <EventBar eventID={eventID} />}
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 sm:p-6">
        {error && <ErrorBanner error={`Could not check who is signed in: ${error.message}`} onRetry={reload} />}
        <Outlet />
      </main>
    </div>
  )
}
