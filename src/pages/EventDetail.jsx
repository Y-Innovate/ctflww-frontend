import { Link } from 'react-router'
import { signInHref } from '../api/auth'
import { BASE } from '../api/client'
import ErrorBanner from '../components/ErrorBanner'
import PhaseBadge from '../components/PhaseBadge'
import { useSession } from '../context/SessionContext'
import { useEvent } from '../hooks/useEvent'
import { useMyPlace } from '../hooks/useMyPlace'
import { isArchived, isReadOnly, isYes } from '../lib/codes'
import { formatRange, formatTs, isBlank } from '../lib/timestamps'
import { linkTo, PATHS } from '../routes'

function playModeText(e) {
  return e.playMode === 'T' ? `Teams of up to ${e.maxTeamSize}` : 'Individual'
}

function freezeText(e) {
  if (isBlank(e.freezeTS)) return null
  return e.phase === 'F' || isReadOnly(e) ? `Frozen since ${formatTs(e.freezeTS)}` : `Freezes at ${formatTs(e.freezeTS)}`
}

// V1: one event, with what the reader can do next
export default function EventDetail({ eventID }) {
  const { isPlayer, loading: sessionLoading } = useSession()
  const state = useEvent(eventID)
  const place = useMyPlace(eventID, isPlayer)

  const archived = state.event && isArchived(state.event)
  const back = archived
    ? <Link className="text-[13px] text-fg-2 underline" to={linkTo(PATHS.events, { archive: 1 })}>All archived events</Link>
    : <Link className="text-[13px] text-fg-2 underline" to={PATHS.events}>All events</Link>

  if (state.loading) return back
  if (state.error) {
    return (
      <section className="flex flex-col gap-4">
        {back}
        {state.error.isNotFound
          ? <p className="card p-6 text-fg-2">This event doesn&apos;t exist, or isn&apos;t published yet.</p>
          : <ErrorBanner error={state.error} />}
      </section>
    )
  }

  const e = state.event
  const open = isYes(e.registrationOpen)
  const facts = [
    ['When', formatRange(e.startTS, e.endTS)],
    ['Play', playModeText(e)],
    ['Registration', `${formatRange(e.regFromTS, e.regToTS)}${open ? ' (open now)' : ''}`],
    ['Scoreboard', freezeText(e)],
  ].filter(([, v]) => v)

  return (
    <section className="flex flex-col gap-4">
      {back}
      <article className="card flex flex-col gap-4 p-6">
        <header className="flex flex-wrap items-center gap-2">
          <h1 className="text-[19px] font-medium">{e.eventName}</h1>
          <PhaseBadge event={e} />
        </header>
        {e.eventDescription && <p className="whitespace-pre-line text-fg-2">{e.eventDescription}</p>}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-fg-3">{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
        <div className="flex flex-wrap items-center gap-2">
          <Link className="btn-secondary" to={linkTo(PATHS.leaderboard, { eventID: e.eventID })}>
            <i className="ti ti-trophy" aria-hidden="true" />
            Leaderboard
          </Link>
          {!sessionLoading && <NextStep event={e} open={open} isPlayer={isPlayer} place={place} />}
        </div>
      </article>
    </section>
  )
}

// Register, join, or play: depends on who reads and on the registration
function NextStep({ event, open, isPlayer, place }) {
  const { user } = useSession()
  if (isPlayer) {
    if (place === undefined) return null
    if (place) {
      if (place.partStatus === 'P') {
        return <span className="text-[13px] text-fg-2">You&apos;re in. Your place waits for its RACF job; try again in a few minutes.</span>
      }
      return (
        <Link className="btn-primary" to={linkTo(PATHS.board, { eventID: event.eventID })}>
          <i className="ti ti-flag" aria-hidden="true" />
          Go to the challenges
        </Link>
      )
    }
    if (!open) return <span className="text-[13px] text-fg-2">Registration is closed.</span>
    return (
      <Link className="btn-primary" to={linkTo(PATHS.my, { join: event.eventID })}>
        Join this event
      </Link>
    )
  }
  if (user) return null // organizers neither register nor join
  if (!open) return <span className="text-[13px] text-fg-2">Registration is closed.</span>
  return (
    <>
      <Link className="btn-primary" to={linkTo(PATHS.register, { eventID: event.eventID })}>
        Register
      </Link>
      <a className="text-[13px] text-fg-2 underline" href={signInHref(`${BASE}${linkTo('', { eventID: event.eventID })}`)}>
        I have a userid already
      </a>
    </>
  )
}
