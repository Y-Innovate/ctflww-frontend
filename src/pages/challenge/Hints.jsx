import { useState } from 'react'
import { unlockHint } from '../../api/challenges'
import { hints } from '../../api/lists'
import ErrorBanner from '../../components/ErrorBanner'
import { useFullList } from '../../hooks/useFullList'
import { isPlayable, isYes } from '../../lib/codes'
import { whoPays } from '../../lib/play'

// P7: the hints of a challenge in order, with their cost. Unlocking asks
// first: it costs points whether the hint helps or not.
export default function Hints({ eventID, challengeID, event }) {
  const list = useFullList(hints, { eventID, challengeID })
  const [confirming, setConfirming] = useState(null)
  const [state, setState] = useState({ busy: false, error: null })
  const playable = isPlayable(event)

  async function unlock(hint) {
    setState({ busy: true, error: null })
    try {
      await unlockHint({ eventID, hintID: hint.hintID })
      setConfirming(null)
      setState({ busy: false, error: null })
      await list.reload()
    } catch (err) {
      setConfirming(null)
      setState({ busy: false, error: err })
    }
  }

  if (list.error) return <ErrorBanner error={list.error} onRetry={list.reload} />
  if (list.rows.length === 0) return null

  return (
    <section className="card flex flex-col gap-3 p-6" aria-labelledby="hints-title">
      <h2 id="hints-title" className="text-[15px] font-medium">Hints</h2>
      {!playable && (
        <p className="text-[13px] text-fg-2">Hints can only be unlocked while the event runs.</p>
      )}
      {state.error && <ErrorBanner error={unlockErrorText(state.error)} />}
      <ol className="flex flex-col gap-2">
        {list.rows.map((h, i) => (
          <li key={h.hintID} className="rounded-md bg-surface-2 px-4 py-3 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">Hint {i + 1}</span>
              <span className="text-fg-3">{costText(h.cost)}</span>
              {!isYes(h.isUnlocked) && playable && confirming !== h.hintID && (
                <button type="button" className="btn-secondary ml-auto" onClick={() => setConfirming(h.hintID)}>
                  <i className="ti ti-lock-open" aria-hidden="true" />
                  Unlock
                </button>
              )}
            </div>
            {isYes(h.isUnlocked) && <p className="mt-1.5 whitespace-pre-line">{h.hintText}</p>}
            {confirming === h.hintID && (
              <div role="group" aria-label={`Unlock hint ${i + 1}`} className="mt-2 flex flex-wrap items-center gap-2">
                <span className="flex-1">
                  {Number(h.cost) > 0
                    ? `This deducts ${costText(h.cost)} from ${whoPays(event.playMode)}, also if the hint doesn't help.`
                    : 'This hint is free.'}
                </span>
                <button type="button" className="btn-primary" disabled={state.busy} onClick={() => unlock(h)}>
                  {state.busy ? 'Unlocking…' : 'Unlock hint'}
                </button>
                <button type="button" className="btn-secondary" disabled={state.busy} onClick={() => setConfirming(null)}>
                  Cancel
                </button>
              </div>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}

function costText(cost) {
  return Number(cost) === 1 ? '1 point' : `${cost} points`
}

function unlockErrorText(err) {
  if (err.isWrongState) return 'The event isn\'t running, so hints can\'t be unlocked now.'
  if (err.isNotAllowed) return 'This hint can\'t be unlocked: the challenge is locked.'
  return err
}
