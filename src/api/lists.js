import { apiRequest } from './client'

// Backend lists return at most 20 rows; the next page is requested with the
// keys of the last row as <key>_since. Fewer than 20 rows means the end.
export const PAGE_SIZE = 20

// path: a string, or a function of the filters for an ID in the path.
// since: [query parameter, field of the last row] pairs.
export function defineList({ path, listKey, since }) {
  const pathOf = typeof path === 'function' ? path : () => path

  // The CTF list modules answer 00 00 with no rows, so a 404 means that the
  // parent (an event, a challenge) wasn't found, and is thrown.
  async function list(filters = {}, sinceKeys = {}) {
    const data = await apiRequest('GET', pathOf(filters), { query: { ...filters, ...sinceKeys } })
    // LWW may send an empty array as null
    const rows = Array.isArray(data[listKey]) ? data[listKey] : []
    const next = rows.length >= PAGE_SIZE ? sinceFrom(rows[rows.length - 1]) : null
    // Fields next to the list, such as isFrozen of the leaderboard
    const { [listKey]: _rows, retCode: _r, reasonCode: _c, infoMessage: _i, ...meta } = data
    return { rows, next, meta }
  }

  function sinceFrom(row) {
    return Object.fromEntries(since.map(([param, field]) => [param, row[field]]))
  }

  async function listAll(filters = {}, maxPages = 50) {
    const all = []
    let sinceKeys = {}
    for (let page = 0; page < maxPages; page++) {
      const { rows, next } = await list(filters, sinceKeys)
      all.push(...rows)
      if (!next) break
      sinceKeys = next
    }
    return all
  }

  return { path, listKey, since, list, listAll }
}

const enc = encodeURIComponent

// Public
export const events = defineList({
  path: '/events', listKey: 'events', since: [['eventID_since', 'eventID']],
})
export const leaderboard = defineList({
  path: ({ eventID }) => `/leaderboard/${enc(eventID)}`,
  listKey: 'leaderboard',
  since: [['rank_since', 'rank']],
})

// Player
export const myEvents = defineList({
  path: '/myEvents', listKey: 'events', since: [['eventID_since', 'eventID']],
})
export const challenges = defineList({
  path: '/challenges',
  listKey: 'challenges',
  since: [['sortOrder_since', 'sortOrder'], ['challengeID_since', 'challengeID']],
})
export const challengeLinks = defineList({
  path: '/challengeLinks', listKey: 'links', since: [['linkID_since', 'linkID']],
})
export const prerequisites = defineList({
  path: '/prerequisites',
  listKey: 'prerequisites',
  since: [['reqChallengeID_since', 'reqChallengeID']],
})
export const hints = defineList({
  path: '/hints',
  listKey: 'hints',
  since: [['sortOrder_since', 'sortOrder'], ['hintID_since', 'hintID']],
})
export const progressSolves = defineList({
  path: '/progressSolves', listKey: 'solves', since: [['challengeID_since', 'challengeID']],
})
export const progressAwards = defineList({
  path: '/progressAwards', listKey: 'awards', since: [['awardID_since', 'awardID']],
})
export const announcements = defineList({
  path: '/announcements', listKey: 'announcements', since: [['announceID_since', 'announceID']],
})
export const teamMembers = defineList({
  path: '/teamMembers', listKey: 'members', since: [['playerID_since', 'playerID']],
})
