import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { adminEvents, adminPlayers } from '../../api/admin'
import ErrorBanner from '../../components/ErrorBanner'
import LoadMore from '../../components/LoadMore'
import { useFullList } from '../../hooks/useFullList'
import { usePagedList } from '../../hooks/usePagedList'
import { REGISTRATION_STATUS } from '../../lib/codes'
import { ADMIN_PATHS, linkTo } from '../../routes'
import PlayerStatus from './PlayerStatus'

const FILTERS = [['name', 'displayName_filter'], ['userid', 'racfUserid_filter'], ['status', 'playerStatus_filter'],
  ['event', 'eventID_filter']]

// A5: find players by display name or userid (from the start, any case),
// status, or a place in an event. The filters are in the query string.
export default function Players() {
  const [params, setParams] = useSearchParams()
  const events = useFullList(adminEvents, {})
  const filters = Object.fromEntries(FILTERS.filter(([k]) => params.get(k)).map(([k, api]) => [api, params.get(k)]))
  const list = usePagedList(adminPlayers, filters)
  const [form, setForm] = useState(() => Object.fromEntries(FILTERS.map(([k]) => [k, params.get(k) ?? ''])))
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  function search(e) {
    e.preventDefault()
    setParams(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v)), { replace: true })
  }

  return (
    <section className="flex flex-col gap-4">
      <h1 className="text-[17px] font-medium">Players</h1>
      <form className="card flex flex-wrap items-end gap-3 p-4" onSubmit={search} aria-label="Find players">
        <div className="flex flex-col gap-1 text-[13px]">
          <label htmlFor="find-name">Display name starts with</label>
          <input id="find-name" className="input" value={form.name} onChange={set('name')} />
        </div>
        <div className="flex flex-col gap-1 text-[13px]">
          <label htmlFor="find-userid">Userid starts with</label>
          <input id="find-userid" className="input w-32 font-mono uppercase" value={form.userid} maxLength={8} onChange={set('userid')} />
        </div>
        <div className="flex flex-col gap-1 text-[13px]">
          <label htmlFor="find-status">Status</label>
          <select id="find-status" className="input" value={form.status} onChange={set('status')}>
            <option value="">Any</option>
            {Object.entries(REGISTRATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-1 text-[13px]">
          <label htmlFor="find-event">Plays in</label>
          <select id="find-event" className="input" value={form.event} onChange={set('event')}>
            <option value="">Any event</option>
            {events.rows.map((e) => <option key={e.eventID} value={e.eventID}>{e.eventName}</option>)}
          </select>
        </div>
        <button type="submit" className="btn-primary">
          <i className="ti ti-search" aria-hidden="true" />
          Search
        </button>
      </form>

      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && list.rows.length === 0 && <p className="card p-6 text-fg-2">No players found.</p>}
      {list.rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="data-table w-full" aria-label="Players found">
            <thead>
              <tr>
                <th className="w-12">ID</th>
                <th>Userid</th>
                <th>Display name</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((p) => (
                <tr key={p.playerID}>
                  <td className="tabular-nums text-fg-3">{p.playerID}</td>
                  <td className="font-mono">
                    <Link className="hover:underline" to={linkTo(ADMIN_PATHS.player, { playerID: p.playerID })}>{p.racfUserid}</Link>
                  </td>
                  <td>{p.displayName}</td>
                  <td><PlayerStatus status={p.playerStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore list={list} label="Next 20" />
    </section>
  )
}
