import { useSearchParams } from 'react-router'
import { adminEvents } from '../../api/admin'
import { useFullList } from '../../hooks/useFullList'
import { JOB_STATUS } from '../../lib/codes'
import JobsList from './JobsList'

// A6: follow the provisioning jobs, by status, event or player (filters in
// the query string), and retry failed ones
export default function Jobs() {
  const [params, setParams] = useSearchParams()
  const events = useFullList(adminEvents, {})
  const status = params.get('status') ?? ''
  const event = params.get('event') ?? ''
  const player = params.get('player') ?? ''
  const filters = {
    ...(status && { jobStatus_filter: status }),
    ...(event && { eventID_filter: event }),
    ...(player && { playerID_filter: player }),
  }
  const setFilter = (key, value) => {
    const next = new URLSearchParams(params)
    if (value) next.set(key, value)
    else next.delete(key)
    setParams(next, { replace: true })
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-[17px] font-medium">Provisioning jobs</h1>
      <p className="text-[13px] text-fg-2">
        The RACF jobs behind registrations, places, resets, revokes and closing. Removals from a group are queued for the
        scheduled batch; the others are submitted at once.
      </p>
      <div className="flex flex-wrap items-end gap-3" role="group" aria-label="Filters">
        <div className="flex flex-col gap-1 text-[13px]">
          <label htmlFor="jobs-status">Status</label>
          <select id="jobs-status" className="input" value={status} onChange={(e) => setFilter('status', e.target.value)}>
            <option value="">Any</option>
            {Object.entries(JOB_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 text-[13px]">
          <label htmlFor="jobs-event">Event</label>
          <select id="jobs-event" className="input" value={event} onChange={(e) => setFilter('event', e.target.value)}>
            <option value="">Any</option>
            {events.rows.map((e) => <option key={e.eventID} value={e.eventID}>{e.eventName}</option>)}
          </select>
        </div>
        {player && (
          <button type="button" className="btn-secondary" onClick={() => setFilter('player', '')}>
            Player {player}
            <i className="ti ti-x" aria-hidden="true" />
          </button>
        )}
      </div>
      <JobsList key={JSON.stringify(filters)} filters={filters} />
    </section>
  )
}
