import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import BlockedNote from '../components/BlockedNote'
import ErrorBanner from '../components/ErrorBanner'
import { useSession } from '../context/SessionContext'
import { useEvent } from '../hooks/useEvent'
import { useMyPlace } from '../hooks/useMyPlace'
import { whyBlocked } from '../lib/play'
import { PATHS } from '../routes'
import NoTeam from './team/NoTeam'
import TeamOverview from './team/TeamOverview'

// T1 to T4 and P8: form a team, or see the team and the own progress
export default function Team() {
  const [params] = useSearchParams()
  const eventID = params.get('eventID')
  if (!eventID) {
    return (
      <p className="card p-6 text-fg-2">
        Pick an event first. <Link className="underline" to={PATHS.my}>See your events</Link>.
      </p>
    )
  }
  return <TeamPage key={eventID} eventID={eventID} />
}

// After a change (team created, joined, left) everything is loaded again
function TeamPage({ eventID }) {
  const [version, setVersion] = useState(0)
  return <TeamContent key={version} eventID={eventID} onChange={() => setVersion((v) => v + 1)} />
}

function TeamContent({ eventID, onChange }) {
  const { user } = useSession()
  const { event, error } = useEvent(eventID)
  const place = useMyPlace(eventID, true)

  let body = null
  if (error) {
    body = error.isNotFound
      ? <p className="card p-6 text-fg-2">This event doesn&apos;t exist, or isn&apos;t published yet.</p>
      : <ErrorBanner error={error} />
  } else if (event && place !== undefined) {
    const reason = whyBlocked(event, place)
    if (reason === 'notJoined' || reason === 'pending') {
      body = <BlockedNote reason={reason} event={event} eventID={eventID} />
    } else if (reason === 'noTeam') {
      body = <NoTeam eventID={eventID} event={event} onDone={onChange} />
    } else {
      body = <TeamOverview eventID={eventID} event={event} myPlayerID={user?.playerID} onChange={onChange} />
    }
  }

  return <section className="flex flex-col gap-4">{body}</section>
}
