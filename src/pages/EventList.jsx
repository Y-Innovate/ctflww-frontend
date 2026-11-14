import { Link } from 'react-router'
import { events } from '../api/lists'
import ErrorBanner from '../components/ErrorBanner'
import LoadMore from '../components/LoadMore'
import PhaseBadge from '../components/PhaseBadge'
import { usePagedList } from '../hooks/usePagedList'
import { isYes, label, PLAY_MODE } from '../lib/codes'
import { formatRange } from '../lib/timestamps'
import { linkTo, PATHS } from '../routes'

const NO_FILTERS = {}

// V1: published and closed events, newest first, 20 at a time
export default function EventList() {
  const list = usePagedList(events, NO_FILTERS)

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-[17px] font-medium">Events</h1>
      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && list.rows.length === 0 && (
        <p className="card p-6 text-fg-2">There are no events yet.</p>
      )}
      <ul className="grid gap-3 sm:grid-cols-2">
        {list.rows.map((e) => (
          <li key={e.eventID}>
            <Link
              to={linkTo(PATHS.events, { eventID: e.eventID })}
              className="card flex h-full flex-col gap-2 p-4 transition-colors hover:border-line-strong"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-[15px] font-medium">{e.eventName}</h2>
                <PhaseBadge event={e} />
              </div>
              <div className="text-[13px] text-fg-2">{formatRange(e.startTS, e.endTS)}</div>
              <div className="mt-auto flex flex-wrap gap-x-3 text-[12px] text-fg-3">
                <span>{label(PLAY_MODE, e.playMode)}</span>
                {isYes(e.registrationOpen) && <span className="text-success-fg">Registration open</span>}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <LoadMore list={list} label="Older events" />
    </section>
  )
}
