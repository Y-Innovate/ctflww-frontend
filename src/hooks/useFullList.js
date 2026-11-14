import { useCallback, useEffect, useRef, useState } from 'react'

// Loads every page of a list (src/api/lists.js) at once, for screens that
// group or count the rows, such as the challenge board. reload() fetches
// all pages again and keeps the old rows on screen until the new ones are in.
// enabled: false waits, for instance until the player's place is known.
export function useFullList(resource, filters, { enabled = true } = {}) {
  const [state, setState] = useState({ rows: [], loaded: false, loading: enabled, error: null })
  const filterKey = JSON.stringify(filters ?? {})
  const requestId = useRef(0)

  const fetchAll = useCallback(() => {
    const id = ++requestId.current
    return resource.listAll(JSON.parse(filterKey)).then(
      (rows) => id === requestId.current && setState({ rows, loaded: true, loading: false, error: null }),
      (error) => id === requestId.current && setState((s) => ({ ...s, loading: false, error })),
    )
  }, [resource, filterKey])

  useEffect(() => {
    if (enabled) fetchAll()
  }, [fetchAll, enabled])

  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }))
    return fetchAll()
  }, [fetchAll])

  return { ...state, loading: enabled && state.loading, reload }
}
