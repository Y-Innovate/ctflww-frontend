import { useEffect, useState } from 'react'
import { myEvents } from '../api/lists'

// The player's row of GET /myEvents for an event: undefined while loading
// (or when not a player), null when the player isn't in it.
export function useMyPlace(eventID, isPlayer) {
  const [state, setState] = useState({ key: null, place: undefined })
  const key = isPlayer && eventID ? String(eventID) : null

  useEffect(() => {
    if (!key) return undefined
    let alive = true
    myEvents.listAll().then(
      (rows) => alive && setState({ key, place: rows.find((r) => String(r.eventID) === key) ?? null }),
      () => alive && setState({ key, place: null }),
    )
    return () => {
      alive = false
    }
  }, [key])

  return state.key === key ? state.place : undefined
}
