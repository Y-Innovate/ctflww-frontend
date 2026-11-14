import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { getEvent } from '../api/events'
import { useUnreadCount } from '../hooks/useUnreadCount'
import { eventPhase } from '../lib/codes'
import { EVENT_PAGES, linkTo, PATHS } from '../routes'

// The pages of the event a player is on: challenges, team, announcements
// (with the unread count), and the event's leaderboard.
export default function EventBar({ eventID }) {
  const { pathname } = useLocation()
  const [event, setEvent] = useState(null)
  const unread = useUnreadCount(eventID)

  useEffect(() => {
    let alive = true
    getEvent(eventID).then((e) => alive && setEvent(e), () => alive && setEvent(null))
    return () => {
      alive = false
    }
  }, [eventID])

  const isActive = (path) => pathname === path || (path === PATHS.board && pathname === PATHS.challenge)

  return (
    <div className="shrink-0 border-b-[0.5px] border-line bg-surface">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-medium">{event?.eventName ?? `Event ${eventID}`}</div>
          {event && <div className="text-[11px] text-fg-3">{eventPhase(event)}</div>}
        </div>
        <nav className="flex flex-wrap items-center gap-1" aria-label="Event">
          {EVENT_PAGES.map((p) => (
            <Link
              key={p.path}
              to={linkTo(p.path, { eventID })}
              aria-current={isActive(p.path) ? 'page' : undefined}
              className={`tab ${isActive(p.path) ? 'tab-active' : ''}`}
            >
              <i className={`ti ${p.icon} text-base`} aria-hidden="true" />
              {p.title}
              {p.path === PATHS.announcements && unread > 0 && (
                <span className="rounded-full bg-info-bg px-1.5 text-[11px] font-medium text-info-fg" aria-label={`${unread} unread`}>
                  {unread}
                </span>
              )}
            </Link>
          ))}
          <Link to={linkTo(PATHS.leaderboard, { eventID })} className="tab">
            <i className="ti ti-trophy text-base" aria-hidden="true" />
            Leaderboard
          </Link>
        </nav>
      </div>
    </div>
  )
}
