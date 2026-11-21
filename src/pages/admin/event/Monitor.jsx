import { useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  adminLeaderboard, adminSolves, adminSubmissions, adminTeams, eventChallenges, reverseSolve,
} from '../../../api/admin'
import ErrorBanner from '../../../components/ErrorBanner'
import LoadMore from '../../../components/LoadMore'
import { useFullList } from '../../../hooks/useFullList'
import { usePagedList } from '../../../hooks/usePagedList'
import { usePolling } from '../../../hooks/usePolling'
import { PAGE_SIZE } from '../../../api/lists'
import { isReadOnly, isYes } from '../../../lib/codes'
import { formatTs, isBlank } from '../../../lib/timestamps'
import { usePlayerNames } from '../usePlayerNames'

const REFRESH_MS = 30_000

// A4: the live leaderboard, the attempts and the solves of an event, with
// filters in the query string (team, challenge, correct), and reversing a
// solve with a reason. Refreshes every 30 s while the event runs.
export default function Monitor({ event }) {
  const eventID = event.eventID
  const [params, setParams] = useSearchParams()
  const team = params.get('team') ?? ''
  const challenge = params.get('challenge') ?? ''
  const correct = params.get('correct') ?? ''
  const teams = useFullList(adminTeams, { eventID })
  const challenges = useFullList(eventChallenges, { eventID })
  const filters = { eventID, ...(team && { teamID_filter: team }), ...(challenge && { challengeID_filter: challenge }) }

  const board = usePagedList(adminLeaderboard, { eventID })
  const submissions = usePagedList(adminSubmissions, { ...filters, ...(correct && { isCorrect_filter: correct }) })
  const solves = usePagedList(adminSolves, filters)
  const live = event.eventStatus === 'P' && (event.phase === 'R' || event.phase === 'F')
  const closed = isReadOnly(event)

  // Only the first pages: a refresh would close the pages opened below them
  usePolling(() => {
    for (const list of [board, submissions, solves]) {
      if (!list.loading && list.rows.length <= PAGE_SIZE) list.reload()
    }
  }, REFRESH_MS, live)

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }
  const teamName = (id) => teams.rows.find((t) => t.teamID === id)?.teamName ?? `Team ${id}`
  const challengeTitle = (id) => challenges.rows.find((c) => c.challengeID === id)?.challengeTitle ?? `Challenge ${id}`
  const playerText = usePlayerNames(eventID)
  const individual = event.playMode === 'I'

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3 p-6" aria-labelledby="board-title">
        <header className="flex flex-wrap items-baseline gap-2">
          <h2 id="board-title" className="text-[15px] font-medium">Live leaderboard</h2>
          {event.phase === 'F' && (
            <span className="text-[12px] text-fg-3">
              Without the freeze: players see the board as it was at {formatTs(event.freezeTS)}.
            </span>
          )}
        </header>
        {board.error && <ErrorBanner error={board.error} onRetry={board.reload} />}
        {!board.loading && !board.error && board.rows.length === 0 && <p className="text-[13px] text-fg-2">No teams yet.</p>}
        {board.rows.length > 0 && (
          <table className="data-table w-full">
            <thead>
              <tr>
                <th className="w-14">Rank</th>
                <th>{individual ? 'Player' : 'Team'}</th>
                <th className="text-right">Score</th>
                <th className="text-right">Solves</th>
              </tr>
            </thead>
            <tbody>
              {board.rows.map((r) => (
                <tr key={r.teamID}>
                  <td>{r.rank}</td>
                  <td>{r.teamName}</td>
                  <td className="text-right tabular-nums">{r.score}</td>
                  <td className="text-right tabular-nums">{r.solveCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <LoadMore list={board} label="Next 20" />
      </section>

      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filters">
        <FilterSelect id="filter-team" label={individual ? 'Player' : 'Team'} value={team}
          options={teams.rows.map((t) => [t.teamID, t.teamName])} onChange={(v) => setFilter('team', v)} />
        <FilterSelect id="filter-challenge" label="Challenge" value={challenge}
          options={challenges.rows.map((c) => [c.challengeID, c.challengeTitle])} onChange={(v) => setFilter('challenge', v)} />
        <FilterSelect id="filter-correct" label="Right or wrong" value={correct} all="Both"
          options={[['Y', 'Right only'], ['N', 'Wrong only']]} onChange={(v) => setFilter('correct', v)} />
      </div>

      <section className="card flex flex-col gap-3 p-6" aria-labelledby="solves-title">
        <h2 id="solves-title" className="text-[15px] font-medium">Solves</h2>
        {solves.error && <ErrorBanner error={solves.error} onRetry={solves.reload} />}
        {!solves.loading && !solves.error && solves.rows.length === 0 && <p className="text-[13px] text-fg-2">No solves.</p>}
        {solves.rows.length > 0 && (
          <ul className="flex flex-col gap-1.5">
            {solves.rows.map((s) => (
              <SolveRow key={`${s.challengeID}-${s.teamID}`} solve={s} closed={closed}
                text={`${challengeTitle(s.challengeID)} · ${teamName(s.teamID)}${individual ? '' : ` · ${playerText(s.playerID)}`}`}
                onReverse={async (reverseReason) => {
                  await reverseSolve({ eventID, challengeID: s.challengeID, teamID: s.teamID, reverseReason })
                  await Promise.all([solves.reload(), submissions.reload(), board.reload()])
                }} />
            ))}
          </ul>
        )}
        <LoadMore list={solves} label="Next 20" />
      </section>

      <section className="card flex flex-col gap-3 p-6" aria-labelledby="submissions-title">
        <h2 id="submissions-title" className="text-[15px] font-medium">Attempts, newest first</h2>
        {submissions.error && <ErrorBanner error={submissions.error} onRetry={submissions.reload} />}
        {!submissions.loading && !submissions.error && submissions.rows.length === 0 && (
          <p className="text-[13px] text-fg-2">No attempts.</p>
        )}
        {submissions.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table w-full" aria-label="Attempts">
              <thead>
                <tr>
                  <th>When</th>
                  <th>{individual ? 'Player' : 'Team'}</th>
                  <th>Challenge</th>
                  <th>Submitted</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {submissions.rows.map((x) => (
                  <tr key={x.submissionID}>
                    <td className="whitespace-nowrap text-[12px]">{formatTs(x.createdDate)}</td>
                    <td>
                      {teamName(x.teamID)}
                      {!individual && <div className="text-[11px] text-fg-3">{playerText(x.playerID)}</div>}
                    </td>
                    <td>{challengeTitle(x.challengeID)}</td>
                    <td className="max-w-64 break-all font-mono text-[12px]">{x.submittedText}</td>
                    <td><Result submission={x} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <LoadMore list={submissions} label="Older" />
      </section>
    </div>
  )
}

function FilterSelect({ id, label, value, options, onChange, all = 'All' }) {
  return (
    <div className="flex flex-col gap-1 text-[13px]">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{all}</option>
        {options.map(([v, text]) => <option key={v} value={v}>{text}</option>)}
      </select>
    </div>
  )
}

function Result({ submission: x }) {
  if (!isBlank(x.reversedBy)) {
    return (
      <span className="text-[12px]">
        <span className="font-medium text-warning-fg">Reversed</span>
        <span className="block text-fg-3">{x.reverseReason} ({x.reversedBy}, {formatTs(x.reversedDate)})</span>
      </span>
    )
  }
  return isYes(x.isCorrect)
    ? <span className="font-medium text-success-fg">Right</span>
    : <span className="text-fg-2">Wrong</span>
}

// A solve with "Reverse", which asks for the reason in the row
function SolveRow({ solve, text, closed, onReverse }) {
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [state, setState] = useState({ busy: false, error: null })
  const id = `reason-${solve.challengeID}-${solve.teamID}`

  async function submit(e) {
    e.preventDefault()
    if (!reason.trim()) return
    setState({ busy: true, error: null })
    try {
      await onReverse(reason.trim())
    } catch (err) {
      setState({ busy: false, error: err.isWrongState && err.infoMessage ? `${err.infoMessage}.` : err })
    }
  }

  return (
    <li className="flex flex-col gap-2 rounded-md bg-surface-2 px-4 py-2 text-[13px]">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex-1">{text}</span>
        <span className="text-[12px] text-fg-3">{formatTs(solve.createdDate)}</span>
        {!closed && !asking && (
          <button type="button" className="btn-secondary" aria-label={`Reverse ${text}`} onClick={() => setAsking(true)}>
            <i className="ti ti-arrow-back-up" aria-hidden="true" />
            Reverse
          </button>
        )}
      </div>
      {asking && (
        <form className="flex flex-wrap items-end gap-2" onSubmit={submit} aria-label={`Reverse ${text}`}>
          {state.error && <div className="w-full"><ErrorBanner error={state.error} /></div>}
          <div className="flex min-w-64 flex-1 flex-col gap-1">
            <label htmlFor={id}>Reason (kept with the attempt)</label>
            <input id={id} className="input" value={reason} maxLength={255} onChange={(e) => setReason(e.target.value)} />
          </div>
          <button type="submit" className="btn-danger" disabled={state.busy || !reason.trim()}>Reverse solve</button>
          <button type="button" className="btn-secondary" disabled={state.busy} onClick={() => setAsking(false)}>Cancel</button>
        </form>
      )}
    </li>
  )
}
