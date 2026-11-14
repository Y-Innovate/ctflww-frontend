import { useState } from 'react'
import ErrorBanner from '../../../components/ErrorBanner'
import Field from '../../../components/Field'
import { fromInputValue, toInputValue } from '../../../lib/timestamps'

const DATES = [
  ['startTS', 'Start'],
  ['freezeTS', 'Freeze (optional)'],
  ['endTS', 'End'],
  ['regFromTS', 'Registration opens'],
  ['regToTS', 'Registration closes'],
]

// Registration codes must be long: there is no rate limit (PLAN.md)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function newRegCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  const chars = [...bytes].map((b) => CODE_CHARS[b % CODE_CHARS.length]).join('')
  return chars.match(/.{4}/g).join('-')
}

function toValues(e) {
  return {
    eventName: e?.eventName ?? '',
    eventDescription: e?.eventDescription ?? '',
    playMode: e?.playMode || 'T',
    maxTeamSize: String(e?.maxTeamSize ?? 4),
    maxPlayers: String(e?.maxPlayers ?? 100),
    regCode: e?.regCode ?? '',
    racfGroup: e?.racfGroup ?? '',
    ...Object.fromEntries(DATES.map(([k]) => [k, toInputValue(e?.[k])])),
  }
}

// What the form sends: DB2 timestamps, numbers, team size 1 when individual
function toEvent(v, eventStatus) {
  return {
    ...v,
    eventStatus,
    eventName: v.eventName.trim(),
    eventDescription: v.eventDescription.trim(),
    regCode: v.regCode.trim(),
    maxTeamSize: v.playMode === 'I' ? 1 : Number(v.maxTeamSize),
    maxPlayers: Number(v.maxPlayers),
    ...Object.fromEntries(DATES.map(([k]) => [k, fromInputValue(v[k])])),
  }
}

// The checks of CTFM002 (R020, R021), for quick feedback; the backend decides
function eventProblems(v) {
  const p = {}
  if (!v.eventName.trim()) p.eventName = 'A name is required'
  else if (v.eventName.trim().length > 100) p.eventName = 'Up to 100 characters'
  if (v.eventDescription.trim().length > 1000) p.eventDescription = 'Up to 1000 characters'
  if (!v.regCode.trim()) p.regCode = 'A registration code is required'
  else if (v.regCode.trim().length > 32) p.regCode = 'Up to 32 characters'
  if (v.playMode === 'T' && !(Number(v.maxTeamSize) >= 2)) p.maxTeamSize = 'A team has 2 players or more'
  if (!(Number(v.maxPlayers) >= 1)) p.maxPlayers = '1 or more'
  for (const k of ['startTS', 'endTS', 'regFromTS', 'regToTS']) if (!v[k]) p[k] = 'Required'
  if (v.startTS && v.endTS && !(v.startTS < v.endTS)) p.endTS = 'After the start'
  if (v.freezeTS && v.startTS && v.endTS && !(v.freezeTS > v.startTS && v.freezeTS < v.endTS)) {
    p.freezeTS = 'Between the start and the end'
  }
  if (v.regFromTS && v.regToTS && !(v.regFromTS < v.regToTS)) p.regToTS = 'After the registration opens'
  return p
}

// A1: the settings of an event. event: null for a new draft. locked: players
// have joined, so play mode and RACF group stay. readOnly: a closed event.
export default function EventForm({ event, groups, locked = false, readOnly = false, submitLabel, onSubmit }) {
  const [values, setValues] = useState(() => toValues(event))
  const [submitted, setSubmitted] = useState(false)
  const [state, setState] = useState({ busy: false, error: null, saved: false })
  const problems = eventProblems(values)
  const show = (k) => (submitted ? problems[k] : null)
  const set = (k) => (e) => {
    setValues((v) => ({ ...v, [k]: e.target.value }))
    setState((s) => ({ ...s, saved: false }))
  }

  async function submit(e) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(problems).length > 0) return
    setState({ busy: true, error: null, saved: false })
    try {
      await onSubmit(toEvent(values, event?.eventStatus || 'D'))
      setState({ busy: false, error: null, saved: true })
    } catch (err) {
      setState({ busy: false, error: err, saved: false })
    }
  }

  // The group list, plus the event's own group if it left the list since
  const groupKeys = groups.map((g) => g.tabKey)
  const groupOptions = values.racfGroup && !groupKeys.includes(values.racfGroup)
    ? [...groups, { tabKey: values.racfGroup, tabValue: '(no longer in the list)' }]
    : groups

  return (
    <form className="card flex flex-col gap-5 p-6" onSubmit={submit} aria-label="Event settings" noValidate>
      {state.error && <ErrorBanner error={state.error} />}
      {state.saved && <p role="status" className="rounded-md bg-success-bg px-4 py-2.5 text-[13px] text-success-fg">Saved.</p>}
      <fieldset disabled={readOnly || state.busy} className="flex flex-col gap-5">
        <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
          <Field label="Name" name="eventName" value={values.eventName} maxLength={100}
            error={show('eventName')} onChange={set('eventName')} />
          <div className="flex flex-col gap-1 text-[13px]">
            <label htmlFor="regCode">Registration code</label>
            <div className="flex gap-2">
              <input id="regCode" name="regCode" className="input min-w-0 flex-1 font-mono" value={values.regCode}
                maxLength={32} autoComplete="off" spellCheck={false} aria-invalid={show('regCode') ? true : undefined}
                aria-describedby="regCode-note" onChange={set('regCode')} />
              <button type="button" className="btn-secondary" onClick={() => set('regCode')({ target: { value: newRegCode() } })}>
                Generate
              </button>
            </div>
            <span id="regCode-note" className={`text-[12px] ${show('regCode') ? 'text-danger-fg' : 'text-fg-3'}`}>
              {show('regCode') || 'Long enough not to be guessed: there is no limit on attempts.'}
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-1 text-[13px]">
          <label htmlFor="eventDescription">Description</label>
          <textarea id="eventDescription" name="eventDescription" className="input min-h-24" maxLength={1000}
            value={values.eventDescription} onChange={set('eventDescription')} />
          {show('eventDescription') && <span className="text-[12px] text-danger-fg">{show('eventDescription')}</span>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <div className="flex flex-col gap-1 text-[13px]">
            <label htmlFor="playMode">Play mode</label>
            <select id="playMode" name="playMode" className="input" value={values.playMode} disabled={locked}
              onChange={set('playMode')}>
              <option value="T">Teams</option>
              <option value="I">Individual</option>
            </select>
          </div>
          {values.playMode === 'T' ? (
            <Field label="Team size (max)" name="maxTeamSize" type="number" min={2} value={values.maxTeamSize}
              error={show('maxTeamSize')} onChange={set('maxTeamSize')} />
          ) : (
            <div />
          )}
          <Field label="Players (max)" name="maxPlayers" type="number" min={1} value={values.maxPlayers}
            error={show('maxPlayers')} onChange={set('maxPlayers')} />
          <div className="flex flex-col gap-1 text-[13px]">
            <label htmlFor="racfGroup">RACF group</label>
            <select id="racfGroup" name="racfGroup" className="input" value={values.racfGroup} disabled={locked}
              onChange={set('racfGroup')}>
              <option value="">None</option>
              {groupOptions.map((g) => (
                <option key={g.tabKey} value={g.tabKey}>{g.tabKey}{g.tabValue ? ` - ${g.tabValue}` : ''}</option>
              ))}
            </select>
          </div>
        </div>
        {locked && (
          <p className="text-[12px] text-fg-3">Players have joined: play mode and RACF group can no longer change.</p>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          {DATES.slice(0, 3).map(([k, title]) => (
            <Field key={k} label={title} name={k} type="datetime-local" value={values[k]}
              error={show(k)} onChange={set(k)} />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {DATES.slice(3).map(([k, title]) => (
            <Field key={k} label={title} name={k} type="datetime-local" value={values[k]}
              error={show(k)} onChange={set(k)} />
          ))}
        </div>
        <p className="-mt-2 text-[12px] text-fg-3">Times are the mainframe&apos;s local time.</p>

        {!readOnly && (
          <button type="submit" className="btn-primary self-start" disabled={state.busy}>
            {state.busy ? 'Saving…' : submitLabel}
          </button>
        )}
      </fieldset>
    </form>
  )
}
