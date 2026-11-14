import { useState } from 'react'
import { createTeam, joinTeam } from '../../api/team'
import ErrorBanner from '../../components/ErrorBanner'
import Field from '../../components/Field'
import { isYes } from '../../lib/codes'
import { formatTs } from '../../lib/timestamps'

// T1 and T2: a player in a team event without a team creates one or joins
// one. Both only while registration is open.
export default function NoTeam({ eventID, event, onDone }) {
  const title = <h1 className="text-[17px] font-medium">Find a team</h1>
  if (!isYes(event.registrationOpen)) {
    return (
      <>
        {title}
        <p className="card p-6 text-fg-2">
          You have no team in this event, and teams can only be formed while registration is open
          (until {formatTs(event.regToTS)}). Ask the organizers for help.
        </p>
      </>
    )
  }
  return (
    <>
      {title}
      <p className="text-[13px] text-fg-2">
        You need a team to play: create one and share its join code, or join one with the code its
        captain gives you. Teams have up to {event.maxTeamSize} players.
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <TeamForm
          title="Create a team"
          field={{ label: 'Team name', name: 'teamName', maxLength: 30, hint: 'Up to 30 characters, unique in this event' }}
          button="Create team"
          busyText="Creating…"
          send={(teamName) => createTeam({ eventID, teamName })}
          errorText={createErrorText}
          onDone={onDone}
        />
        <TeamForm
          title="Join a team"
          field={{ label: 'Join code', name: 'joinCode', maxLength: 12, autoComplete: 'off', spellCheck: false }}
          button="Join team"
          busyText="Joining…"
          send={(joinCode) => joinTeam({ eventID, joinCode })}
          errorText={joinErrorText}
          onDone={onDone}
        />
      </div>
    </>
  )
}

function TeamForm({ title, field, button, busyText, send, errorText, onDone }) {
  const [value, setValue] = useState('')
  const [state, setState] = useState({ busy: false, error: null })

  async function submit(e) {
    e.preventDefault()
    const text = value.trim()
    if (!text) return
    setState({ busy: true, error: null })
    try {
      await send(text)
      onDone()
    } catch (err) {
      setState({ busy: false, error: errorText(err) })
    }
  }

  return (
    <form className="card flex flex-col gap-3 p-6" onSubmit={submit}>
      <h2 className="text-[15px] font-medium">{title}</h2>
      {state.error && <ErrorBanner error={state.error} />}
      <Field {...field} value={value} onChange={(e) => setValue(e.target.value)} />
      <button type="submit" className="btn-primary self-start" disabled={state.busy || !value.trim()}>
        {state.busy ? busyText : button}
      </button>
    </form>
  )
}

function createErrorText(err) {
  if (err.is('08', '11')) return 'This team name is taken in this event; pick another.'
  if (err.isWrongState) return `This isn't possible now: ${err.infoMessage || 'registration is closed'}.`
  return err
}

function joinErrorText(err) {
  if (err.isNotFound) return 'There is no team with this join code in this event.'
  if (err.isFull) return 'This team is full.'
  if (err.isWrongState) return `This isn't possible now: ${err.infoMessage || 'registration is closed'}.`
  return err
}
