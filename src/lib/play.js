// Why a player can't see the challenges of an event yet, or null. The
// backend refuses in these cases too (08 50, 08 53); asking first gives a
// better message. event: GET /events/{id}; place: the player's row of
// GET /myEvents (null when not joined, see useMyPlace).
export function whyBlocked(event, place) {
  if (place === null) return 'notJoined'
  if (place.partStatus === 'P') return 'pending'
  if (event.playMode === 'T' && !place.teamID) return 'noTeam'
  if (event.phase === 'U') return 'notStarted'
  return null
}

// Only web links become clickable; anything else (javascript:, data:) is
// shown as text.
export function isWebUrl(url) {
  return /^https?:\/\/[^\s]+$/i.test(String(url ?? '').trim())
}

// "from your team" or, in an individual event, "from your score"
export function whoPays(playMode) {
  return playMode === 'I' ? 'your score' : 'your team'
}
