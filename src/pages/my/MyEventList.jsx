import { Link } from 'react-router'
import ErrorBanner from '../../components/ErrorBanner'
import LoadMore from '../../components/LoadMore'
import PhaseBadge from '../../components/PhaseBadge'
import { label, PLAY_MODE } from '../../lib/codes'
import { linkTo, PATHS } from '../../routes'

// The events the player joined, oldest first, with where to go next
export default function MyEventList({ list }) {
  return (
    <section className="flex flex-col gap-3">
      <h1 className="text-[17px] font-medium">My events</h1>
      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && list.rows.length === 0 && (
        <p className="card p-6 text-fg-2">You haven&apos;t joined an event yet. Join one below with its code.</p>
      )}
      <ul className="flex flex-col gap-2">
        {list.rows.map((e) => (
          <li key={e.eventID} className="card flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link className="text-[15px] font-medium hover:underline" to={linkTo(PATHS.events, { eventID: e.eventID })}>
                  {e.eventName}
                </Link>
                <PhaseBadge event={e} />
              </div>
              <div className="mt-0.5 text-[12px] text-fg-3">{placeText(e)}</div>
            </div>
            <EventLinks event={e} />
          </li>
        ))}
      </ul>
      <LoadMore list={list} />
    </section>
  )
}

function placeText(e) {
  if (e.partStatus === 'P') return 'Your place waits for its RACF job; check again in a few minutes.'
  if (e.playMode === 'T') return e.teamID ? `Team ${e.teamName}` : 'No team yet: create or join one'
  return label(PLAY_MODE, e.playMode)
}

function EventLinks({ event: e }) {
  if (e.partStatus === 'P') return null
  const link = (path, text, icon) => (
    <Link className="btn-secondary" to={linkTo(path, { eventID: e.eventID })}>
      <i className={`ti ${icon}`} aria-hidden="true" />
      {text}
    </Link>
  )
  const needsTeam = e.playMode === 'T' && !e.teamID
  return (
    <div className="flex flex-wrap gap-2">
      {needsTeam ? link(PATHS.team, 'Find a team', 'ti-users') : link(PATHS.board, 'Challenges', 'ti-flag')}
      {!needsTeam && e.playMode === 'T' && link(PATHS.team, 'Team', 'ti-users')}
      {link(PATHS.leaderboard, 'Leaderboard', 'ti-trophy')}
    </div>
  )
}
