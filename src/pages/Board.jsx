import { Link, useSearchParams } from 'react-router'
import { challenges } from '../api/lists'
import BlockedNote from '../components/BlockedNote'
import ErrorBanner from '../components/ErrorBanner'
import PhaseBadge from '../components/PhaseBadge'
import { useEvent } from '../hooks/useEvent'
import { useFullList } from '../hooks/useFullList'
import { useMyPlace } from '../hooks/useMyPlace'
import { usePolling } from '../hooks/usePolling'
import { isPlayable, isYes } from '../lib/codes'
import { whyBlocked } from '../lib/play'
import { formatTs, isBlank } from '../lib/timestamps'
import { linkTo, PATHS } from '../routes'

const REFRESH_MS = 60_000

// P4: the challenges of an event, grouped by category in the organizers'
// order, with value, solves, and marks for solved and locked.
export default function Board() {
  const [params] = useSearchParams()
  const eventID = params.get('eventID')
  if (!eventID) {
    return (
      <p className="card p-6 text-fg-2">
        Pick an event first. <Link className="underline" to={PATHS.my}>See your events</Link>.
      </p>
    )
  }
  return <ChallengeBoard key={eventID} eventID={eventID} />
}

function ChallengeBoard({ eventID }) {
  const { event, error: eventError } = useEvent(eventID)
  const place = useMyPlace(eventID, true)
  const known = Boolean(event) && place !== undefined
  const blocked = known ? whyBlocked(event, place) : null
  const list = useFullList(challenges, { eventID }, { enabled: known && !blocked })
  const live = Boolean(event) && isPlayable(event)

  usePolling(() => {
    if (!list.loading) list.reload()
  }, REFRESH_MS, live && known && !blocked)

  const header = (
    <header className="flex flex-wrap items-center gap-2">
      <h1 className="text-[17px] font-medium">Challenges</h1>
      {event && <PhaseBadge event={event} />}
      {list.loaded && list.rows.length > 0 && (
        <span className="text-[13px] text-fg-2">
          {list.rows.filter((c) => isYes(c.isSolved)).length} of {list.rows.length} solved
        </span>
      )}
    </header>
  )

  if (eventError) {
    return (
      <section className="flex flex-col gap-4">
        {header}
        {eventError.isNotFound
          ? <p className="card p-6 text-fg-2">This event doesn&apos;t exist, or isn&apos;t published yet.</p>
          : <ErrorBanner error={eventError} />}
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-4">
      {header}
      <BlockedNote reason={blocked} event={event} eventID={eventID} />
      {list.error && <ListError error={list.error} onRetry={list.reload} />}
      {!blocked && event && <PhaseNote event={event} />}
      {list.loaded && list.rows.length === 0 && (
        <p className="card p-6 text-fg-2">There are no challenges yet. Keep an eye on the announcements.</p>
      )}
      {groupByCategory(list.rows).map((g) => (
        <section key={g.category} className="flex flex-col gap-2" aria-labelledby={`cat-${g.category}`}>
          <h2 id={`cat-${g.category}`} className="text-[13px] font-medium uppercase tracking-wide text-fg-3">
            {g.name}
          </h2>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {g.rows.map((c) => (
              <li key={c.challengeID}>
                <ChallengeCard eventID={eventID} challenge={c} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </section>
  )
}

function ListError({ error, onRetry }) {
  if (error.isWrongState) return <p className="card p-6 text-fg-2">This event hasn&apos;t started yet.</p>
  if (error.isNotAllowed) return <p className="card p-6 text-fg-2">You have no active place in this event.</p>
  return <ErrorBanner error={error} onRetry={onRetry} />
}

function PhaseNote({ event }) {
  if (event.phase === 'F') {
    const since = isBlank(event.freezeTS) ? '' : ` since ${formatTs(event.freezeTS)}`
    return (
      <p className="rounded-md bg-info-bg px-4 py-2.5 text-[13px] text-info-fg">
        <i className="ti ti-snowflake mr-1.5" aria-hidden="true" />
        The scoreboard is frozen{since}: values and solve counts stay as they were at the freeze.
        Your own solves still show, and every flag still counts.
      </p>
    )
  }
  if (!isPlayable(event)) {
    return (
      <p className="rounded-md bg-surface-2 px-4 py-2.5 text-[13px] text-fg-2">
        The event has ended. You can still read the challenges, but no longer submit flags.
      </p>
    )
  }
  return null
}

// Categories in the order of their first challenge; the rows come sorted
// by the organizers' sort order already.
function groupByCategory(rows) {
  const groups = new Map()
  for (const c of rows) {
    const key = c.category || '-'
    if (!groups.has(key)) groups.set(key, { category: key, name: c.categoryName || c.category || 'Other', rows: [] })
    groups.get(key).rows.push(c)
  }
  return [...groups.values()]
}

function ChallengeCard({ eventID, challenge: c }) {
  const solved = isYes(c.isSolved)
  const locked = isYes(c.isLocked)
  const solves = c.solveCount === 1 ? '1 solve' : `${c.solveCount} solves`
  return (
    <Link
      to={linkTo(PATHS.challenge, { eventID, challengeID: c.challengeID })}
      className={`card flex h-full flex-col gap-1.5 p-4 transition-colors hover:bg-surface-2 ${
        solved ? 'border-success-fg/40' : ''
      } ${locked ? 'opacity-70' : ''}`}
    >
      <span className="flex items-start gap-2">
        <span className="flex-1 text-[14px] font-medium">{c.challengeTitle}</span>
        {solved && (
          <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-medium text-success-fg">
            <i className="ti ti-check" aria-hidden="true" />
            Solved
          </span>
        )}
        {locked && (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-fg-2">
            <i className="ti ti-lock" aria-hidden="true" />
            Locked
          </span>
        )}
      </span>
      <span className="flex gap-3 text-[12px] text-fg-3">
        <span className="tabular-nums">{c.currentPoints} points</span>
        <span className="tabular-nums">{solves}</span>
      </span>
    </Link>
  )
}
