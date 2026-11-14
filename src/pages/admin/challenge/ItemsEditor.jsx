import { useState } from 'react'
import ConfirmButton from '../../../components/ConfirmButton'
import ErrorBanner from '../../../components/ErrorBanner'
import { useFullList } from '../../../hooks/useFullList'

// The flags, hints or links of a challenge: each row with edit and delete,
// and a form to add one. resource: flags, hints or links of src/api/admin.js.
// fields: [{ name, label, kind: text|textarea|number|yesno, max, min,
// required, mono, initial }]. summary(row) shows a row; sort orders the rows.
export default function ItemsEditor({ title, singular, resource, challengeID, fields, summary, sort, errorText = (e) => e }) {
  const list = useFullList(resource.list, { challengeID })
  const [editing, setEditing] = useState(null)
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState(null)
  const rows = sort ? [...list.rows].sort(sort) : list.rows
  const headingId = `items-${singular}`

  async function act(call) {
    setError(null)
    try {
      await call()
      await list.reload()
      return true
    } catch (err) {
      setError(errorText(err))
      return false
    }
  }

  return (
    <section className="card flex flex-col gap-3 p-6" aria-labelledby={headingId}>
      <h2 id={headingId} className="text-[15px] font-medium">{title}</h2>
      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {error && <ErrorBanner error={error} />}
      {list.loaded && rows.length === 0 && <p className="text-[13px] text-fg-2">None yet.</p>}
      {rows.length > 0 && (
        <ol className="flex flex-col gap-2">
          {rows.map((row, i) => {
            const id = row[resource.idKey]
            const name = `${singular} ${i + 1}`
            return (
              <li key={id} className="rounded-md bg-surface-2 px-4 py-2.5 text-[13px]">
                {editing === id ? (
                  <ItemForm fields={fields} initial={row} submitLabel="Save" label={`Edit ${name}`}
                    onCancel={() => setEditing(null)}
                    onSubmit={async (values) => {
                      if (await act(() => resource.update(id, values))) setEditing(null)
                    }} />
                ) : (
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">{summary(row)}</div>
                    <div className="flex gap-2">
                      <button type="button" className="btn-secondary" aria-label={`Edit ${name}`} onClick={() => setEditing(id)}>
                        <i className="ti ti-pencil" aria-hidden="true" />
                        Edit
                      </button>
                      <ConfirmButton label={`Delete ${name}`} icon="ti-trash" danger question={`Delete this ${singular}?`}
                        confirmLabel="Delete" onConfirm={() => act(() => resource.remove(id))} />
                    </div>
                  </div>
                )}
              </li>
            )
          })}
        </ol>
      )}
      {adding ? (
        <div className="rounded-md border-[0.5px] border-line p-4">
          <ItemForm fields={fields} initial={null} submitLabel={`Add ${singular}`} label={`New ${singular}`}
            onCancel={() => setAdding(false)}
            onSubmit={async (values) => {
              if (await act(() => resource.create(challengeID, values))) setAdding(false)
            }} />
        </div>
      ) : (
        <button type="button" className="btn-secondary self-start" onClick={() => setAdding(true)}>
          <i className="ti ti-plus" aria-hidden="true" />
          New {singular}
        </button>
      )}
    </section>
  )
}

function initialValue(field, row) {
  if (row) return field.kind === 'number' ? String(row[field.name] ?? '') : row[field.name] ?? ''
  return field.initial ?? (field.kind === 'yesno' ? 'Y' : '')
}

function problemOf(field, value) {
  const v = String(value ?? '').trim()
  if (field.required && !v) return 'Required'
  if (field.max && v.length > field.max) return `Up to ${field.max} characters`
  if (field.kind === 'number' && (v === '' || !Number.isInteger(Number(v)))) return 'A whole number'
  if (field.kind === 'number' && field.min !== undefined && Number(v) < field.min) return `${field.min} or more`
  return null
}

function ItemForm({ fields, initial, submitLabel, label, onSubmit, onCancel }) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f.name, initialValue(f, initial)])))
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const problems = Object.fromEntries(fields.map((f) => [f.name, problemOf(f, values[f.name])]).filter(([, p]) => p))
  const set = (name, value) => setValues((v) => ({ ...v, [name]: value }))
  const idOf = (f) => `${label.replaceAll(' ', '-')}-${f.name}`

  async function submit(e) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    // Texts are trimmed: CTFM008 compares submissions trimmed, so a flag
    // with spaces around it could never be matched
    await onSubmit(Object.fromEntries(fields.map((f) => [f.name,
      f.kind === 'number' ? Number(values[f.name]) : String(values[f.name]).trim()])))
    setBusy(false)
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit} aria-label={label} noValidate>
      <div className="flex flex-wrap gap-3">
        {fields.map((f) => {
          const id = idOf(f)
          const problem = submitted ? problems[f.name] : null
          if (f.kind === 'yesno') {
            return (
              <label key={f.name} htmlFor={id} className="flex items-center gap-2 self-end py-1.5 text-[13px]">
                <input id={id} type="checkbox" checked={values[f.name] === 'Y'}
                  onChange={(e) => set(f.name, e.target.checked ? 'Y' : 'N')} />
                {f.label}
              </label>
            )
          }
          const common = {
            id, value: values[f.name], 'aria-invalid': problem ? true : undefined,
            onChange: (e) => set(f.name, e.target.value),
            className: `input w-full ${f.mono ? 'font-mono' : ''}`,
          }
          return (
            <div key={f.name} className={`flex flex-col gap-1 text-[13px] ${f.kind === 'number' ? 'w-28' : 'min-w-56 flex-1'}`}>
              <label htmlFor={id}>{f.label}</label>
              {f.kind === 'textarea'
                ? <textarea {...common} className={`${common.className} min-h-20`} maxLength={f.max} />
                : <input {...common} type={f.kind === 'number' ? 'number' : 'text'} maxLength={f.max} min={f.min}
                    autoComplete="off" spellCheck={f.mono ? false : undefined} />}
              {problem && <span className="text-[12px] text-danger-fg">{problem}</span>}
            </div>
          )
        })}
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>{submitLabel}</button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </form>
  )
}
