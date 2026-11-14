import { apiRequest } from './client'

// P5: one challenge of the board; 08 50 (403) while it is locked
export function getChallenge(eventID, challengeID) {
  return apiRequest('GET', `/challenges/${encodeURIComponent(challengeID)}`, { query: { eventID } })
}

// P7: unlock a hint for the team; answers hintID, cost and hintText
export function unlockHint({ eventID, hintID }) {
  return apiRequest('POST', '/hintUnlocks', { body: { eventID: Number(eventID), hintID: Number(hintID) } })
}

// P6: submit a flag. A wrong flag is no error: isCorrect N, with attemptsLeft
// (-1 = no limit). The flag is never logged or kept.
export function submitFlag({ eventID, challengeID, flag }) {
  return apiRequest('POST', '/submissions', {
    body: { eventID: Number(eventID), challengeID: Number(challengeID), flag },
  })
}
