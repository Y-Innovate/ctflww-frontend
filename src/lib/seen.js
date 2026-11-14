// Announcements a player has seen, per event, in localStorage (P9: "new" is
// remembered in the browser, not in DB2). Only IDs: nothing secret.

const key = (eventID) => `ctf.seenAnnouncements.${eventID}`

export function seenIds(eventID) {
  try {
    const ids = JSON.parse(localStorage.getItem(key(eventID)) ?? '[]')
    return new Set(Array.isArray(ids) ? ids : [])
  } catch {
    return new Set()
  }
}

export function markSeen(eventID, ids) {
  const all = seenIds(eventID)
  for (const id of ids) all.add(id)
  // Newest 200 are plenty: the list shows 20 at a time
  const kept = [...all].sort((a, b) => b - a).slice(0, 200)
  localStorage.setItem(key(eventID), JSON.stringify(kept))
  window.dispatchEvent(new CustomEvent('ctf:seen', { detail: { eventID } }))
}

export function unreadCount(eventID, ids) {
  const seen = seenIds(eventID)
  return ids.filter((id) => !seen.has(id)).length
}
