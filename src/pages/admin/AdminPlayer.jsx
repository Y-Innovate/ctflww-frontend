import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { deletePlayerUserid, getAdminPlayer, resetPlayer, resumePlayer, revokePlayer } from '../../api/admin'
import ConfirmButton from '../../components/ConfirmButton'
import ErrorBanner from '../../components/ErrorBanner'
import { formatTs, isBlank } from '../../lib/timestamps'
import { ADMIN_PATHS } from '../../routes'
import ClaimTokenNote from './ClaimTokenNote'
import JobsList from './JobsList'
import PlayerStatus from './PlayerStatus'

// A5: one player, with the actions its status allows (CTFM510): reset the
// passphrase (a new claim token, shown once), revoke, resume, delete the
// userid. Each makes a provisioning job; the status changes when it is done.
export default function AdminPlayer() {
  const [params] = useSearchParams()
  const playerID = params.get('playerID')
  if (!playerID) {
    return (
      <p className="card p-6 text-fg-2">
        Pick a player first. <Link className="underline" to={ADMIN_PATHS.players}>Find players</Link>.
      </p>
    )
  }
  return <PlayerPage key={playerID} playerID={playerID} />
}

function usePlayer(playerID) {
  const [state, setState] = useState({ player: null, error: null })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    let alive = true
    getAdminPlayer(playerID).then(
      (player) => alive && setState({ player, error: null }),
      (error) => alive && setState({ player: null, error }),
    )
    return () => {
      alive = false
    }
  }, [playerID, version])
  const reload = useCallback(() => setVersion((v) => v + 1), [])
  return { ...state, reload }
}

// What each status allows, as CTFM510 decides
const ACTIONS = [
  {
    id: 'reset', from: ['A', 'R', 'V'], call: resetPlayer, label: 'Reset passphrase', icon: 'ti-key',
    question: 'Reset the passphrase? A job sets a one-time passphrase; you get a claim token to hand over.',
  },
  {
    id: 'revoke', from: ['A', 'R'], call: revokePlayer, label: 'Revoke', icon: 'ti-user-off', danger: true,
    question: 'Revoke this userid? The player can no longer sign in; scores stay.',
  },
  {
    id: 'resume', from: ['V'], call: resumePlayer, label: 'Resume', icon: 'ti-user-check',
    question: 'Resume this userid? The player can sign in again.',
  },
  {
    id: 'delete', from: ['V'], call: deletePlayerUserid, label: 'Delete userid', icon: 'ti-trash', danger: true,
    question: 'Delete the RACF userid? This can\'t be undone; the player\'s record and scores stay.',
  },
]

function PlayerPage({ playerID }) {
  const { player, error, reload } = usePlayer(playerID)
  const [result, setResult] = useState(null)
  const [actionError, setActionError] = useState(null)
  // Bumped after an action, so the jobs below show the new one
  const [jobsVersion, setJobsVersion] = useState(0)
  const back = <Link className="text-[13px] text-fg-2 underline" to={ADMIN_PATHS.players}>Players</Link>

  if (error) {
    return (
      <section className="flex flex-col gap-4">
        {back}
        {error.isNotFound ? <p className="card p-6 text-fg-2">This player doesn&apos;t exist.</p> : <ErrorBanner error={error} />}
      </section>
    )
  }
  if (!player) return back

  async function run(action) {
    setActionError(null)
    setResult(null)
    try {
      const r = await action.call(playerID)
      // The claim token lives in this state only: never stored or logged
      setResult({ action: action.id, provJobID: r.provJobID, claimToken: r.claimToken })
      reload()
      setJobsVersion((v) => v + 1)
    } catch (err) {
      setActionError(err.isWrongState && err.infoMessage ? `${err.infoMessage}.` : err)
    }
  }

  const allowed = ACTIONS.filter((a) => a.from.includes(player.playerStatus))
  const facts = [
    ['Userid', player.racfUserid],
    ['Display name', player.displayName],
    ['Claim token expires', isBlank(player.claimExpires) ? null : formatTs(player.claimExpires)],
    ['Registered', isBlank(player.createdDate) ? null : formatTs(player.createdDate)],
    ['Last change', isBlank(player.updatedDate) ? null : `${formatTs(player.updatedDate)} by ${player.updatedBy}`],
  ].filter(([, v]) => v)

  return (
    <section className="flex flex-col gap-4">
      {back}
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-[19px] font-medium">{player.displayName}</h1>
        <PlayerStatus status={player.playerStatus} />
        <span className="text-[12px] text-fg-3">Player {player.playerID}</span>
      </header>
      <dl className="card grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 p-6 text-[13px]">
        {facts.map(([k, v]) => (
          <div key={k} className="contents">
            <dt className="text-fg-3">{k}</dt>
            <dd className={k === 'Userid' ? 'font-mono' : ''}>{v}</dd>
          </div>
        ))}
      </dl>

      {result && <ResultNote result={result} player={player} />}

      <section className="card flex flex-col gap-3 p-6" aria-labelledby="player-actions">
        <h2 id="player-actions" className="text-[15px] font-medium">Actions</h2>
        {actionError && <ErrorBanner error={actionError} />}
        {allowed.length === 0 ? (
          <p className="text-[13px] text-fg-2">{noActionText(player.playerStatus)}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allowed.map((a) => (
              <ConfirmButton key={a.id} label={a.label} icon={a.icon} danger={a.danger} confirmLabel={a.label}
                question={a.question} onConfirm={() => run(a)} />
            ))}
          </div>
        )}
        <p className="text-[12px] text-fg-3">
          Each action is a provisioning job; the status changes when the job is done. A player has one open job at a time.
          Organizers never see or set a passphrase.
        </p>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="player-jobs">
        <h2 id="player-jobs" className="text-[15px] font-medium">Jobs of this player</h2>
        <JobsList key={jobsVersion} filters={{ playerID_filter: playerID }} showPlayer={false} onRetried={reload} />
      </section>
    </section>
  )
}

function noActionText(status) {
  if (status === 'P') return 'The userid is being created: wait for its job.'
  if (status === 'F') return 'The job for this userid failed: retry it below.'
  if (status === 'X') return 'The userid is deleted. The record stays for the scores.'
  return 'No actions for this status.'
}

function ResultNote({ result, player }) {
  if (result.action === 'reset') {
    return <ClaimTokenNote claimToken={result.claimToken} provJobID={result.provJobID} playerID={player.playerID}
      playerName={player.displayName} />
  }
  return (
    <p role="status" className="rounded-md bg-success-bg px-4 py-2.5 text-[13px] text-success-fg">
      Job {result.provJobID} is submitted; the status changes when it is done.
    </p>
  )
}
