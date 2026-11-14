import { useState } from 'react'

// A button that asks first, in the page: the question with confirm and
// cancel. onConfirm may return a promise; the buttons wait for it.
export default function ConfirmButton({ label, icon, question, confirmLabel, onConfirm, danger = false, disabled = false }) {
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  async function confirm() {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
      setAsking(false)
    }
  }

  if (!asking) {
    return (
      <button type="button" className={danger ? 'btn-danger' : 'btn-secondary'} disabled={disabled} onClick={() => setAsking(true)}>
        {icon && <i className={`ti ${icon}`} aria-hidden="true" />}
        {label}
      </button>
    )
  }
  return (
    <span role="group" aria-label={label} className="inline-flex flex-wrap items-center gap-2">
      <span className="text-[13px]">{question}</span>
      <button type="button" className={danger ? 'btn-danger' : 'btn-primary'} disabled={busy} onClick={confirm}>
        {confirmLabel}
      </button>
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => setAsking(false)}>
        Cancel
      </button>
    </span>
  )
}
