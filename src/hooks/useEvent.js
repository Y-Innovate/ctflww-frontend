import { useEffect, useState } from 'react'
import { getEvent } from '../api/events'

// One published or closed event (GET /events/{eventID})
export function useEvent(eventID) {
  const [state, setState] = useState({ eventID: null, event: null, error: null })

  useEffect(() => {
    if (!eventID) return undefined
    let alive = true
    getEvent(eventID).then(
      (event) => alive && setState({ eventID, event, error: null }),
      (error) => alive && setState({ eventID, event: null, error }),
    )
    return () => {
      alive = false
    }
  }, [eventID])

  const current = state.eventID === eventID
  return { event: current ? state.event : null, error: current ? state.error : null, loading: Boolean(eventID) && !current }
}
