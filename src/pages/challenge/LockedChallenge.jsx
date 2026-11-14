import { Link } from 'react-router'
import { challenges, prerequisites } from '../../api/lists'
import ErrorBanner from '../../components/ErrorBanner'
import { useFullList } from '../../hooks/useFullList'
import { isYes } from '../../lib/codes'
import { linkTo, PATHS } from '../../routes'

// P5, locked: the challenges to solve first. GET /challenges/{id} refuses a
// locked challenge, so its title and value come from the board.
export default function LockedChallenge({ eventID, challengeID, playMode }) {
  const reqs = useFullList(prerequisites, { eventID, challengeID })
  const board = useFullList(challenges, { eventID })
  const row = board.rows.find((c) => String(c.challengeID) === String(challengeID))

  return (
    <article className="card flex flex-col gap-4 p-6">
      <header className="flex flex-col gap-1">
        {row && <div className="text-[12px] uppercase tracking-wide text-fg-3">{row.categoryName || row.category}</div>}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[19px] font-medium">{row?.challengeTitle ?? 'Locked challenge'}</h1>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-3 px-2 py-0.5 text-[11px] font-medium text-fg-2">
            <i className="ti ti-lock" aria-hidden="true" />
            Locked
          </span>
        </div>
        {row && <div className="text-[13px] text-fg-2">{row.currentPoints} points</div>}
      </header>
      {reqs.error && <ErrorBanner error={reqs.error} onRetry={reqs.reload} />}
      {reqs.loaded && (
        <div className="flex flex-col gap-2 text-[13px]">
          <p>This challenge opens once {playMode === 'I' ? 'you have' : 'your team has'} solved:</p>
          <ul className="flex flex-col gap-1">
            {reqs.rows.map((r) => (
              <li key={r.reqChallengeID} className="flex items-center gap-2">
                {isYes(r.isSolved) ? (
                  <>
                    <i className="ti ti-circle-check text-success-fg" aria-hidden="true" />
                    <span className="sr-only">Solved:</span>
                  </>
                ) : (
                  <>
                    <i className="ti ti-circle text-fg-3" aria-hidden="true" />
                    <span className="sr-only">Not solved yet:</span>
                  </>
                )}
                {r.challengeTitle ? (
                  <Link className="underline" to={linkTo(PATHS.challenge, { eventID, challengeID: r.reqChallengeID })}>
                    {r.challengeTitle}
                  </Link>
                ) : (
                  <span className="text-fg-2">A challenge that isn&apos;t on the board yet</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}
