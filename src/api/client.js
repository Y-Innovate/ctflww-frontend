// Thin fetch wrapper for the CTF REST API: same-origin, with LWW's session
// cookie (or the mocks in dev). Every response carries retCode, reasonCode and
// infoMessage; non-2xx responses are thrown as ApiError, so callers can show
// the backend's infoMessage. Codes: ctflww/docs/04-api.md.

export const BASE = '/ctf'
export const API_BASE = `${BASE}/API/v1`
export const LOGIN_PATH = `${BASE}/login`

export class ApiError extends Error {
  constructor(status, data = {}) {
    super(errorText(status, data))
    this.name = 'ApiError'
    this.status = status
    this.retCode = data.retCode ?? ''
    this.reasonCode = data.reasonCode ?? ''
    this.infoMessage = data.infoMessage ?? ''
  }

  is(retCode, reasonCode) {
    return this.retCode === retCode && this.reasonCode === reasonCode
  }

  get isNotFound() {
    return this.status === 404 && this.retCode === '04'
  }

  // No session: 401, or (as LWW answers on t01 for a non-public path) a 404
  // without the backend's envelope. A 404 from the backend has a retCode.
  get isNoSession() {
    return this.status === 401 || (this.status === 404 && !this.retCode)
  }

  get isNotAllowed() {
    return this.is('08', '50')
  }

  get isRegistrationRefused() {
    return this.is('08', '51')
  }

  get isFull() {
    return this.is('08', '52')
  }

  get isWrongState() {
    return this.is('08', '53')
  }

  get isAlreadySolved() {
    return this.is('08', '54')
  }

  get isAttemptsUsedUp() {
    return this.is('08', '55')
  }

  get isPassphraseRefused() {
    return this.is('08', '56')
  }

  get isWrongClaimToken() {
    return this.is('08', '57')
  }
}

const STATUS_TEXT = {
  400: 'Invalid input',
  401: 'Not signed in',
  403: 'Not allowed',
  404: 'Not found',
  409: 'Not possible right now',
  500: 'Backend error',
  502: 'Backend not reachable',
}

function errorText(status, data) {
  const info = data.infoMessage ?? ''
  const base = STATUS_TEXT[status] ?? `HTTP ${status}`
  return info ? `${base}: ${info}` : base
}

// Full page loads (sign-in, LWW pages) go through here, so tests can
// replace them with setNavigator.
let navigate = (url) => window.location.assign(url)

export function goTo(url) {
  navigate(url)
}

export function setNavigator(fn) {
  navigate = fn ?? ((url) => window.location.assign(url))
}

// Sends the browser to the sign-in page, and back here afterwards.
let unauthorizedHandler = () => {
  const here = window.location.pathname + window.location.search
  goTo(`${LOGIN_PATH}?returnTo=${encodeURIComponent(here)}`)
}

// Tests replace the redirect to the sign-in page.
export function setUnauthorizedHandler(fn) {
  unauthorizedHandler = fn
}

export function toQueryString(params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    qs.append(k, String(v))
  }
  const s = qs.toString()
  return s ? `?${s}` : ''
}

// GRAPHIC columns come back blank-padded, and LWW returns an empty text
// field as null: both become trimmed strings, so null and "" are alike.
// Arrays stay arrays; an empty array may come back as null (see lists.js).
export function normalize(value) {
  if (typeof value === 'string') return value.trim()
  if (Array.isArray(value)) return value.map(normalize)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, v === null ? '' : normalize(v)]),
    )
  }
  return value
}

async function readJson(res) {
  const text = await res.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    return { infoMessage: text.slice(0, 200) }
  }
}

// signInOn401: false for calls that are fine without a session (GET /me),
// so a visitor isn't sent to the sign-in page.
export async function apiRequest(method, path, { query, body, signInOn401 = true } = {}) {
  const headers = { Accept: 'application/json' }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  let res
  try {
    res = await fetch(`${API_BASE}${path}${toQueryString(query)}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      credentials: 'same-origin',
    })
  } catch {
    throw new ApiError(502)
  }
  const data = normalize(await readJson(res))
  if (signInOn401 && (res.status === 401 || (res.status === 404 && !data.retCode && (await sessionGone())))) {
    unauthorizedHandler()
  }
  if (!res.ok) throw new ApiError(res.status, data)
  return data
}

// After a 404 without the backend's envelope: is the session gone (GET /me
// answers the same), or is it a path LWW doesn't have? Only the first sends
// the user to sign-in.
async function sessionGone() {
  try {
    const res = await fetch(`${API_BASE}/me`, { headers: { Accept: 'application/json' }, credentials: 'same-origin' })
    if (res.status === 401) return true
    if (res.status !== 404) return false
    const data = await readJson(res)
    return !data.retCode
  } catch {
    return false
  }
}
