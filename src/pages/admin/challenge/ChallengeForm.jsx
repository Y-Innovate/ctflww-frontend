import { useState } from 'react'
import ErrorBanner from '../../../components/ErrorBanner'
import Field from '../../../components/Field'

// The checks of CTFM007 R020, for quick feedback; the backend decides
function problemsOf(v) {
  const p = {}
  if (!v.challengeTitle.trim()) p.challengeTitle = 'A title is required'
  else if (v.challengeTitle.trim().length > 100) p.challengeTitle = 'Up to 100 characters'
  if (!v.category) p.category = 'Pick a category'
  if (!v.challengeDescription.trim()) p.challengeDescription = 'A description is required'
  else if (v.challengeDescription.trim().length > 3000) p.challengeDescription = 'Up to 3000 characters'
  return p
}

// A2: title, category and description of a library challenge. challenge:
// null for a new one. categories: the CATEGORY entries.
export default function ChallengeForm({ challenge, categories, submitLabel, onSubmit }) {
  const [values, setValues] = useState({
    challengeTitle: challenge?.challengeTitle ?? '',
    category: challenge?.category ?? '',
    challengeDescription: challenge?.challengeDescription ?? '',
  })
  const [submitted, setSubmitted] = useState(false)
  const [state, setState] = useState({ busy: false, error: null, saved: false })
  const problems = problemsOf(values)
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
      await onSubmit({
        challengeTitle: values.challengeTitle.trim(),
        category: values.category,
        challengeDescription: values.challengeDescription.trim(),
      })
      setState({ busy: false, error: null, saved: true })
    } catch (err) {
      setState({ busy: false, error: err, saved: false })
    }
  }

  // The list, plus the challenge's own category if it left the list since
  const options = values.category && !categories.some((c) => c.tabKey === values.category)
    ? [...categories, { tabKey: values.category, tabValue: `${values.category} (no longer in the list)` }]
    : categories

  return (
    <form className="card flex flex-col gap-4 p-6" onSubmit={submit} aria-label="Challenge" noValidate>
      {state.error && <ErrorBanner error={state.error} />}
      {state.saved && <p role="status" className="rounded-md bg-success-bg px-4 py-2.5 text-[13px] text-success-fg">Saved.</p>}
      <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
        <Field label="Title" name="challengeTitle" value={values.challengeTitle} maxLength={100}
          error={show('challengeTitle')} onChange={set('challengeTitle')} />
        <div className="flex flex-col gap-1 text-[13px]">
          <label htmlFor="category">Category</label>
          <select id="category" name="category" className="input" value={values.category} onChange={set('category')}
            aria-invalid={show('category') ? true : undefined}>
            <option value="">Pick one</option>
            {options.map((c) => <option key={c.tabKey} value={c.tabKey}>{c.tabValue || c.tabKey}</option>)}
          </select>
          {show('category') && <span className="text-[12px] text-danger-fg">{show('category')}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-1 text-[13px]">
        <label htmlFor="challengeDescription">Description (shown to players)</label>
        <textarea id="challengeDescription" name="challengeDescription" className="input min-h-32" maxLength={3000}
          value={values.challengeDescription} aria-invalid={show('challengeDescription') ? true : undefined}
          onChange={set('challengeDescription')} />
        {show('challengeDescription') && <span className="text-[12px] text-danger-fg">{show('challengeDescription')}</span>}
      </div>
      <button type="submit" className="btn-primary self-start" disabled={state.busy}>
        {state.busy ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}
