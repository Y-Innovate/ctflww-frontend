import { Link, useSearchParams } from 'react-router'
import { leaderboard, PAGE_SIZE } from '../api/lists'
import ErrorBanner from '../components/ErrorBanner'
import LoadMore from '../components/LoadMore'
import PhaseBadge from '../components/PhaseBadge'
import { useSession } from '../context/SessionContext'
import { useEvent } from '../hooks/useEvent'
import { useMyPlace } from '../hooks/useMyPlace'
import { usePagedList } from '../hooks/usePagedList'
import { usePolling } from '../hooks/usePolling'
import { isYes } from '../lib/codes'
import { formatTs, isBlank } from '../lib/timestamps'
import { linkTo, PATHS } from '../routes'

const REFRESH_MS = 30_000

// V2: the standings of an event, 20 at a time; frozen for everyone but
// organizers (they get the live board in the admin screens).
export default function Leaderboard() {
  const [params] = useSearchParams()
  const eventID = params.get('eventID')
  if (!eventID) {
    return (
      <p className="card p-6 text-fg-2">
        Pick an event first. <Link className="underline" to={PATHS.events}>See the events</Link>.
      </p>
    )
  }
  return <Board key={eventID} eventID={eventID} />
}

function Board({ eventID }) {
  const { isPlayer } = useSession()
  const { event, error: eventError } = useEvent(eventID)
  const list = usePagedList(leaderboard, { eventID })
  const place = useMyPlace(eventID, isPlayer)
  const live = event && (event.phase === 'R' || event.phase === 'F')

  // Refresh the first page, unless more pages are open: that would close them
  usePolling(() => {
    if (!list.loading && list.rows.length <= PAGE_SIZE) list.reload()
  }, REFRESH_MS, Boolean(live))

  const notFound = eventError?.isNotFound || list.error?.isNotFound
  const playMode = event?.playMode
  const frozen = isYes(list.meta.isFrozen)

  return (
    <section className="flex flex-col gap-4">
      <Link className="text-[13px] text-fg-2 underline" to={linkTo(PATHS.events, { eventID })}>
        {event?.eventName ?? 'The event'}
      </Link>
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-[17px] font-medium">Leaderboard</h1>
        {event && <PhaseBadge event={event} />}
      </header>

      {notFound && <p className="card p-6 text-fg-2">This event doesn&apos;t exist, or isn&apos;t published yet.</p>}
      {!notFound && list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {frozen && (
        <p className="rounded-md bg-info-bg px-4 py-2.5 text-[13px] text-info-fg">
          <i className="ti ti-snowflake mr-1.5" aria-hidden="true" />
          The scoreboard is frozen{event && !isBlank(event.freezeTS) ? ` since ${formatTs(event.freezeTS)}` : ''}.
          Points scored after that still count, and show once the organizers lift the freeze.
        </p>
      )}

      {!notFound && !list.loading && !list.error && list.rows.length === 0 && (
        <p className="card p-6 text-fg-2">Nobody is on the board yet.</p>
      )}
      {list.rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="w-16">Rank</th>
                <th>{playMode === 'I' ? 'Player' : 'Team'}</th>
                <th className="text-right">Score</th>
                <th className="text-right">Solves</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((r) => {
                const mine = place && place.teamID === r.teamID
                return (
                  <tr key={r.teamID} className={mine ? 'font-medium' : undefined} aria-current={mine ? 'true' : undefined}>
                    <td>{r.rank}</td>
                    <td>
                      {r.teamName}
                      {mine && <span className="ml-2 rounded-full bg-info-bg px-1.5 text-[11px] text-info-fg">you</span>}
                    </td>
                    <td className="text-right tabular-nums">{r.score}</td>
                    <td className="text-right tabular-nums">{r.solveCount}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore list={list} label="Next 20" />
    </section>
  )
}
