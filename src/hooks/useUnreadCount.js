import { useEffect, useState } from 'react'
import { announcements } from '../api/lists'
import { unreadCount } from '../lib/seen'

export const POLL_MS = 60_000

// Unread announcements of an event: the newest page, polled every minute,
// against the IDs seen in this browser. Errors leave the count as it was.
export function useUnreadCount(eventID, { enabled = true, pollMs = POLL_MS } = {}) {
  const [state, setState] = useState({ eventID: null, ids: [], tick: 0 })

  useEffect(() => {
    if (!enabled || !eventID) return undefined
    let alive = true
    const load = () =>
      announcements.list({ eventID }).then(
        ({ rows }) => alive && setState((s) => ({ ...s, eventID, ids: rows.map((r) => r.announceID) })),
        () => {},
      )
    load()
    const timer = setInterval(load, pollMs)
    // Recount when the announcements page marks them as seen
    const onSeen = () => setState((s) => ({ ...s, tick: s.tick + 1 }))
    window.addEventListener('ctf:seen', onSeen)
    return () => {
      alive = false
      clearInterval(timer)
      window.removeEventListener('ctf:seen', onSeen)
    }
  }, [eventID, enabled, pollMs])

  if (!enabled || !eventID || state.eventID !== eventID) return 0
  return unreadCount(eventID, state.ids)
}
