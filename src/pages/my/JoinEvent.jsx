import { useEffect, useState } from 'react'
import { events } from '../../api/lists'
import { joinEvent } from '../../api/player'
import ErrorBanner from '../../components/ErrorBanner'
import Field from '../../components/Field'
import { isYes } from '../../lib/codes'
import { formatRange } from '../../lib/timestamps'

// P2: join another event with its registration code
export default function JoinEvent({ joined, preselect, onJoined }) {
  const [open, setOpen] = useState(null) // events with registration open
  const [values, setValues] = useState({ eventID: preselect ?? '', regCode: '' })
  const [state, setState] = useState({ busy: false, error: null, done: null })

  useEffect(() => {
    let alive = true
    events.listAll().then(
      (rows) => alive && setOpen(rows.filter((e) => isYes(e.registrationOpen))),
      (error) => alive && setState((s) => ({ ...s, error })),
    )
    return () => {
      alive = false
    }
  }, [])

  const mine = new Set(joined.map((e) => String(e.eventID)))
  const choices = (open ?? []).filter((e) => !mine.has(String(e.eventID)))
  const selected = choices.some((e) => String(e.eventID) === String(values.eventID)) ? String(values.eventID) : ''
  const set = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    const name = choices.find((c) => String(c.eventID) === selected)?.eventName
    setState({ busy: true, error: null, done: null })
    try {
      const r = await joinEvent({ eventID: selected, regCode: values.regCode.trim() })
      setValues({ eventID: '', regCode: '' })
      setState({ busy: false, error: null, done: { name, pending: r.partStatus === 'P' } })
      onJoined()
    } catch (err) {
      setState({ busy: false, error: err, done: null })
    }
  }

  return (
    <section className="card flex flex-col gap-3 p-6">
      <h2 className="text-[15px] font-medium">Join another event</h2>
      {state.done && (
        <p role="status" className="rounded-md bg-success-bg px-3 py-2 text-[13px] text-success-fg">
          You joined {state.done.name}.{' '}
          {state.done.pending ? 'Your place waits for a RACF job; check again in a few minutes.' : ''}
        </p>
      )}
      {state.error && <ErrorBanner error={joinError(state.error)} />}
      {open && choices.length === 0 && (
        <p className="text-[13px] text-fg-2">No other event is open for registration right now.</p>
      )}
      {choices.length > 0 && (
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <div className="flex flex-col gap-1 text-[13px]">
            <label htmlFor="join-event">Event</label>
            <select id="join-event" name="eventID" className="input" value={selected} onChange={set} required>
              <option value="">Choose an event…</option>
              {choices.map((c) => (
                <option key={c.eventID} value={c.eventID}>
                  {c.eventName} ({formatRange(c.startTS, c.endTS)})
                </option>
              ))}
            </select>
          </div>
          <Field label="Registration code" name="regCode" id="join-code" value={values.regCode} onChange={set} required
            maxLength={32} autoComplete="off" spellCheck="false" />
          <button type="submit" className="btn-primary self-start" disabled={state.busy}>
            {state.busy ? 'Joining…' : 'Join'}
          </button>
        </form>
      )}
    </section>
  )
}

function joinError(err) {
  if (err.isRegistrationRefused) return 'That registration code is wrong, or registration has closed.'
  if (err.isFull) return 'This event is full.'
  if (err.is?.('08', '11')) return 'You are in this event already.'
  return err
}
