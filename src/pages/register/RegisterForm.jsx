import { useState } from 'react'
import { Link } from 'react-router'
import { register } from '../../api/registration'
import ErrorBanner from '../../components/ErrorBanner'
import Field from '../../components/Field'
import { useEvent } from '../../hooks/useEvent'
import { isYes } from '../../lib/codes'
import { linkTo, PATHS } from '../../routes'

// R1: event code and display name
export default function RegisterForm({ eventID, onRegistered }) {
  const { event, error: eventError } = useEvent(eventID)
  const [values, setValues] = useState({ regCode: '', displayName: '' })
  const [state, setState] = useState({ busy: false, error: null, nameTaken: false })

  const set = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setState({ busy: true, error: null, nameTaken: false })
    try {
      const r = await register({ eventID, regCode: values.regCode.trim(), displayName: values.displayName.trim() })
      onRegistered(r)
    } catch (err) {
      setState({ busy: false, error: err.is?.('08', '11') ? null : err, nameTaken: err.is?.('08', '11') })
    }
  }

  if (eventError) {
    return (
      <p className="card p-6 text-fg-2">
        {eventError.isNotFound ? 'This event doesn’t exist, or isn’t published yet.' : eventError.message}{' '}
        <Link className="underline" to={PATHS.events}>See the events</Link>.
      </p>
    )
  }
  if (!event) return null
  if (!isYes(event.registrationOpen)) {
    return (
      <p className="card p-6 text-fg-2">
        Registration for {event.eventName} is closed.{' '}
        <Link className="underline" to={linkTo(PATHS.events, { eventID })}>Back to the event</Link>.
      </p>
    )
  }

  return (
    <section className="card mx-auto w-full max-w-md p-6">
      <h1 className="text-[17px] font-medium">Register for {event.eventName}</h1>
      <p className="mt-1 text-[13px] text-fg-2">
        You get a userid on the mainframe and a place in this event. The organizers gave you the registration code.
      </p>
      <form className="mt-4 flex flex-col gap-3" onSubmit={submit}>
        {state.error && <ErrorBanner error={registerError(state.error)} />}
        <Field label="Registration code" name="regCode" value={values.regCode} onChange={set} required maxLength={32}
          autoComplete="off" spellCheck="false" />
        <Field label="Display name" name="displayName" value={values.displayName} onChange={set} required maxLength={30}
          autoComplete="nickname" hint="Shown on the leaderboard. Pick one that doesn't give away who you are, if you prefer."
          error={state.nameTaken ? 'This name is taken. Pick another one.' : null} />
        <button type="submit" className="btn-primary justify-center" disabled={state.busy}>
          {state.busy ? 'Registering…' : 'Register'}
        </button>
      </form>
    </section>
  )
}

function registerError(err) {
  if (err.isRegistrationRefused) return 'That registration code is wrong, or registration has closed.'
  if (err.isFull) return 'This event is full.'
  return err
}
