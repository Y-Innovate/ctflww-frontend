import { useEffect, useState } from 'react'
import { teamMembers } from '../../api/lists'
import { getProgress, handOverCaptaincy, removeMember } from '../../api/team'
import ConfirmButton from '../../components/ConfirmButton'
import CopyButton from '../../components/CopyButton'
import ErrorBanner from '../../components/ErrorBanner'
import { useFullList } from '../../hooks/useFullList'
import { isYes } from '../../lib/codes'
import Progress from './Progress'

// P8 and T3/T4: the team (or, in an individual event, the player) with its
// score, the members and the captain's actions, and the own progress.
// onChange() after an action reloads the whole page.
export default function TeamOverview({ eventID, event, myPlayerID, onChange }) {
  const teams = event.playMode !== 'I'
  const [progress, setProgress] = useState({ data: null, error: null })
  const members = useFullList(teamMembers, { eventID }, { enabled: teams })
  const [actionError, setActionError] = useState(null)

  useEffect(() => {
    let alive = true
    getProgress(eventID).then(
      (data) => alive && setProgress({ data, error: null }),
      (error) => alive && setProgress({ data: null, error }),
    )
    return () => {
      alive = false
    }
  }, [eventID])

  async function act(call) {
    setActionError(null)
    try {
      await call()
      onChange()
    } catch (err) {
      setActionError(err.isWrongState && err.infoMessage ? err.infoMessage : err)
    }
  }

  if (progress.error) return <ErrorBanner error={progress.error} onRetry={onChange} />
  const p = progress.data
  if (!p) return null

  const isCaptain = isYes(p.isCaptain)
  const started = event.phase !== 'U'
  const facts = [
    ['Score', p.score],
    ['Solves', p.solveCount],
    ['Hints unlocked', p.hintCount],
    teams ? ['Members', `${p.memberCount} of ${event.maxTeamSize}`] : null,
  ].filter(Boolean)

  return (
    <>
      <article className="card flex flex-col gap-4 p-6">
        <header className="flex flex-wrap items-center gap-2">
          <h1 className="text-[19px] font-medium">{teams ? p.teamName : 'Your progress'}</h1>
          {teams && isCaptain && (
            <span className="rounded-full bg-info-bg px-2 py-0.5 text-[11px] font-medium text-info-fg">You are captain</span>
          )}
        </header>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k} className="rounded-md bg-surface-2 px-3 py-2">
              <dt className="text-[11px] text-fg-3">{k}</dt>
              <dd className="text-[17px] font-medium tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        {event.phase === 'F' && (
          <p className="rounded-md bg-info-bg px-4 py-2.5 text-[13px] text-info-fg">
            <i className="ti ti-snowflake mr-1.5" aria-hidden="true" />
            The scoreboard is frozen. These are {teams ? 'your team\'s' : 'your'} own numbers, including everything
            after the freeze; the leaderboard shows them once the freeze is lifted.
          </p>
        )}
        {teams && isCaptain && p.joinCode && (
          <div className="flex flex-wrap items-center gap-3 text-[13px]">
            <span className="text-fg-3">Join code</span>
            <code className="rounded bg-surface-2 px-2 py-1 font-mono text-[14px]">{p.joinCode}</code>
            <CopyButton text={p.joinCode} label="Copy join code" />
            <span className="text-[12px] text-fg-3">Share it with your teammates only.</span>
          </div>
        )}
      </article>

      {teams && (
        <section className="card flex flex-col gap-3 p-6" aria-labelledby="members-title">
          <h2 id="members-title" className="text-[15px] font-medium">Members</h2>
          {actionError && <ErrorBanner error={actionError} />}
          {members.error && <ErrorBanner error={members.error} onRetry={members.reload} />}
          <ul className="flex flex-col gap-2">
            {members.rows.map((m) => (
              <Member
                key={m.playerID}
                member={m}
                isMe={String(m.playerID) === String(myPlayerID)}
                iAmCaptain={isCaptain}
                memberCount={p.memberCount}
                started={started}
                onHandOver={() => act(() => handOverCaptaincy({ eventID, playerID: m.playerID }))}
                onRemove={() => act(() => removeMember({ eventID, playerID: m.playerID }))}
              />
            ))}
          </ul>
          {started && (
            <p className="text-[12px] text-fg-3">The event has started: nobody can leave the team or be removed now.</p>
          )}
        </section>
      )}

      <Progress eventID={eventID} teams={teams} />
    </>
  )
}

function Member({ member: m, isMe, iAmCaptain, memberCount, started, onHandOver, onRemove }) {
  const captain = isYes(m.isCaptain)
  let actions = null
  if (isMe && !started) {
    actions = iAmCaptain && memberCount > 1
      ? <span className="text-[12px] text-fg-3">Hand over captaincy before you leave.</span>
      : (
        <ConfirmButton
          label="Leave team"
          icon="ti-logout"
          danger
          question={memberCount <= 1 ? 'You are the last member: the team is deleted. Leave?' : 'Leave this team?'}
          confirmLabel="Leave"
          onConfirm={onRemove}
        />
      )
  } else if (!isMe && iAmCaptain) {
    actions = (
      <>
        <ConfirmButton
          label="Make captain"
          icon="ti-crown"
          question={`Hand captaincy to ${m.displayName}? You stay in the team.`}
          confirmLabel="Hand over"
          onConfirm={onHandOver}
        />
        {!started && (
          <ConfirmButton
            label="Remove"
            icon="ti-user-minus"
            danger
            question={`Remove ${m.displayName} from the team?`}
            confirmLabel="Remove"
            onConfirm={onRemove}
          />
        )}
      </>
    )
  }

  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-surface-2 px-4 py-2.5 text-[13px]">
      <span className="flex flex-1 items-center gap-2">
        <span className="font-medium">{m.displayName}</span>
        {captain && (
          <span className="inline-flex items-center gap-1 text-[11px] text-fg-2">
            <i className="ti ti-crown" aria-hidden="true" />
            Captain
          </span>
        )}
        {isMe && <span className="rounded-full bg-info-bg px-1.5 text-[11px] text-info-fg">you</span>}
      </span>
      {actions && <span className="flex flex-wrap items-center gap-2">{actions}</span>}
    </li>
  )
}
