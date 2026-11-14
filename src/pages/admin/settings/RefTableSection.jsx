import { useState } from 'react'
import { createRefTable, deleteRefTable, updateRefTable } from '../../../api/admin'
import ConfirmButton from '../../../components/ConfirmButton'
import ErrorBanner from '../../../components/ErrorBanner'
import Field from '../../../components/Field'
import { formatTs } from '../../../lib/timestamps'

const KEY_MAX = 8
const VALUE_MAX = 255

// CTFM001 R025: a setting must fit the field CTFM910 reads it into, and
// CLAIMHRS and JOBMINS are numbers (TEST-NUMVAL)
const SETTING_LENGTHS = {
  JOBCLASS: 1, MSGCLASS: 1, DB2SSID: 4, SUBMTXN: 4, CLAIMHRS: 4,
  BATCHUSR: 8, PLAYGRP: 8, CTFPLAN: 8, SUBMUSR: 8, DB2HLQ: 20, DB2SSHLQ: 20, LOADLIB: 44,
}
const NUMERIC_SETTINGS = ['CLAIMHRS', 'JOBMINS']
const isNumber = (v) => /^\s*[+-]?(\d+\.?\d*|\.\d+)\s*$/.test(String(v ?? ''))

// One reference table: its entries with edit and delete, and an add form.
// table: { tableID, title, note, canAdd, valueLabel, settings }
export default function RefTableSection({ table, rows, onChange }) {
  const [error, setError] = useState(null)
  const headingId = `ref-${table.tableID}`

  async function act(call) {
    setError(null)
    try {
      await call()
      await onChange()
      return true
    } catch (err) {
      setError(errorText(err))
      return false
    }
  }

  return (
    <section className="card flex flex-col gap-3 p-6" aria-labelledby={headingId}>
      <header>
        <h2 id={headingId} className="text-[15px] font-medium">{table.title}</h2>
        {table.note && <p className="mt-0.5 text-[12px] text-fg-3">{table.note}</p>}
      </header>
      {error && <ErrorBanner error={error} />}
      {rows.length === 0 && <p className="text-[13px] text-fg-2">No entries yet.</p>}
      {rows.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <RefRow
              key={r.tabKey}
              row={r}
              table={table}
              onSave={(tabValue) => act(() => updateRefTable({ tableID: r.tableID, tabKey: r.tabKey, tabValue }))}
              onDelete={() => act(() => deleteRefTable({ tableID: r.tableID, tabKey: r.tabKey }))}
            />
          ))}
        </ul>
      )}
      {table.canAdd && (
        <AddForm table={table} onAdd={(tabKey, tabValue) => act(() => createRefTable({ tableID: table.tableID, tabKey, tabValue }))} />
      )}
    </section>
  )
}

function RefRow({ row: r, table, onSave, onDelete }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(r.tabValue)
  const [busy, setBusy] = useState(false)
  const invalid = valueProblem(table, value, r.tabKey)

  async function save(e) {
    e.preventDefault()
    if (invalid) return
    setBusy(true)
    const done = await onSave(value.trim())
    setBusy(false)
    if (done) setEditing(false)
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-surface-2 px-4 py-2 text-[13px]">
      <code className="w-24 shrink-0 font-mono font-medium">{r.tabKey}</code>
      {editing ? (
        <form className="flex flex-1 flex-wrap items-start gap-2" onSubmit={save} aria-label={`Edit ${r.tabKey}`}>
          <div className="min-w-48 flex-1">
            <Field label={`${table.valueLabel} of ${r.tabKey}`} name={`value-${r.tabKey}`} value={value}
              maxLength={maxLength(table, r.tabKey)}
              inputMode={table.settings && NUMERIC_SETTINGS.includes(r.tabKey) ? 'decimal' : undefined}
              error={invalid} onChange={(e) => setValue(e.target.value)} />
          </div>
          <div className="flex gap-2 self-end">
            <button type="submit" className="btn-primary" disabled={busy || Boolean(invalid)}>Save</button>
            <button type="button" className="btn-secondary" disabled={busy}
              onClick={() => { setValue(r.tabValue); setEditing(false) }}>Cancel</button>
          </div>
        </form>
      ) : (
        <>
          <span className="min-w-0 flex-1 break-words">{r.tabValue}</span>
          <span className="text-[11px] text-fg-3" title={`Created by ${r.createdBy} on ${formatTs(r.createdDate)}`}>
            {r.updatedBy} · {formatTs(r.updatedDate)}
          </span>
          <span className="flex gap-2">
            <button type="button" className="btn-secondary" aria-label={`Edit ${r.tabKey}`} onClick={() => setEditing(true)}>
              <i className="ti ti-pencil" aria-hidden="true" />
              Edit
            </button>
            {!table.settings && (
              <ConfirmButton label={`Delete ${r.tabKey}`} icon="ti-trash" danger
                question={`Delete ${r.tabKey}?`} confirmLabel="Delete" onConfirm={onDelete} />
            )}
          </span>
        </>
      )}
    </li>
  )
}

function AddForm({ table, onAdd }) {
  const [key, setKey] = useState('')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const keyText = key.trim().toUpperCase()
  const keyProblem = keyText.length > KEY_MAX ? `Up to ${KEY_MAX} characters` : null
  const invalid = keyProblem || valueProblem(table, value)

  async function add(e) {
    e.preventDefault()
    if (!keyText || invalid) return
    setBusy(true)
    const done = await onAdd(keyText, value.trim())
    setBusy(false)
    if (done) {
      setKey('')
      setValue('')
    }
  }

  return (
    <form className="flex flex-wrap items-start gap-2 border-t-[0.5px] border-line pt-3" onSubmit={add}
      aria-label={`Add to ${table.title}`}>
      <div className="w-32">
        <Field label="Key" name={`key-${table.tableID}`} value={key} maxLength={KEY_MAX} autoComplete="off"
          className="input font-mono uppercase" error={keyProblem} onChange={(e) => setKey(e.target.value)} />
      </div>
      <div className="min-w-48 flex-1">
        <Field label={table.valueLabel} name={`new-value-${table.tableID}`} value={value} maxLength={VALUE_MAX}
          error={valueProblem(table, value)} onChange={(e) => setValue(e.target.value)} />
      </div>
      <button type="submit" className="btn-primary mt-[22px]" disabled={busy || !keyText || Boolean(invalid)}>
        <i className="ti ti-plus" aria-hidden="true" />
        Add
      </button>
    </form>
  )
}

function maxLength(table, key) {
  return table.settings ? SETTING_LENGTHS[key] ?? VALUE_MAX : VALUE_MAX
}

// The checks of CTFM001, for quick feedback; the backend still decides
function valueProblem(table, value, key) {
  const max = maxLength(table, key)
  if (value.trim().length > max) return max === 1 ? '1 character' : `Up to ${max} characters`
  if (!table.settings) return null
  if (!value.trim()) return 'A value is required'
  if (NUMERIC_SETTINGS.includes(key) && !isNumber(value)) return 'A number'
  return null
}

function errorText(err) {
  if (err.is('08', '11')) return 'This key exists already.'
  if (err.isWrongState) return err.infoMessage ? `${err.infoMessage}.` : 'This entry is in use.'
  return err
}
