import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getChallenge } from '../api/challenges'
import { challengeLinks } from '../api/lists'
import BlockedNote from '../components/BlockedNote'
import ErrorBanner from '../components/ErrorBanner'
import { useEvent } from '../hooks/useEvent'
import { useFullList } from '../hooks/useFullList'
import { useMyPlace } from '../hooks/useMyPlace'
import { attemptsText, isYes } from '../lib/codes'
import { isWebUrl, whyBlocked } from '../lib/play'
import { linkTo, PATHS } from '../routes'
import FlagForm from './challenge/FlagForm'
import Hints from './challenge/Hints'
import LockedChallenge from './challenge/LockedChallenge'

// P5 to P7: one challenge with its links and hints, and the flag form; a
// locked one shows what it requires.
export default function Challenge() {
  const [params] = useSearchParams()
  const eventID = params.get('eventID')
  const challengeID = params.get('challengeID')
  if (!eventID || !challengeID) {
    return (
      <p className="card p-6 text-fg-2">
        Pick a challenge first.{' '}
        <Link className="underline" to={eventID ? linkTo(PATHS.board, { eventID }) : PATHS.my}>
          {eventID ? 'See the challenges' : 'See your events'}
        </Link>.
      </p>
    )
  }
  return <ChallengePage key={`${eventID}/${challengeID}`} eventID={eventID} challengeID={challengeID} />
}

// GET /challenges/{id}; reload() keeps the old one on screen until the new one is in
function useChallenge(eventID, challengeID, enabled) {
  const [state, setState] = useState({ challenge: null, error: null })
  const [version, setVersion] = useState(0)

  useEffect(() => {
    if (!enabled) return undefined
    let alive = true
    getChallenge(eventID, challengeID).then(
      (challenge) => alive && setState({ challenge, error: null }),
      (error) => alive && setState({ challenge: null, error }),
    )
    return () => {
      alive = false
    }
  }, [eventID, challengeID, enabled, version])

  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}

function ChallengePage({ eventID, challengeID }) {
  const { event, error: eventError } = useEvent(eventID)
  const place = useMyPlace(eventID, true)
  const known = Boolean(event) && place !== undefined
  const blocked = known ? whyBlocked(event, place) : null
  const ch = useChallenge(eventID, challengeID, known && !blocked)

  let body = null
  if (eventError) {
    body = eventError.isNotFound
      ? <p className="card p-6 text-fg-2">This event doesn&apos;t exist, or isn&apos;t published yet.</p>
      : <ErrorBanner error={eventError} />
  } else if (blocked) {
    body = <BlockedNote reason={blocked} event={event} eventID={eventID} />
  } else if (ch.error?.isNotAllowed) {
    // The place is fine (checked above), so 08 50 means locked
    body = <LockedChallenge eventID={eventID} challengeID={challengeID} playMode={event.playMode} />
  } else if (ch.error?.isNotFound) {
    body = <p className="card p-6 text-fg-2">This challenge isn&apos;t part of this event.</p>
  } else if (ch.error?.isWrongState) {
    body = <p className="card p-6 text-fg-2">This event hasn&apos;t started yet.</p>
  } else if (ch.error) {
    body = <ErrorBanner error={ch.error} onRetry={ch.reload} />
  } else if (ch.challenge) {
    body = <ChallengeDetails eventID={eventID} event={event} challenge={ch.challenge} onChange={ch.reload} />
  }

  return (
    <section className="flex flex-col gap-4">
      <Link className="text-[13px] text-fg-2 underline" to={linkTo(PATHS.board, { eventID })}>
        All challenges
      </Link>
      {body}
    </section>
  )
}

function ChallengeDetails({ eventID, event, challenge: c, onChange }) {
  const solved = isYes(c.isSolved)
  const facts = [
    ['Value', `${c.currentPoints} points`],
    ['Solves', String(c.solveCount)],
    ['Attempts', solved ? null : attemptsText(c.attemptsLeft)],
  ].filter(([, v]) => v)

  return (
    <>
      <article className="card flex flex-col gap-4 p-6">
        <header className="flex flex-col gap-1">
          <div className="text-[12px] uppercase tracking-wide text-fg-3">{c.categoryName || c.category}</div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[19px] font-medium">{c.challengeTitle}</h1>
            {solved && (
              <span className="inline-flex items-center gap-1 rounded-full bg-success-bg px-2 py-0.5 text-[11px] font-medium text-success-fg">
                <i className="ti ti-check" aria-hidden="true" />
                Solved
              </span>
            )}
          </div>
        </header>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-[13px]">
          {facts.map(([k, v]) => (
            <div key={k} className="contents">
              <dt className="text-fg-3">{k}</dt>
              <dd className="tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {c.challengeDescription && <p className="whitespace-pre-line">{c.challengeDescription}</p>}
        <Links eventID={eventID} challengeID={c.challengeID} />
      </article>
      <Hints eventID={eventID} challengeID={c.challengeID} event={event} />
      <FlagForm eventID={eventID} event={event} challenge={c} onChange={onChange} />
    </>
  )
}

function Links({ eventID, challengeID }) {
  const list = useFullList(challengeLinks, { eventID, challengeID })
  if (list.error) return <ErrorBanner error={list.error} onRetry={list.reload} />
  if (list.rows.length === 0) return null
  return (
    <div className="flex flex-col gap-1 text-[13px]">
      <h2 className="font-medium">Links</h2>
      <ul className="flex flex-col gap-1">
        {list.rows.map((l) => (
          <li key={l.linkID}>
            {isWebUrl(l.linkUrl) ? (
              <a className="inline-flex items-center gap-1 underline" href={l.linkUrl.trim()} target="_blank" rel="noopener noreferrer">
                {l.linkName || l.linkUrl}
                <i className="ti ti-external-link" aria-hidden="true" />
              </a>
            ) : (
              <span>{l.linkName ? `${l.linkName}: ` : ''}{l.linkUrl}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
