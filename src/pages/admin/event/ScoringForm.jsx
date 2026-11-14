import { useState } from 'react'

// The scoring of a challenge just added: fixed 100, hidden until it is ready
const NEW_SCORING = {
  scoreType: 'S', initPoints: 100, minPoints: 0, decaySolves: 0, isVisible: 'N', sortOrder: 1, maxAttempts: 0,
}

// The checks of CTFM011 R020, for quick feedback; the backend decides
function problemsOf(v) {
  const p = {}
  const n = (k) => Number(v[k])
  const whole = (k) => v[k] !== '' && Number.isInteger(n(k))
  for (const k of ['initPoints', 'maxAttempts', 'sortOrder']) if (!whole(k) || n(k) < 0) p[k] = '0 or more'
  if (v.scoreType === 'D') {
    if (!whole('minPoints') || n('minPoints') < 0 || n('minPoints') > n('initPoints')) {
      p.minPoints = 'Between 0 and the initial value'
    }
    if (!whole('decaySolves') || n('decaySolves') < 1) p.decaySolves = '1 or more'
  }
  return p
}

function NumberField({ id, label, value, problem, hint, onChange }) {
  return (
    <div className="flex w-32 flex-col gap-1 text-[13px]">
      <label htmlFor={id}>{label}</label>
      <input id={id} type="number" min={0} className="input" value={value} aria-invalid={problem ? true : undefined}
        onChange={(e) => onChange(e.target.value)} />
      {(problem || hint) && <span className={`text-[12px] ${problem ? 'text-danger-fg' : 'text-fg-3'}`}>{problem || hint}</span>}
    </div>
  )
}

// A3: scoring, attempts, order and visibility of a challenge in an event.
// idPrefix keeps the field IDs apart when several forms are open.
export default function ScoringForm({ initial, idPrefix, submitLabel, label, onSubmit, onCancel, children }) {
  const [v, setV] = useState(() => Object.fromEntries(Object.keys(NEW_SCORING).map((k) =>
    [k, typeof NEW_SCORING[k] === 'number' ? String(initial[k] ?? NEW_SCORING[k]) : initial[k] || NEW_SCORING[k]])))
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const problems = problemsOf(v)
  const show = (k) => (submitted ? problems[k] : null)
  const set = (k) => (value) => setV((x) => ({ ...x, [k]: value }))
  const id = (k) => `${idPrefix}-${k}`
  const dynamic = v.scoreType === 'D'

  async function submit(e) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(problems).length > 0) return
    setBusy(true)
    const n = (k) => Number(v[k])
    await onSubmit({
      scoreType: v.scoreType, isVisible: v.isVisible,
      initPoints: n('initPoints'), maxAttempts: n('maxAttempts'), sortOrder: n('sortOrder'),
      minPoints: dynamic ? n('minPoints') : 0, decaySolves: dynamic ? n('decaySolves') : 0,
    })
    setBusy(false)
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit} aria-label={label} noValidate>
      {children}
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex w-36 flex-col gap-1 text-[13px]">
          <label htmlFor={id('scoreType')}>Scoring</label>
          <select id={id('scoreType')} className="input" value={v.scoreType} onChange={(e) => set('scoreType')(e.target.value)}>
            <option value="S">Fixed</option>
            <option value="D">Dynamic</option>
          </select>
        </div>
        <NumberField id={id('initPoints')} label={dynamic ? 'Initial value' : 'Value'} value={v.initPoints}
          problem={show('initPoints')} onChange={set('initPoints')} />
        {dynamic && (
          <>
            <NumberField id={id('minPoints')} label="Minimum value" value={v.minPoints}
              problem={show('minPoints')} onChange={set('minPoints')} />
            <NumberField id={id('decaySolves')} label="Decay (solves)" value={v.decaySolves}
              problem={show('decaySolves')} hint="Solves to reach the minimum" onChange={set('decaySolves')} />
          </>
        )}
        <NumberField id={id('maxAttempts')} label="Attempts" value={v.maxAttempts}
          problem={show('maxAttempts')} hint="0 is no limit" onChange={set('maxAttempts')} />
        <NumberField id={id('sortOrder')} label="Order" value={v.sortOrder}
          problem={show('sortOrder')} onChange={set('sortOrder')} />
        <label htmlFor={id('isVisible')} className="flex items-center gap-2 self-center pt-5 text-[13px]">
          <input id={id('isVisible')} type="checkbox" checked={v.isVisible === 'Y'}
            onChange={(e) => set('isVisible')(e.target.checked ? 'Y' : 'N')} />
          Visible to players
        </label>
      </div>
      <div className="flex gap-2">
        <button type="submit" className="btn-primary" disabled={busy}>{submitLabel}</button>
        {onCancel && <button type="button" className="btn-secondary" disabled={busy} onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  )
}
