import { apiRequest } from './client'

// P2: join another event with its code. Answers eventID, partStatus (A, or P
// while a RACF CONNECT job runs) and teamID (the team of one, individual).
export function joinEvent({ eventID, regCode }) {
  return apiRequest('POST', '/participants', { body: { eventID: Number(eventID), regCode } })
}

// P3: EXEC CICS CHANGE PHRASE for the signed-in userid
export function changePassphrase({ currentPassphrase, newPassphrase }) {
  return apiRequest('PUT', '/myPassphrase', { body: { currentPassphrase, newPassphrase } })
}
