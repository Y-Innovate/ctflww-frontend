import { apiRequest, BASE, LOGIN_PATH } from './client'

// The signed-in user (GET /me, CTFC290): role P for a player, A for an
// organizer, or null without a session. Doesn't send the user to sign-in.
// Without a session LWW answers 404 on t01 (see ApiError.isNoSession).
export async function fetchMe() {
  try {
    return await apiRequest('GET', '/me', { signInOn401: false })
  } catch (err) {
    if (err.isNoSession) return null
    throw err
  }
}

// The sign-in page, returning to `returnTo` (a path under /ctf) afterwards
export function signInHref(returnTo) {
  return returnTo ? `${LOGIN_PATH}?returnTo=${encodeURIComponent(returnTo)}` : LOGIN_PATH
}

// Sign-out: LWW's page logout.html, whose pre-exec program (LWWADPLO) ends
// the session on LWW before the page says so. A full page load, so the app
// forgets the user too.
export const SIGN_OUT_URL = `${BASE}/logout.html`

// Where the organizer sign-in starts: LWW's Entra redirect
export const ORGANIZER_SIGN_IN_URL = `${BASE}/redirect_to_sso_login.html`
