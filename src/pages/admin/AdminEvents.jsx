import { Link, useSearchParams } from 'react-router'
import { adminEvents } from '../../api/admin'
import ErrorBanner from '../../components/ErrorBanner'
import LoadMore from '../../components/LoadMore'
import { usePagedList } from '../../hooks/usePagedList'
import { formatRange } from '../../lib/timestamps'
import { ADMIN_PATHS, linkTo } from '../../routes'
import StatusBadge from './StatusBadge'

const FILTERS = [
  ['', 'Current'],
  ['D', 'Drafts'],
  ['P', 'Published'],
  ['C', 'Closed'],
  ['A', 'Archived'],
]

// A1: every event, drafts and closed ones too, by ID (as CTFM402 lists
// them); the status filter is in the query string. Without a filter
// ("Current") CTFM402 leaves out the archived events (A10).
export default function AdminEvents() {
  const [params, setParams] = useSearchParams()
  const status = params.get('status') ?? ''
  const list = usePagedList(adminEvents, status ? { eventStatus_filter: status } : {})

  const setStatus = (value) => setParams(value ? { status: value } : {}, { replace: true })

  return (
    <section className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[17px] font-medium">Events</h1>
        <div className="flex gap-1" role="group" aria-label="Status">
          {FILTERS.map(([value, title]) => (
            <button key={value} type="button" aria-pressed={status === value}
              className={`rounded-md px-2.5 py-1 text-[13px] ${status === value ? 'bg-surface-2 font-medium' : 'text-fg-2 hover:bg-surface-2'}`}
              onClick={() => setStatus(value)}>
              {title}
            </button>
          ))}
        </div>
        <Link className="btn-primary ml-auto" to={ADMIN_PATHS.event}>
          <i className="ti ti-plus" aria-hidden="true" />
          New event
        </Link>
      </header>

      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && list.rows.length === 0 && (
        <p className="card p-6 text-fg-2">{status === 'A' ? 'No archived events. A closed event can be archived from its page.'
            : status ? 'No events with this status.' : 'No events yet. Start with "New event".'}</p>
      )}
      {list.rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="w-12">ID</th>
                <th>Event</th>
                <th>Status</th>
                <th>When</th>
                <th className="text-right">Players</th>
                <th>Group</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((e) => (
                <tr key={e.eventID}>
                  <td className="tabular-nums text-fg-3">{e.eventID}</td>
                  <td>
                    <Link className="font-medium hover:underline" to={linkTo(ADMIN_PATHS.event, { eventID: e.eventID })}>
                      {e.eventName}
                    </Link>
                    <div className="text-[11px] text-fg-3">{e.playMode === 'I' ? 'Individual' : `Teams of up to ${e.maxTeamSize}`}</div>
                  </td>
                  <td><StatusBadge event={e} /></td>
                  <td className="whitespace-nowrap text-[12px]">{formatRange(e.startTS, e.endTS)}</td>
                  <td className="text-right tabular-nums">{e.playerCount} / {e.maxPlayers}</td>
                  <td className="font-mono text-[12px]">{e.racfGroup}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore list={list} label="Next 20" />
    </section>
  )
}
