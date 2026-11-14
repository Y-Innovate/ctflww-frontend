import { Link } from 'react-router'
import { formatTs } from '../lib/timestamps'
import { linkTo, PATHS } from '../routes'

// The message for a reason of whyBlocked() (src/lib/play.js)
export default function BlockedNote({ reason, event, eventID }) {
  let text
  switch (reason) {
    case 'notJoined':
      text = (
        <>
          You haven&apos;t joined this event.{' '}
          <Link className="underline" to={linkTo(PATHS.events, { eventID })}>See the event</Link>.
        </>
      )
      break
    case 'pending':
      text = 'Your place in this event waits for its RACF job; check again in a few minutes.'
      break
    case 'noTeam':
      text = (
        <>
          You need a team to play.{' '}
          <Link className="underline" to={linkTo(PATHS.team, { eventID })}>Create or join one</Link>.
        </>
      )
      break
    case 'notStarted':
      text = `The event starts at ${formatTs(event.startTS)}. The challenges show from then on.`
      break
    default:
      return null
  }
  return <p className="card p-6 text-fg-2">{text}</p>
}
