import { useState } from 'react'
import { adminAwards, adminLeaderboard, adminTeams, deleteAward, giveAward } from '../../../api/admin'
import ConfirmButton from '../../../components/ConfirmButton'
import ErrorBanner from '../../../components/ErrorBanner'
import { useFullList } from '../../../hooks/useFullList'
import { formatTs } from '../../../lib/timestamps'
import { usePlayerNames } from '../usePlayerNames'

// A7 (and A4's team view): the teams with size, captain and live score, and
// the awards and penalties: give one, delete one. The admin API has no list
// of a team's members.
export default function Teams({ event }) {
  const eventID = event.eventID
  const teams = useFullList(adminTeams, { eventID })
  const board = useFullList(adminLeaderboard, { eventID })
  const awards = useFullList(adminAwards, { eventID })
  const [error, setError] = useState(null)
  const closed = event.eventStatus === 'C'
  const individual = event.playMode === 'I'
  const word = individual ? 'player' : 'team'

  const playerName = usePlayerNames(eventID)
  const scoreOf = (teamID) => board.rows.find((r) => r.teamID === teamID)
  const teamName = (teamID) => teams.rows.find((t) => t.teamID === teamID)?.teamName ?? `Team ${teamID}`
  const awardsOf = (teamID) => awards.rows.filter((a) => a.teamID === teamID)
  const reload = () => Promise.all([awards.reload(), board.reload()])

  async function remove(awardID) {
    setError(null)
    try {
      await deleteAward(awardID)
      await reload()
    } catch (err) {
      setError(err.isWrongState && err.infoMessage ? `${err.infoMessage}.` : err)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="card flex flex-col gap-3 p-6" aria-labelledby="teams-title">
        <h2 id="teams-title" className="text-[15px] font-medium">{individual ? 'Players' : 'Teams'}</h2>
        {teams.error && <ErrorBanner error={teams.error} onRetry={teams.reload} />}
        {teams.loaded && teams.rows.length === 0 && <p className="text-[13px] text-fg-2">No {word}s yet.</p>}
        {teams.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table w-full" aria-label={individual ? 'Players' : 'Teams'}>
              <thead>
                <tr>
                  <th className="w-14">Rank</th>
                  <th>{individual ? 'Player' : 'Team'}</th>
                  {!individual && <th className="text-right">Members</th>}
                  {!individual && <th>Captain</th>}
                  <th className="text-right">Solves</th>
                  <th className="text-right">Awards</th>
                  <th className="text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {[...teams.rows]
                  .sort((a, b) => (scoreOf(a.teamID)?.rank ?? 1e9) - (scoreOf(b.teamID)?.rank ?? 1e9))
                  .map((t) => {
                    const s = scoreOf(t.teamID)
                    const net = awardsOf(t.teamID).reduce((sum, a) => sum + Number(a.points), 0)
                    return (
                      <tr key={t.teamID}>
                        <td className="tabular-nums">{s?.rank ?? ''}</td>
                        <td className="font-medium">{t.teamName}</td>
                        {!individual && <td className="text-right tabular-nums">{t.memberCount} / {event.maxTeamSize}</td>}
                        {!individual && <td className="text-[12px] text-fg-2">{playerName(t.captainID)}</td>}
                        <td className="text-right tabular-nums">{s?.solveCount ?? ''}</td>
                        <td className={`text-right tabular-nums ${net < 0 ? 'text-danger-fg' : ''}`}>{net === 0 ? '' : net > 0 ? `+${net}` : net}</td>
                        <td className="text-right font-medium tabular-nums">{s?.score ?? ''}</td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-[12px] text-fg-3">Live scores, without the freeze.</p>
      </section>

      <section className="card flex flex-col gap-3 p-6" aria-labelledby="awards-title">
        <h2 id="awards-title" className="text-[15px] font-medium">Awards and penalties</h2>
        <p className="text-[12px] text-fg-3">
          The {word} sees the points and the reason in its progress. They respect the freeze like solves do.
          There is no editing: delete one and give a new one.
        </p>
        {awards.error && <ErrorBanner error={awards.error} onRetry={awards.reload} />}
        {error && <ErrorBanner error={error} />}
        {awards.loaded && awards.rows.length === 0 && <p className="text-[13px] text-fg-2">None yet.</p>}
        {awards.rows.length > 0 && (
          <ul className="flex flex-col gap-1.5" aria-label="Awards">
            {awards.rows.map((a) => (
              <li key={a.awardID} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md bg-surface-2 px-4 py-2 text-[13px]">
                <span className={`w-14 font-medium tabular-nums ${a.points < 0 ? 'text-danger-fg' : 'text-success-fg'}`}>
                  {a.points > 0 ? `+${a.points}` : a.points}
                </span>
                <span className="w-40 font-medium">{teamName(a.teamID)}</span>
                <span className="min-w-0 flex-1">{a.reason}</span>
                <span className="text-[11px] text-fg-3">{a.createdBy}{a.createdDate ? ` · ${formatTs(a.createdDate)}` : ''}</span>
                {!closed && (
                  <ConfirmButton label={`Delete award ${a.awardID}`} icon="ti-trash" danger confirmLabel="Delete"
                    question={`Delete ${a.points > 0 ? '+' : ''}${a.points} for ${teamName(a.teamID)}?`}
                    onConfirm={() => remove(a.awardID)} />
                )}
              </li>
            ))}
          </ul>
        )}
        {!closed && teams.rows.length > 0 && (
          <GiveForm teams={teams.rows} word={word}
            onGive={async (award) => {
              await giveAward({ eventID, ...award })
              await reload()
            }} />
        )}
      </section>
    </div>
  )
}

// The checks of CTFM016, for quick feedback; the backend decides
function problemsOf(v, word) {
  const p = {}
  if (!v.teamID) p.teamID = `Pick a ${word}`
  if (!Number.isInteger(Number(v.points)) || v.points.trim() === '') p.points = 'A whole number'
  else if (Number(v.points) === 0) p.points = 'Not 0'
  if (!v.reason.trim()) p.reason = 'A reason is required'
  else if (v.reason.trim().length > 255) p.reason = 'Up to 255 characters'
  return p
}

function GiveForm({ teams, word, onGive }) {
  const empty = { teamID: '', points: '', reason: '' }
  const [v, setV] = useState(empty)
  const [submitted, setSubmitted] = useState(false)
  const [state, setState] = useState({ busy: false, error: null, done: null })
  const problems = problemsOf(v, word)
  const show = (k) => (submitted ? problems[k] : null)
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setSubmitted(true)
    if (Object.keys(problems).length > 0) return
    setState({ busy: true, error: null, done: null })
    try {
      const points = Number(v.points)
      await onGive({ teamID: Number(v.teamID), points, reason: v.reason.trim() })
      const name = teams.find((t) => String(t.teamID) === v.teamID)?.teamName
      setV(empty)
      setSubmitted(false)
      setState({ busy: false, error: null, done: `${points > 0 ? '+' : ''}${points} for ${name}.` })
    } catch (err) {
      setState({ busy: false, error: err.isWrongState && err.infoMessage ? `${err.infoMessage}.` : err, done: null })
    }
  }

  const field = (k, label, input) => (
    <div className="flex flex-col gap-1 text-[13px]">
      <label htmlFor={`award-${k}`}>{label}</label>
      {input}
      {show(k) && <span className="text-[12px] text-danger-fg">{show(k)}</span>}
    </div>
  )

  return (
    <form className="flex flex-col gap-3 border-t-[0.5px] border-line pt-3" onSubmit={submit} aria-label="Give an award or penalty" noValidate>
      {state.error && <ErrorBanner error={state.error} />}
      {state.done && <p role="status" className="rounded-md bg-success-bg px-4 py-2 text-[13px] text-success-fg">Given: {state.done}</p>}
      <div className="grid gap-3 sm:grid-cols-[12rem_8rem_1fr]">
        {field('teamID', word === 'player' ? 'Player' : 'Team', (
          <select id="award-teamID" className="input" value={v.teamID} onChange={set('teamID')}>
            <option value="">Pick one</option>
            {teams.map((t) => <option key={t.teamID} value={t.teamID}>{t.teamName}</option>)}
          </select>
        ))}
        {field('points', 'Points (negative: penalty)', (
          <input id="award-points" type="number" className="input" value={v.points} onChange={set('points')} />
        ))}
        {field('reason', `Reason (the ${word} sees it)`, (
          <input id="award-reason" className="input" maxLength={255} value={v.reason} onChange={set('reason')} />
        ))}
      </div>
      <button type="submit" className="btn-primary self-start" disabled={state.busy}>Give</button>
    </form>
  )
}
