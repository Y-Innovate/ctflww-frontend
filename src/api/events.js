import { apiRequest } from './client'

const enc = encodeURIComponent

// GET /events/{eventID}: a published or closed event, with its description
export function getEvent(eventID) {
  return apiRequest('GET', `/events/${enc(eventID)}`)
}
