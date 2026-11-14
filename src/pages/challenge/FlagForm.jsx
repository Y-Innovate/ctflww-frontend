import { useState } from 'react'
import { submitFlag } from '../../api/challenges'
import ErrorBanner from '../../components/ErrorBanner'
import { attemptsText, isPlayable, isYes } from '../../lib/codes'

const MAX_FLAG = 255

// P6: submit a flag. The outcome stays on screen after onChange() reloads
// the challenge (attempts left, solved). The flag lives only in this form.
export default function FlagForm({ eventID, event, challenge: c, onChange }) {
  const [flag, setFlag] = useState('')
  const [state, setState] = useState({ busy: false, outcome: null, error: null })
  const solved = isYes(c.isSolved)
  const team = event.playMode !== 'I'

  async function submit(e) {
    e.preventDefault()
    if (!flag.trim()) return
    setState({ busy: true, outcome: null, error: null })
    try {
      const r = await submitFlag({ eventID, challengeID: c.challengeID, flag })
      if (isYes(r.isCorrect)) {
        setFlag('')
        setState({ busy: false, outcome: 'correct', error: null })
      } else {
        setState({ busy: false, outcome: 'wrong', attemptsLeft: r.attemptsLeft, error: null })
      }
      onChange()
    } catch (err) {
      const outcome = err.isAlreadySolved ? 'alreadySolved' : err.isAttemptsUsedUp ? 'usedUp' : null
      setState({ busy: false, outcome, error: outcome ? null : err })
      if (outcome) onChange()
    }
  }

  let closed = null
  if (solved) {
    closed = state.outcome === 'correct'
      ? `Correct! Solved${team ? ' for your team' : ''}; the challenge is worth ${c.currentPoints} points now.`
      : state.outcome === 'alreadySolved'
        ? 'A teammate was quicker: your team solved this challenge already.'
        : `${team ? 'Your team has' : 'You have'} solved this challenge.`
  } else if (!isPlayable(event)) {
    closed = 'The event has ended: flags can no longer be submitted.'
  } else if (c.attemptsLeft === 0) {
    closed = `${team ? 'Your team has' : 'You have'} used up the attempts for this challenge.`
  }

  if (closed) {
    const good = solved
    return (
      <p role="status" className={`rounded-md px-4 py-2.5 text-[13px] ${good ? 'bg-success-bg text-success-fg' : 'bg-surface-2 text-fg-2'}`}>
        {good && <i className="ti ti-check mr-1.5" aria-hidden="true" />}
        {closed}
      </p>
    )
  }

  return (
    <form className="card flex flex-col gap-3 p-6" onSubmit={submit} aria-labelledby="flag-title">
      <h2 id="flag-title" className="text-[15px] font-medium">Submit a flag</h2>
      {state.outcome === 'wrong' && (
        <p role="status" className="rounded-md bg-warning-bg px-4 py-2.5 text-[13px] text-warning-fg">
          That flag is wrong. {wrongText(state.attemptsLeft)}
        </p>
      )}
      {state.error && <ErrorBanner error={submitErrorText(state.error)} />}
      <div className="flex flex-wrap gap-2">
        <label htmlFor="flag" className="sr-only">Flag</label>
        <input
          id="flag"
          name="flag"
          className="input min-w-0 flex-1 font-mono"
          value={flag}
          maxLength={MAX_FLAG}
          autoComplete="off"
          spellCheck={false}
          placeholder="flag{...}"
          onChange={(e) => setFlag(e.target.value)}
        />
        <button type="submit" className="btn-primary" disabled={state.busy || !flag.trim()}>
          {state.busy ? 'Checking…' : 'Submit'}
        </button>
      </div>
    </form>
  )
}

function wrongText(attemptsLeft) {
  return attemptsLeft === undefined || attemptsLeft === null || attemptsLeft < 0
    ? 'Try again.'
    : `${attemptsText(attemptsLeft)}.`
}

function submitErrorText(err) {
  if (err.isWrongState) return 'The event isn\'t running, so flags can\'t be submitted now.'
  if (err.isNotAllowed) return 'This challenge is locked.'
  return err
}
