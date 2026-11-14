import { useState } from 'react'
import { adminAnnouncements, correctAnnouncement, deleteAnnouncement, publishAnnouncement } from '../../../api/admin'
import ConfirmButton from '../../../components/ConfirmButton'
import ErrorBanner from '../../../components/ErrorBanner'
import Field from '../../../components/Field'
import LoadMore from '../../../components/LoadMore'
import { usePagedList } from '../../../hooks/usePagedList'
import { formatTs, isBlank } from '../../../lib/timestamps'

const TITLE_MAX = 100
const BODY_MAX = 1000

const errorText = (err) => (err.isWrongState && err.infoMessage ? `${err.infoMessage}.` : err)

// A8: write, correct and delete the announcements of an event, newest first.
// Players poll for them every minute (P9). Also on a draft; a closed event
// is read-only.
export default function Announcements({ event }) {
  const eventID = event.eventID
  const list = usePagedList(adminAnnouncements, { eventID })
  const [editing, setEditing] = useState(null)
  const [error, setError] = useState(null)
  const closed = event.eventStatus === 'C'

  async function remove(announceID) {
    setError(null)
    try {
      await deleteAnnouncement(announceID)
      await list.reload()
    } catch (err) {
      setError(errorText(err))
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {closed ? (
        <p className="rounded-md bg-surface-2 px-4 py-2.5 text-[13px] text-fg-2">This event is closed: its announcements can no longer change.</p>
      ) : (
        <section className="card flex flex-col gap-3 p-6" aria-labelledby="new-announcement-title">
          <h2 id="new-announcement-title" className="text-[15px] font-medium">New announcement</h2>
          <p className="text-[12px] text-fg-3">
            {event.eventStatus === 'D'
              ? 'Players see it once the event is published and they have joined.'
              : 'Players of the event see it within a minute, marked as new.'}
          </p>
          <AnnouncementForm idPrefix="new" label="New announcement" submitLabel="Publish" clearAfter
            onSubmit={async (values) => {
              await publishAnnouncement({ eventID, ...values })
              await list.reload()
            }} />
        </section>
      )}

      <section className="flex flex-col gap-3" aria-labelledby="announcements-title">
        <h2 id="announcements-title" className="text-[15px] font-medium">Published, newest first</h2>
        {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
        {error && <ErrorBanner error={error} />}
        {!list.loading && !list.error && list.rows.length === 0 && <p className="card p-6 text-fg-2">No announcements yet.</p>}
        <ul className="flex flex-col gap-2" aria-label="Announcements">
          {list.rows.map((a) => (
            <li key={a.announceID} className="card flex flex-col gap-2 p-5 text-[13px]">
              {editing === a.announceID ? (
                <AnnouncementForm idPrefix={`edit-${a.announceID}`} label={`Correct ${a.announceTitle}`}
                  submitLabel="Save correction" initial={a} onCancel={() => setEditing(null)}
                  onSubmit={async (values) => {
                    await correctAnnouncement(a.announceID, values)
                    setEditing(null)
                    await list.reload()
                  }} />
              ) : (
                <>
                  <header className="flex flex-wrap items-baseline gap-2">
                    <h3 className="text-[15px] font-medium">{a.announceTitle}</h3>
                    <span className="ml-auto text-[12px] text-fg-3">
                      {formatTs(a.createdDate)}{a.createdBy ? ` · ${a.createdBy}` : ''}
                    </span>
                  </header>
                  <p className="whitespace-pre-line text-fg-2">{a.announceBody}</p>
                  {!isBlank(a.updatedDate) && a.updatedDate !== a.createdDate && (
                    <p className="text-[11px] text-fg-3">Corrected {formatTs(a.updatedDate)} by {a.updatedBy}</p>
                  )}
                  {!closed && (
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary" aria-label={`Correct ${a.announceTitle}`}
                        onClick={() => setEditing(a.announceID)}>
                        <i className="ti ti-pencil" aria-hidden="true" />
                        Correct
                      </button>
                      <ConfirmButton label={`Delete ${a.announceTitle}`} icon="ti-trash" danger confirmLabel="Delete"
                        question="Delete this announcement? Players no longer see it." onConfirm={() => remove(a.announceID)} />
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
        <LoadMore list={list} label="Older" />
      </section>
    </div>
  )
}

function AnnouncementForm({ idPrefix, label, submitLabel, initial, clearAfter = false, onSubmit, onCancel }) {
  const start = { announceTitle: initial?.announceTitle ?? '', announceBody: initial?.announceBody ?? '' }
  const [v, setV] = useState(start)
  const [submitted, setSubmitted] = useState(false)
  const [state, setState] = useState({ busy: false, error: null })
  const problems = {
    ...(!v.announceTitle.trim() && { announceTitle: 'A title is required' }),
    ...(!v.announceBody.trim() && { announceBody: 'A text is required' }),
  }
  const show = (k) => (submitted ? problems[k] : null)
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(problems).length > 0) return
    setState({ busy: true, error: null })
    try {
      await onSubmit({ announceTitle: v.announceTitle.trim(), announceBody: v.announceBody.trim() })
      setState({ busy: false, error: null })
      if (clearAfter) {
        setV({ announceTitle: '', announceBody: '' })
        setSubmitted(false)
      }
    } catch (err) {
      setState({ busy: false, error: errorText(err) })
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit} aria-label={label} noValidate>
      {state.error && <ErrorBanner error={state.error} />}
      <Field label="Title" id={`${idPrefix}-title`} name="announceTitle" value={v.announceTitle} maxLength={TITLE_MAX}
        error={show('announceTitle')} onChange={set('announceTitle')} />
      <div className="flex flex-col gap-1 text-[13px]">
        <label htmlFor={`${idPrefix}-body`}>Text</label>
        <textarea id={`${idPrefix}-body`} className="input min-h-24" maxLength={BODY_MAX} value={v.announceBody}
          aria-invalid={show('announceBody') ? true : undefined} onChange={set('announceBody')} />
        <span className={`text-[12px] ${show('announceBody') ? 'text-danger-fg' : 'text-fg-3'}`}>
          {show('announceBody') || `${v.announceBody.length} / ${BODY_MAX}`}
        </span>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={state.busy}>{submitLabel}</button>
        {onCancel && <button type="button" className="btn-secondary" disabled={state.busy} onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
