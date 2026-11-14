import { useState } from 'react'
import { Link } from 'react-router'
import {
  addEventChallenge, addPrerequisite, eventChallenges, eventPrerequisites, libraryChallenges, removeEventChallenge,
  removePrerequisite, updateEventChallenge,
} from '../../../api/admin'
import ConfirmButton from '../../../components/ConfirmButton'
import ErrorBanner from '../../../components/ErrorBanner'
import { useFullList } from '../../../hooks/useFullList'
import { isYes } from '../../../lib/codes'
import { ADMIN_PATHS, linkTo } from '../../../routes'
import ScoringForm from './ScoringForm'

function scoringText(c) {
  if (c.scoreType === 'D') return `Dynamic: ${c.initPoints} down to ${c.minPoints} over ${c.decaySolves} solves`
  return `${c.initPoints} points`
}

const attemptsOf = (c) => (Number(c.maxAttempts) > 0 ? `${c.maxAttempts} attempts` : 'No attempt limit')

function errorText(err) {
  if (err.is?.('08', '11')) return 'This is in the event already.'
  if ((err.isWrongState || err.is?.('08', '13')) && err.infoMessage) return `${err.infoMessage}.`
  return err
}

// A3: the challenges of an event (hidden ones too) with scoring, attempts,
// order, visibility and prerequisites; add from the library, take out.
export default function EventChallenges({ event }) {
  const eventID = event.eventID
  const list = useFullList(eventChallenges, { eventID })
  const reqs = useFullList(eventPrerequisites, { eventID })
  const library = useFullList(libraryChallenges, {})
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)
  const closed = event.eventStatus === 'C'
  const live = event.eventStatus === 'P' && (event.phase === 'R' || event.phase === 'F')

  const rows = [...list.rows].sort((a, b) => a.sortOrder - b.sortOrder || a.challengeID - b.challengeID)
  const titleOf = (id) => list.rows.find((c) => c.challengeID === id)?.challengeTitle
    ?? library.rows.find((c) => c.challengeID === id)?.challengeTitle ?? `Challenge ${id}`
  const requiredBy = (id) => reqs.rows.filter((q) => q.challengeID === id)

  async function act(call) {
    setError(null)
    try {
      await call()
      await Promise.all([list.reload(), reqs.reload()])
      return true
    } catch (err) {
      setError(errorText(err))
      return false
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {closed && (
        <p className="rounded-md bg-surface-2 px-4 py-2.5 text-[13px] text-fg-2">This event is closed: its challenges can no longer change.</p>
      )}
      {live && (
        <p role="note" className="rounded-md bg-warning-bg px-4 py-2.5 text-[13px] text-warning-fg">
          <i className="ti ti-alert-triangle mr-1.5" aria-hidden="true" />
          The event is running: a scoring change counts for earlier solves too, and players see changes at once.
        </p>
      )}
      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {error && <ErrorBanner error={error} />}
      {list.loaded && rows.length === 0 && (
        <p className="card p-6 text-fg-2">No challenges yet. Add them from the library below; the event needs a visible one to be published.</p>
      )}
      {rows.length > 0 && (
        <ol className="flex flex-col gap-2" aria-label="Challenges of the event">
          {rows.map((c) => {
            const visible = isYes(c.isVisible)
            const needs = requiredBy(c.challengeID)
            return (
              <li key={c.challengeID} className="card flex flex-col gap-3 p-4 text-[13px]">
                <div className="flex flex-wrap items-start gap-3">
                  <span className="w-8 shrink-0 tabular-nums text-fg-3" title="Order">{c.sortOrder}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link className="font-medium hover:underline" to={linkTo(ADMIN_PATHS.challenge, { challengeID: c.challengeID })}>
                        {c.challengeTitle}
                      </Link>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${visible ? 'bg-success-bg text-success-fg' : 'bg-surface-3 text-fg-2'}`}>
                        {visible ? 'Visible' : 'Hidden'}
                      </span>
                    </div>
                    <div className="text-[12px] text-fg-2">{scoringText(c)} · {attemptsOf(c)}</div>
                    {needs.length > 0 && (
                      <div className="text-[12px] text-fg-3">
                        <i className="ti ti-lock mr-1" aria-hidden="true" />
                        Needs {needs.map((q) => titleOf(q.reqChallengeID)).join(', ')}
                      </div>
                    )}
                  </div>
                  {!closed && editing !== c.challengeID && (
                    <div className="flex flex-wrap gap-2">
                      <button type="button" className="btn-secondary" aria-label={`Edit ${c.challengeTitle}`}
                        onClick={() => setEditing(c.challengeID)}>
                        <i className="ti ti-pencil" aria-hidden="true" />
                        Edit
                      </button>
                      <button type="button" className="btn-secondary" aria-label={`${visible ? 'Hide' : 'Show'} ${c.challengeTitle}`}
                        onClick={() => act(() => updateEventChallenge(eventID, c.challengeID, { ...c, isVisible: visible ? 'N' : 'Y' }))}>
                        <i className={`ti ${visible ? 'ti-eye-off' : 'ti-eye'}`} aria-hidden="true" />
                        {visible ? 'Hide' : 'Show'}
                      </button>
                      <ConfirmButton label={`Take out ${c.challengeTitle}`} icon="ti-trash" danger confirmLabel="Take out"
                        question="Take this challenge out of the event? Its prerequisites go too."
                        onConfirm={() => act(() => removeEventChallenge(eventID, c.challengeID))} />
                    </div>
                  )}
                </div>
                {editing === c.challengeID && (
                  <div className="flex flex-col gap-4 border-t-[0.5px] border-line pt-3">
                    <ScoringForm initial={c} idPrefix={`ec-${c.challengeID}`} label={`Scoring of ${c.challengeTitle}`}
                      submitLabel="Save" onCancel={() => setEditing(null)}
                      onSubmit={async (scoring) => {
                        if (await act(() => updateEventChallenge(eventID, c.challengeID, scoring))) setEditing(null)
                      }} />
                    <Prerequisites challenge={c} needs={needs} others={rows.filter((o) => o.challengeID !== c.challengeID)}
                      titleOf={titleOf}
                      onAdd={(req) => act(() => addPrerequisite(eventID, c.challengeID, req))}
                      onRemove={(req) => act(() => removePrerequisite(eventID, c.challengeID, req))} />
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {!closed && list.loaded && (
        <AddChallenge library={library.rows} inEvent={list.rows}
          nextOrder={Math.max(0, ...list.rows.map((c) => c.sortOrder)) + 1}
          onAdd={(challengeID, scoring) => act(() => addEventChallenge(eventID, challengeID, scoring))} />
      )}
    </div>
  )
}

// The challenges that must be solved first, with remove and add
function Prerequisites({ challenge, needs, others, titleOf, onAdd, onRemove }) {
  const [picked, setPicked] = useState('')
  const options = others.filter((o) => !needs.some((q) => q.reqChallengeID === o.challengeID))
  const id = `req-${challenge.challengeID}`
  return (
    <section className="flex flex-col gap-2" aria-label={`Prerequisites of ${challenge.challengeTitle}`}>
      <h3 className="font-medium">Locked until solved</h3>
      {needs.length === 0 && <p className="text-fg-2">No prerequisites: open from the start.</p>}
      <ul className="flex flex-wrap gap-2">
        {needs.map((q) => (
          <li key={q.reqChallengeID} className="flex items-center gap-1 rounded-full bg-surface-2 py-0.5 pl-3 pr-1">
            {titleOf(q.reqChallengeID)}
            <button type="button" className="row-action" aria-label={`Remove prerequisite ${titleOf(q.reqChallengeID)}`}
              onClick={() => onRemove(q.reqChallengeID)}>
              <i className="ti ti-x" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      {options.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <label htmlFor={id} className="sr-only">Add a prerequisite</label>
          <select id={id} className="input" value={picked} onChange={(e) => setPicked(e.target.value)}>
            <option value="">Add a prerequisite…</option>
            {options.map((o) => <option key={o.challengeID} value={o.challengeID}>{o.challengeTitle}</option>)}
          </select>
          <button type="button" className="btn-secondary" disabled={!picked}
            onClick={async () => {
              if (await onAdd(Number(picked))) setPicked('')
            }}>
            Add
          </button>
        </div>
      )}
    </section>
  )
}

// A library challenge into the event, with its scoring (hidden at first)
function AddChallenge({ library, inEvent, nextOrder, onAdd }) {
  const [picked, setPicked] = useState('')
  const [missing, setMissing] = useState(false)
  const [formKey, setFormKey] = useState(0)
  const available = library.filter((c) => !inEvent.some((e) => e.challengeID === c.challengeID))
  if (available.length === 0) {
    return <p className="text-[13px] text-fg-2">Every library challenge is in this event.</p>
  }
  return (
    <section className="card flex flex-col gap-3 p-6" aria-labelledby="add-challenge-title">
      <h2 id="add-challenge-title" className="text-[15px] font-medium">Add a challenge from the library</h2>
      <ScoringForm key={formKey} initial={{ sortOrder: nextOrder }} idPrefix="add" label="Add a challenge"
        submitLabel="Add to event"
        onSubmit={async (scoring) => {
          if (!picked) {
            setMissing(true)
            return
          }
          if (await onAdd(Number(picked), scoring)) {
            setPicked('')
            setFormKey((k) => k + 1)
          }
        }}>
        <div className="flex flex-col gap-1 text-[13px]">
          <label htmlFor="add-challenge">Challenge</label>
          <select id="add-challenge" className="input" value={picked} aria-invalid={missing ? true : undefined}
            onChange={(e) => {
              setPicked(e.target.value)
              setMissing(false)
            }}>
            <option value="">Pick one</option>
            {available.map((c) => <option key={c.challengeID} value={c.challengeID}>{c.challengeTitle} ({c.category})</option>)}
          </select>
          {missing && <span className="text-[12px] text-danger-fg">Pick a challenge</span>}
        </div>
      </ScoringForm>
      <p className="text-[12px] text-fg-3">A challenge needs a flag before it can be visible.</p>
    </section>
  )
}
