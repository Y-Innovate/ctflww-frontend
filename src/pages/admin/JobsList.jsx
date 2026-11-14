import { useState } from 'react'
import { Link } from 'react-router'
import { adminEvents, provisioningJobs, retryJob } from '../../api/admin'
import { PAGE_SIZE } from '../../api/lists'
import ConfirmButton from '../../components/ConfirmButton'
import ErrorBanner from '../../components/ErrorBanner'
import LoadMore from '../../components/LoadMore'
import { useFullList } from '../../hooks/useFullList'
import { usePagedList } from '../../hooks/usePagedList'
import { usePolling } from '../../hooks/usePolling'
import { JOB_STATUS, label, PROV_ACTION } from '../../lib/codes'
import { formatTs, isBlank } from '../../lib/timestamps'
import { ADMIN_PATHS, linkTo } from '../../routes'
import ClaimTokenNote from './ClaimTokenNote'

const REFRESH_MS = 30_000
const OPEN = ['N', 'Q', 'S']
const STYLE = {
  D: 'bg-success-bg text-success-fg',
  F: 'bg-danger-bg text-danger-fg',
  S: 'bg-info-bg text-info-fg',
  N: 'bg-warning-bg text-warning-fg',
  Q: 'bg-warning-bg text-warning-fg',
}

// A6: provisioning jobs newest first (CTFM404) with retry of a failed one
// (CTFM520). filters: the API's *_filter fields. showPlayer: a column with a
// link to the player (not on the player's own page). Refreshes every 30 s
// while a job on the first page is open.
export default function JobsList({ filters, showPlayer = true, onRetried }) {
  const list = usePagedList(provisioningJobs, filters)
  const events = useFullList(adminEvents, {})
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const eventName = (id) => events.rows.find((e) => e.eventID === id)?.eventName ?? `Event ${id}`

  const anyOpen = list.rows.some((j) => OPEN.includes(j.jobStatus))
  usePolling(() => {
    if (!list.loading && list.rows.length <= PAGE_SIZE) list.reload()
  }, REFRESH_MS, anyOpen)

  async function retry(job) {
    setError(null)
    setResult(null)
    try {
      const r = await retryJob(job.provJobID)
      // A new claim token lives in this state only: never stored or logged
      setResult({ ...r, playerID: job.playerID })
      await list.reload()
      onRetried?.()
    } catch (err) {
      setError(err.isWrongState && err.infoMessage ? `${err.infoMessage}.` : err)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {result && (isBlank(result.claimToken)
        ? (
          <p role="status" className="rounded-md bg-success-bg px-4 py-2.5 text-[13px] text-success-fg">
            Job {result.provJobID} is {label(JOB_STATUS, result.jobStatus).toLowerCase()} again
            {result.jobStatus === 'Q' ? ': the batch carries it out.' : '.'}
          </p>
        )
        : <ClaimTokenNote claimToken={result.claimToken} provJobID={result.provJobID} playerID={result.playerID} />)}
      {(list.error || error) && <ErrorBanner error={list.error || error} onRetry={list.error ? list.reload : undefined} />}
      {!list.loading && !list.error && list.rows.length === 0 && <p className="card p-6 text-fg-2">No jobs.</p>}
      {list.rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="data-table w-full" aria-label="Jobs">
            <thead>
              <tr>
                <th className="w-12">ID</th>
                <th>Action</th>
                {showPlayer && <th>Player</th>}
                <th>Status</th>
                <th>JES job</th>
                <th>Result</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.rows.map((j) => (
                <tr key={j.provJobID}>
                  <td className="tabular-nums text-fg-3">{j.provJobID}</td>
                  <td>
                    {label(PROV_ACTION, j.provAction)}
                    {(j.eventID > 0 || !isBlank(j.racfGroup)) && (
                      <div className="text-[11px] text-fg-3">
                        {j.eventID > 0 ? eventName(j.eventID) : ''}{!isBlank(j.racfGroup) ? ` · ${j.racfGroup}` : ''}
                      </div>
                    )}
                  </td>
                  {showPlayer && (
                    <td>
                      <Link className="hover:underline" to={linkTo(ADMIN_PATHS.player, { playerID: j.playerID })}>
                        player {j.playerID}
                      </Link>
                    </td>
                  )}
                  <td>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${STYLE[j.jobStatus] ?? ''}`}>
                      {label(JOB_STATUS, j.jobStatus)}
                    </span>
                    {j.retryCount > 0 && <div className="text-[11px] text-fg-3">retried {j.retryCount}×</div>}
                  </td>
                  <td className="whitespace-nowrap text-[12px]">
                    <span className="font-mono">{j.jesJobID}</span>
                    {!isBlank(j.submittedDate) && <div className="text-fg-3">{formatTs(j.submittedDate)}</div>}
                  </td>
                  <td className="max-w-72 text-[12px]">
                    {Number(j.jobRC) >= 0 && <span className="font-mono">RC {j.jobRC}</span>}
                    {!isBlank(j.jobMessage) && <div className="break-words text-fg-2">{j.jobMessage}</div>}
                  </td>
                  <td>
                    {j.jobStatus === 'F' && (
                      <ConfirmButton label={`Retry job ${j.provJobID}`} icon="ti-reload" confirmLabel="Retry"
                        question={retryQuestion(j)} onConfirm={() => retry(j)} />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore list={list} label="Older" />
    </div>
  )
}

function retryQuestion(j) {
  if (j.provAction === 'C' || j.provAction === 'P') {
    return 'Retry? The old one-time passphrase is gone: you get a new claim token to hand over.'
  }
  if (j.provAction === 'M') return 'Retry? The batch carries it out on its next run.'
  return 'Retry this job?'
}
