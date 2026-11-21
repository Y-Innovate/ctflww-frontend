import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { archiveEvent, closeEvent, createEvent, deleteEvent, getAdminEvent, refTables, restoreEvent, updateEvent } from '../../api/admin'
import ConfirmButton from '../../components/ConfirmButton'
import Announcements from './event/Announcements'
import ErrorBanner from '../../components/ErrorBanner'
import { useFullList } from '../../hooks/useFullList'
import { isArchived, isReadOnly } from '../../lib/codes'
import { formatTs } from '../../lib/timestamps'
import { ADMIN_PATHS, linkTo, PATHS } from '../../routes'
import EventChallenges from './event/EventChallenges'
import EventForm from './event/EventForm'
import Monitor from './event/Monitor'
import Teams from './event/Teams'
import StatusBadge from './StatusBadge'

// The tabs of an event
const TABS = [
  { id: 'settings', title: 'Settings' },
  { id: 'challenges', title: 'Challenges' },
  { id: 'monitor', title: 'Monitor' },
  { id: 'teams', title: 'Teams' },
  { id: 'announcements', title: 'Announcements' },
]

// The allowed RACF groups, for the form
function useGroups() {
  return useFullList(refTables, { tableID_filter: 'RACFGRP' }).rows
}

// A1 (and A3 in the Challenges tab): one event, or a new draft without eventID
export default function AdminEvent() {
  const [params] = useSearchParams()
  const eventID = params.get('eventID')
  if (!eventID) return <NewEvent />
  return <EventPage key={eventID} eventID={eventID} tab={params.get('tab') || 'settings'} />
}

function NewEvent() {
  const navigate = useNavigate()
  const groups = useGroups()
  return (
    <section className="flex flex-col gap-4">
      <Link className="text-[13px] text-fg-2 underline" to={ADMIN_PATHS.events}>All events</Link>
      <h1 className="text-[17px] font-medium">New event</h1>
      <p className="text-[13px] text-fg-2">
        A new event is a draft: only organizers see it. Add challenges, then publish it.
      </p>
      <EventForm event={null} groups={groups} submitLabel="Create draft"
        onSubmit={async (values) => {
          const created = await createEvent(values)
          navigate(linkTo(ADMIN_PATHS.event, { eventID: created.eventID }), { replace: true })
        }} />
    </section>
  )
}

// GET /admin/events/{id}; reload() keeps the old one on screen until the new one is in
function useAdminEvent(eventID) {
  const [state, setState] = useState({ event: null, error: null })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let alive = true
    getAdminEvent(eventID).then(
      (event) => alive && setState({ event, error: null }),
      (error) => alive && setState({ event: null, error }),
    )
    return () => {
      alive = false
    }
  }, [eventID, version])
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}

function EventPage({ eventID, tab }) {
  const { event, error, reload } = useAdminEvent(eventID)
  const groups = useGroups()
  const back = <Link className="text-[13px] text-fg-2 underline" to={ADMIN_PATHS.events}>All events</Link>

  if (error) {
    return (
      <section className="flex flex-col gap-4">
        {back}
        {error.isNotFound ? <p className="card p-6 text-fg-2">This event doesn&apos;t exist (any more).</p> : <ErrorBanner error={error} />}
      </section>
    )
  }
  if (!event) return back

  return (
    <section className="flex flex-col gap-4">
      {back}
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-[19px] font-medium">{event.eventName}</h1>
        <StatusBadge event={event} />
        <span className="text-[12px] text-fg-3">Event {event.eventID} · {event.playerCount} of {event.maxPlayers} players</span>
        {event.eventStatus !== 'D' && (
          <Link className="ml-auto text-[13px] text-fg-2 underline" to={linkTo(PATHS.events, { eventID: event.eventID })}>
            Public page
          </Link>
        )}
      </header>
      <nav className="flex gap-1 border-b-[0.5px] border-line" aria-label="Event tabs">
        {TABS.map((t) => (
          <Link key={t.id} to={linkTo(ADMIN_PATHS.event, { eventID, tab: t.id === 'settings' ? undefined : t.id })}
            aria-current={tab === t.id ? 'page' : undefined}
            className={`-mb-px border-b-2 px-3 py-2 text-[13px] ${tab === t.id ? 'border-fg font-medium' : 'border-transparent text-fg-2 hover:text-fg'}`}>
            {t.title}
          </Link>
        ))}
      </nav>
      {tab === 'challenges' && <EventChallenges event={event} />}
      {tab === 'monitor' && <Monitor event={event} />}
      {tab === 'teams' && <Teams event={event} />}
      {tab === 'announcements' && <Announcements event={event} />}
      {!['challenges', 'monitor', 'teams', 'announcements'].includes(tab) && (
        <>
          {event.eventStatus === 'C' && (
            <p className="rounded-md bg-surface-2 px-4 py-2.5 text-[13px] text-fg-2">
              This event is closed: nothing about it can change any more. Its offboarding jobs are queued for,
              or done by, the batch.
            </p>
          )}
          {isArchived(event) && (
            <p className="rounded-md bg-surface-2 px-4 py-2.5 text-[13px] text-fg-2">
              This event is archived: it is read-only, and left out of the public event list and the
              current admin list. Its public page and leaderboard can still be opened, also from the archive.
            </p>
          )}
          <EventForm event={event} groups={groups} locked={event.playerCount > 0}
            readOnly={isReadOnly(event)} submitLabel="Save"
            onSubmit={async (values) => {
              await updateEvent(eventID, values)
              reload()
            }} />
          <EventActions event={event} onChange={reload} />
        </>
      )}
    </section>
  )
}

// Publish, back to draft, delete, close, archive, restore: on the saved event,
// not on unsaved changes
function EventActions({ event, onChange }) {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  async function setStatus(eventStatus) {
    setError(null)
    try {
      await updateEvent(event.eventID, { ...event, eventStatus })
      onChange()
    } catch (err) {
      setError(err)
    }
  }

  async function close() {
    setError(null)
    try {
      await closeEvent(event.eventID)
      onChange()
    } catch (err) {
      setError(err)
    }
  }

  async function archive(restore) {
    setError(null)
    try {
      await (restore ? restoreEvent : archiveEvent)(event.eventID)
      onChange()
    } catch (err) {
      setError(err)
    }
  }

  async function remove() {
    setError(null)
    try {
      await deleteEvent(event.eventID)
      navigate(ADMIN_PATHS.events, { replace: true })
    } catch (err) {
      setError(err)
    }
  }

  const draft = event.eventStatus === 'D'
  return (
    <section className="card flex flex-col gap-3 p-6" aria-labelledby="actions-title">
      <h2 id="actions-title" className="text-[15px] font-medium">Status</h2>
      {error && <ErrorBanner error={error.isWrongState && error.infoMessage ? `${error.infoMessage}.` : error} />}
      {isReadOnly(event) ? (
        <ArchiveActions event={event} onArchive={archive} />
      ) : draft ? (
        <>
          <p className="text-[13px] text-fg-2">
            A draft is only visible to organizers. Publishing needs at least one visible challenge; save your
            changes above first.
          </p>
          <div className="flex flex-wrap gap-2">
            <ConfirmButton label="Publish" icon="ti-world-upload" confirmLabel="Publish"
              question="Publish this event? It shows on the public list, and registration opens at its time."
              onConfirm={() => setStatus('P')} />
            <ConfirmButton label="Delete draft" icon="ti-trash" danger confirmLabel="Delete"
              question="Delete this draft, with its challenges, prerequisites and announcements?"
              onConfirm={remove} />
          </div>
        </>
      ) : (
        <>
          <p className="text-[13px] text-fg-2">
            Published: players see the event{event.playerCount > 0 ? ', and some have joined, so it stays published' : ''}.
          </p>
          {event.playerCount === 0 && (
            <div>
              <ConfirmButton label="Back to draft" icon="ti-arrow-back-up" confirmLabel="Back to draft"
                question="Take the event off the public list?" onConfirm={() => setStatus('D')} />
            </div>
          )}
          {event.phase === 'E' ? (
            <div className="flex flex-col gap-2 border-t-[0.5px] border-line pt-3">
              <p className="text-[13px] text-fg-2">
                The event has ended. Closing makes it read-only and queues its offboarding for the batch:
                {event.racfGroup ? ` players are removed from RACF group ${event.racfGroup}, and` : ''} players
                without a place in another open event are revoked. The leaderboard stays public.
              </p>
              <div>
                <ConfirmButton label="Close event" icon="ti-lock" danger confirmLabel="Close and offboard"
                  question="Close this event and queue the offboarding? This can't be undone."
                  onConfirm={close} />
              </div>
            </div>
          ) : (
            <p className="text-[12px] text-fg-3">It can be closed after its end, {formatTs(event.endTS)}.</p>
          )}
        </>
      )}
    </section>
  )
}

// A10: a closed event can be archived, an archived one restored to closed
function ArchiveActions({ event, onArchive }) {
  if (isArchived(event)) {
    return (
      <>
        <p className="text-[13px] text-fg-2">
          Archived. Restoring makes it closed again: back on the public event list and the current admin list.
        </p>
        <div>
          <ConfirmButton label="Restore" icon="ti-archive-off" confirmLabel="Restore"
            question="Restore this event to closed?" onConfirm={() => onArchive(true)} />
        </div>
      </>
    )
  }
  return (
    <>
      <p className="text-[13px] text-fg-2">
        Closed. Archiving takes the event off the public event list and the current admin list; it stays
        read-only, and its page and leaderboard stay viewable from the archive. It can be restored.
      </p>
      <div>
        <ConfirmButton label="Archive" icon="ti-archive" confirmLabel="Archive"
          question="Archive this event?" onConfirm={() => onArchive(false)} />
      </div>
    </>
  )
}
