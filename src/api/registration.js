import { apiRequest } from './client'

const enc = encodeURIComponent

// R1: a new player with a place in the event. Answers registrationID and the
// one-time claimToken, which the registrant needs for R3.
export function register({ eventID, regCode, displayName }) {
  return apiRequest('POST', '/registrations', { body: { eventID: Number(eventID), regCode, displayName } })
}

// R2: P pending, R ready, F failed (and A, V, X later on)
export function registrationStatus(registrationID) {
  return apiRequest('GET', `/registrations/${enc(registrationID)}`)
}

// R3: the chosen passphrase replaces the one-time one in RACF; answers the userid
export function activate(registrationID, { claimToken, passphrase }) {
  return apiRequest('POST', `/activations/${enc(registrationID)}`, { body: { claimToken, passphrase } })
}
