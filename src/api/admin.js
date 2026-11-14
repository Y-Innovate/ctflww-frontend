import { apiRequest } from './client'
import { defineList } from './lists'

// The organizers' operations (/admin/...; PLAN-ADMIN.md). The backend's admin
// wrappers check the RACF resource CTF.ADMIN and refuse others with 08 50.
// Only the admin pages import this module, so it lands in their chunk.

// ---- Events (CTFM002, CTFM402) ----
// A new event is a DRAFT; publishing needs a visible challenge. Once anyone
// has a place, play mode and RACF group are locked. Only a DRAFT can be
// deleted. A PUT sends every field.

// Every event by ID, drafts and closed ones too; filter eventStatus_filter
export const adminEvents = defineList({
  path: '/admin/events', listKey: 'events', since: [['eventID_since', 'eventID']],
})

export function getAdminEvent(eventID) {
  return apiRequest('GET', `/admin/events/${encodeURIComponent(eventID)}`)
}

export const EVENT_FIELDS = ['eventName', 'eventDescription', 'eventStatus', 'playMode', 'maxTeamSize', 'startTS',
  'endTS', 'freezeTS', 'regCode', 'regFromTS', 'regToTS', 'maxPlayers', 'racfGroup']

const eventBody = (event) => Object.fromEntries(EVENT_FIELDS.map((f) => [f, event[f] ?? '']))

export function createEvent(event) {
  return apiRequest('POST', '/admin/events', { body: { ...eventBody(event), eventStatus: 'D' } })
}

export function updateEvent(eventID, event) {
  return apiRequest('PUT', `/admin/events/${encodeURIComponent(eventID)}`, { body: eventBody(event) })
}

export function deleteEvent(eventID) {
  return apiRequest('DELETE', `/admin/events/${encodeURIComponent(eventID)}`)
}

// A9 (CTFM502): closes a published event after its end (else 08 53) and
// queues the offboarding jobs for the batch: removal from the event's RACF
// group, and a revoke for players without a place in another open event.
// Answers eventID and eventStatus C. A closed event can't change any more.
export function closeEvent(eventID) {
  return apiRequest('POST', `/admin/eventClosures/${encodeURIComponent(eventID)}`)
}

// ---- Reference tables (CTFM001, CTFM401) ----
// Table ID and key are stored in upper case. SETTINGS values must be numbers
// (08 03); SETTINGS keys, and categories and groups in use, can't be deleted (08 53).

export const refTables = defineList({
  path: '/admin/refTables',
  listKey: 'refTables',
  since: [['tableID_since', 'tableID'], ['tabKey_since', 'tabKey']],
})

export function createRefTable({ tableID, tabKey, tabValue }) {
  return apiRequest('POST', '/admin/refTables', { body: { tableID, tabKey, tabValue } })
}

export function updateRefTable({ tableID, tabKey, tabValue }) {
  return apiRequest('PUT', `/admin/refTables/${encodeURIComponent(tableID)}`, { query: { tabKey }, body: { tabValue } })
}

export function deleteRefTable({ tableID, tabKey }) {
  return apiRequest('DELETE', `/admin/refTables/${encodeURIComponent(tableID)}`, { query: { tabKey } })
}

// ---- Library (CTFM007 to CTFM010, CTFM407 to CTFM410) ----
// A challenge's category must be in CATEGORY; type S, no verifier program in
// v1. A challenge in an event can't be deleted; otherwise its flags, hints
// and links go with it. The last flag of a challenge visible in an event and
// a hint that teams unlocked can't be deleted (08 53).

export const libraryChallenges = defineList({
  path: '/admin/challenges', listKey: 'challenges', since: [['challengeID_since', 'challengeID']],
})

export function getLibraryChallenge(challengeID) {
  return apiRequest('GET', `/admin/challenges/${encodeURIComponent(challengeID)}`)
}

const challengeBody = (c) => ({
  challengeTitle: c.challengeTitle, category: c.category, challengeDescription: c.challengeDescription,
  challengeType: 'S', verifierPgm: '',
})

export function createChallenge(challenge) {
  return apiRequest('POST', '/admin/challenges', { body: challengeBody(challenge) })
}

export function updateChallenge(challengeID, challenge) {
  return apiRequest('PUT', `/admin/challenges/${encodeURIComponent(challengeID)}`, { body: challengeBody(challenge) })
}

export function deleteChallenge(challengeID) {
  return apiRequest('DELETE', `/admin/challenges/${encodeURIComponent(challengeID)}`)
}

// Flags, hints and links of one challenge: a list (filter challengeID) and
// create (with challengeID), update and delete by their own ID
function childResource(path, listKey, idKey, fields) {
  const pickFields = (row) => Object.fromEntries(fields.map((f) => [f, row[f]]))
  return {
    idKey,
    list: defineList({ path, listKey, since: [[`${idKey}_since`, idKey]] }),
    create: (challengeID, row) =>
      apiRequest('POST', path, { body: { challengeID: Number(challengeID), ...pickFields(row) } }),
    update: (id, row) => apiRequest('PUT', `${path}/${encodeURIComponent(id)}`, { body: pickFields(row) }),
    remove: (id) => apiRequest('DELETE', `${path}/${encodeURIComponent(id)}`),
  }
}

export const flags = childResource('/admin/flags', 'flags', 'flagID', ['flagValue', 'caseSensitive'])
export const hints = childResource('/admin/hints', 'hints', 'hintID', ['sortOrder', 'hintText', 'cost'])
export const links = childResource('/admin/links', 'links', 'linkID', ['linkName', 'linkUrl'])

// ---- Challenges of an event (CTFM011, CTFM012, CTFM411, CTFM412) ----
// Static scoring (S) uses initPoints only; dynamic (D) needs initPoints >=
// minPoints >= 0 and decaySolves > 0. maxAttempts 0 is no limit. Visible
// needs a flag. Not in a closed event. Taking a challenge out is refused
// once it has submissions or hint unlocks (hide it instead); its
// prerequisites go with it. Prerequisites: both in the event, no cycles.

// Hidden ones too, by challenge ID, with their scoring
export const eventChallenges = defineList({
  path: '/admin/eventChallenges', listKey: 'eventChallenges', since: [['challengeID_since', 'challengeID']],
})

const SCORING = ['scoreType', 'initPoints', 'minPoints', 'decaySolves', 'isVisible', 'sortOrder', 'maxAttempts']
const scoringBody = (row) => Object.fromEntries(SCORING.map((f) => [f, row[f]]))

export function addEventChallenge(eventID, challengeID, scoring) {
  return apiRequest('POST', '/admin/eventChallenges', {
    body: { eventID: Number(eventID), challengeID: Number(challengeID), ...scoringBody(scoring) },
  })
}

export function updateEventChallenge(eventID, challengeID, scoring) {
  return apiRequest('PUT', `/admin/eventChallenges/${encodeURIComponent(challengeID)}`, {
    query: { eventID }, body: scoringBody(scoring),
  })
}

export function removeEventChallenge(eventID, challengeID) {
  return apiRequest('DELETE', `/admin/eventChallenges/${encodeURIComponent(challengeID)}`, { query: { eventID } })
}

// challengeID stays locked until reqChallengeID is solved
export const eventPrerequisites = defineList({
  path: '/admin/prerequisites',
  listKey: 'prerequisites',
  since: [['challengeID_since', 'challengeID'], ['reqChallengeID_since', 'reqChallengeID']],
})

export function addPrerequisite(eventID, challengeID, reqChallengeID) {
  return apiRequest('POST', '/admin/prerequisites', {
    body: { eventID: Number(eventID), challengeID: Number(challengeID), reqChallengeID: Number(reqChallengeID) },
  })
}

export function removePrerequisite(eventID, challengeID, reqChallengeID) {
  return apiRequest('DELETE', `/admin/prerequisites/${encodeURIComponent(challengeID)}`, {
    query: { eventID, reqChallengeID },
  })
}

// ---- Monitor (CTFM314 admin view, CTFM405, CTFM413, CTFM414, CTFM514) ----

// The live board: no freeze, drafts too (CTFC530)
export const adminLeaderboard = defineList({
  path: ({ eventID }) => `/admin/leaderboard/${encodeURIComponent(eventID)}`,
  listKey: 'leaderboard',
  since: [['rank_since', 'rank']],
})

// The teams of an event by ID (in an individual event: a team of one each)
export const adminTeams = defineList({
  path: '/admin/teams', listKey: 'teams', since: [['teamID_since', 'teamID']],
})

// Attempts, newest first; filters teamID_filter, playerID_filter,
// challengeID_filter, isCorrect_filter. A reversed solve keeps isCorrect Y
// and has reversedBy, reversedDate and reverseReason.
export const adminSubmissions = defineList({
  path: '/admin/submissions', listKey: 'submissions', since: [['submissionID_since', 'submissionID']],
})

// Solves by challenge and team; filters teamID_filter, challengeID_filter.
// Reversed solves are gone from this list.
export const adminSolves = defineList({
  path: '/admin/solves',
  listKey: 'solves',
  since: [['challengeID_since', 'challengeID'], ['teamID_since', 'teamID']],
})

// The solve goes (points with it; the team may solve again); refused in a
// closed event. reverseReason is required, up to 255 characters.
export function reverseSolve({ eventID, challengeID, teamID, reverseReason }) {
  return apiRequest('POST', '/admin/solveReversals', {
    body: { eventID: Number(eventID), challengeID: Number(challengeID), teamID: Number(teamID), reverseReason },
  })
}

// ---- Awards and penalties (CTFM016, CTFM416) ----
// Points may be negative, not 0 (08 02); a reason is required, up to 255
// characters (08 03). No update: delete and give a new one. Not in a closed
// event (08 53). Teams see the reason in their progress.

// By award ID; filter teamID_filter
export const adminAwards = defineList({
  path: '/admin/awards', listKey: 'awards', since: [['awardID_since', 'awardID']],
})

export function giveAward({ eventID, teamID, points, reason }) {
  return apiRequest('POST', '/admin/awards', {
    body: { eventID: Number(eventID), teamID: Number(teamID), points: Number(points), reason },
  })
}

export function deleteAward(awardID) {
  return apiRequest('DELETE', `/admin/awards/${encodeURIComponent(awardID)}`)
}

// ---- Announcements (CTFM017, CTFM417) ----
// Title up to 100 (08 02) and body up to 1000 characters (08 03), both
// required. Also on a draft, not in a closed event. A correction keeps the
// publish time (createdDate). Players poll for them every minute.

// Newest first: announceID_since pages downwards
export const adminAnnouncements = defineList({
  path: '/admin/announcements', listKey: 'announcements', since: [['announceID_since', 'announceID']],
})

export function publishAnnouncement({ eventID, announceTitle, announceBody }) {
  return apiRequest('POST', '/admin/announcements', { body: { eventID: Number(eventID), announceTitle, announceBody } })
}

export function correctAnnouncement(announceID, { announceTitle, announceBody }) {
  return apiRequest('PUT', `/admin/announcements/${encodeURIComponent(announceID)}`, { body: { announceTitle, announceBody } })
}

export function deleteAnnouncement(announceID) {
  return apiRequest('DELETE', `/admin/announcements/${encodeURIComponent(announceID)}`)
}

// ---- Players (CTFM403, CTFM503, CTFM510) ----
// Statuses: P pending, R ready, A active, F failed, V revoked, X deleted.
// Reset, revoke, resume and delete each make a provisioning job; the player
// changes when the job reports success. Allowed from: reset A, R or V;
// revoke A or R; resume and delete V (08 53 otherwise, or with an open job).
// A reset answers a new claim token: shown once, never stored or logged.

// By player ID; displayName_filter and racfUserid_filter match the start,
// regardless of case; playerStatus_filter; eventID_filter (a place in it)
export const adminPlayers = defineList({
  path: '/admin/players', listKey: 'players', since: [['playerID_since', 'playerID']],
})

export function getAdminPlayer(playerID) {
  return apiRequest('GET', `/admin/players/${encodeURIComponent(playerID)}`)
}

const playerJob = (method, path) => (playerID) => apiRequest(method, `${path}/${encodeURIComponent(playerID)}`)

// Answers provJobID and claimToken
export const resetPlayer = playerJob('POST', '/admin/playerResets')
// These answer provJobID
export const revokePlayer = playerJob('POST', '/admin/playerRevocations')
export const resumePlayer = playerJob('POST', '/admin/playerResumptions')
// Deletes the RACF userid of a revoked player; the row stays (status X)
export const deletePlayerUserid = playerJob('DELETE', '/admin/players')

// ---- Provisioning jobs (CTFM404, CTFM520) ----
// Actions C create, N connect, M remove, P reset, V revoke, U resume, X
// delete; status N new, Q queued for the batch, S submitted, D done, F
// failed. eventID 0 = no event; jobRC -1 = no return code yet.

// Newest first: provJobID_since pages downwards; filters jobStatus_filter,
// eventID_filter, playerID_filter
export const provisioningJobs = defineList({
  path: '/admin/provisioningJobs', listKey: 'provisioningJobs', since: [['provJobID_since', 'provJobID']],
})

// A failed job goes back to N (a REMOVE to Q, for the batch); refused (08 53)
// unless failed, or with another open job for the player. A CREATE or RESET
// answers a new claim token: the old one-time phrase is gone. Shown once.
export function retryJob(provJobID) {
  return apiRequest('POST', `/admin/jobRetries/${encodeURIComponent(provJobID)}`)
}
