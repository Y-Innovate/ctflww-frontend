import { Link } from 'react-router'
import { progressAwards, progressSolves } from '../../api/lists'
import ErrorBanner from '../../components/ErrorBanner'
import { useFullList } from '../../hooks/useFullList'
import { formatTs } from '../../lib/timestamps'
import { linkTo, PATHS } from '../../routes'

// P8: own solves (who, when, value) and awards and penalties with reasons
export default function Progress({ eventID, teams }) {
  const solves = useFullList(progressSolves, { eventID })
  const awards = useFullList(progressAwards, { eventID })

  return (
    <>
      <section className="card flex flex-col gap-3 p-6" aria-labelledby="solves-title">
        <h2 id="solves-title" className="text-[15px] font-medium">Solves</h2>
        {solves.error && <ErrorBanner error={solves.error} onRetry={solves.reload} />}
        {solves.loaded && solves.rows.length === 0 && (
          <p className="text-[13px] text-fg-2">Nothing solved yet.</p>
        )}
        {solves.rows.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table w-full">
              <thead>
                <tr>
                  <th>Challenge</th>
                  {teams && <th>Solved by</th>}
                  <th>When</th>
                  <th className="text-right">Value</th>
                </tr>
              </thead>
              <tbody>
                {solves.rows.map((s) => (
                  <tr key={s.challengeID}>
                    <td>
                      <Link className="underline" to={linkTo(PATHS.challenge, { eventID, challengeID: s.challengeID })}>
                        {s.challengeTitle}
                      </Link>
                    </td>
                    {teams && <td>{s.solvedBy}</td>}
                    <td>{formatTs(s.solvedDate)}</td>
                    <td className="text-right tabular-nums">{s.currentPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {(awards.error || awards.rows.length > 0) && (
        <section className="card flex flex-col gap-3 p-6" aria-labelledby="awards-title">
          <h2 id="awards-title" className="text-[15px] font-medium">Awards and penalties</h2>
          {awards.error && <ErrorBanner error={awards.error} onRetry={awards.reload} />}
          <ul className="flex flex-col gap-2">
            {awards.rows.map((a) => (
              <li key={a.awardID} className="flex flex-wrap items-baseline gap-x-3 text-[13px]">
                <span className={`w-16 font-medium tabular-nums ${a.points < 0 ? 'text-danger-fg' : 'text-success-fg'}`}>
                  {a.points > 0 ? `+${a.points}` : a.points}
                </span>
                <span className="flex-1">{a.reason}</span>
                <span className="text-[12px] text-fg-3">{formatTs(a.createdDate)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
