import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { announcements, PAGE_SIZE } from '../api/lists'
import BlockedNote from '../components/BlockedNote'
import ErrorBanner from '../components/ErrorBanner'
import LoadMore from '../components/LoadMore'
import { useEvent } from '../hooks/useEvent'
import { useMyPlace } from '../hooks/useMyPlace'
import { usePagedList } from '../hooks/usePagedList'
import { usePolling } from '../hooks/usePolling'
import { POLL_MS } from '../hooks/useUnreadCount'
import { markSeen, seenIds } from '../lib/seen'
import { formatTs } from '../lib/timestamps'
import { PATHS } from '../routes'

// P9: the organizers' announcements, newest first, polled every minute.
// "New" is what this browser hadn't seen when the page opened, or what
// arrived since; everything on screen is marked as seen.
export default function Announcements() {
  const [params] = useSearchParams()
  const eventID = params.get('eventID')
  if (!eventID) {
    return (
      <p className="card p-6 text-fg-2">
        Pick an event first. <Link className="underline" to={PATHS.my}>See your events</Link>.
      </p>
    )
  }
  return <AnnouncementList key={eventID} eventID={eventID} />
}

function AnnouncementList({ eventID }) {
  const { event, error: eventError } = useEvent(eventID)
  const place = useMyPlace(eventID, true)
  // Announcements need an active place, not a team
  const blocked = place === null ? 'notJoined' : place?.partStatus === 'P' ? 'pending' : null
  const ready = place !== undefined && !blocked
  const list = usePagedList(announcements, { eventID }, { enabled: ready })
  const [seenAtOpen] = useState(() => seenIds(eventID))

  // Refresh the newest page, unless older pages are open: that would close them
  usePolling(() => {
    if (!list.loading && list.rows.length <= PAGE_SIZE) list.reload()
  }, POLL_MS, ready)

  useEffect(() => {
    if (list.rows.length > 0) markSeen(eventID, list.rows.map((a) => a.announceID))
  }, [eventID, list.rows])

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-[17px] font-medium">Announcements</h1>
      {eventError && (eventError.isNotFound
        ? <p className="card p-6 text-fg-2">This event doesn&apos;t exist, or isn&apos;t published yet.</p>
        : <ErrorBanner error={eventError} />)}
      {!eventError && blocked && <BlockedNote reason={blocked} event={event} eventID={eventID} />}
      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {ready && !list.loading && !list.error && list.rows.length === 0 && (
        <p className="card p-6 text-fg-2">No announcements yet. New ones show here by themselves.</p>
      )}
      <ul className="flex flex-col gap-3">
        {list.rows.map((a) => {
          const isNew = !seenAtOpen.has(a.announceID)
          return (
            <li key={a.announceID}>
              <article className={`card flex flex-col gap-1.5 p-5 ${isNew ? 'border-info-fg/50' : ''}`}>
                <header className="flex flex-wrap items-baseline gap-2">
                  <h2 className="text-[15px] font-medium">{a.announceTitle}</h2>
                  {isNew && (
                    <span className="rounded-full bg-info-bg px-1.5 text-[11px] font-medium text-info-fg">New</span>
                  )}
                  <span className="ml-auto text-[12px] text-fg-3">{formatTs(a.createdDate)}</span>
                </header>
                {a.announceBody && <p className="whitespace-pre-line text-[13px] text-fg-2">{a.announceBody}</p>}
              </article>
            </li>
          )
        })}
      </ul>
      <LoadMore list={list} label="Older" />
    </section>
  )
}
