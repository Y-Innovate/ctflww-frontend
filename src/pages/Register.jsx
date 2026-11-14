import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useSession } from '../context/SessionContext'
import { linkTo, PATHS } from '../routes'
import Account from './register/Account'
import RegisterForm from './register/RegisterForm'

// R1 to R3 on one page. ?eventID= shows the form; after registering the URL
// becomes ?registrationID=, so a reload or a later visit continues there.
// The claim token lives in this component's state only: never in the URL or
// the browser's storage.
export default function Register() {
  const [params, setParams] = useSearchParams()
  const { isPlayer } = useSession()
  const [claimToken, setClaimToken] = useState('')
  const registrationID = params.get('registrationID')
  const eventID = params.get('eventID')

  if (registrationID) return <Account key={registrationID} registrationID={registrationID} claimToken={claimToken} />

  if (!eventID) {
    return (
      <p className="card p-6 text-fg-2">
        Pick an event to register for. <Link className="underline" to={PATHS.events}>See the events</Link>.
      </p>
    )
  }
  if (isPlayer) {
    return (
      <p className="card p-6 text-fg-2">
        You have a userid already, so you don&apos;t need to register again.{' '}
        <Link className="underline" to={linkTo(PATHS.my, { join: eventID })}>Join this event</Link> with its code instead.
      </p>
    )
  }
  return (
    <RegisterForm
      eventID={eventID}
      onRegistered={(r) => {
        setClaimToken(r.claimToken)
        setParams({ registrationID: String(r.registrationID) }, { replace: true })
      }}
    />
  )
}
