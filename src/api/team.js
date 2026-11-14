import { apiRequest } from './client'

// P8: the team's score, solves, hints and members; the join code only for
// the captain
export function getProgress(eventID) {
  return apiRequest('GET', `/progress/${encodeURIComponent(eventID)}`)
}

// T1: answers teamID, teamName and joinCode; the player becomes captain
export function createTeam({ eventID, teamName }) {
  return apiRequest('POST', '/teams', { body: { eventID: Number(eventID), teamName } })
}

// T2
export function joinTeam({ eventID, joinCode }) {
  return apiRequest('POST', '/teamMembers', { body: { eventID: Number(eventID), joinCode } })
}

// T3 (own playerID) and T4 (captain removes a member); before the start only
export function removeMember({ eventID, playerID }) {
  return apiRequest('DELETE', `/teamMembers/${encodeURIComponent(playerID)}`, { query: { eventID } })
}

// T4: hand captaincy to a member
export function handOverCaptaincy({ eventID, playerID }) {
  return apiRequest('PUT', `/teamCaptains/${encodeURIComponent(eventID)}`, { body: { playerID: Number(playerID) } })
}
