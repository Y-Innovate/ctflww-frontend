import { adminPlayers } from '../../api/admin'
import { useFullList } from '../../hooks/useFullList'

// The players of an event by ID, for the monitor and the teams: a function
// from playerID to "Display name (USERID)", or "player N" until they are in
export function usePlayerNames(eventID) {
  const players = useFullList(adminPlayers, { eventID_filter: eventID })
  return (playerID) => {
    const p = players.rows.find((x) => x.playerID === playerID)
    return p ? `${p.displayName} (${p.racfUserid})` : `player ${playerID}`
  }
}
