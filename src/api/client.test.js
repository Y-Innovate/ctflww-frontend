import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, apiRequest, normalize, setUnauthorizedHandler, toQueryString } from './client'
import { err, ok, stubFetch } from '../test/fetchStub'

afterEach(() => vi.unstubAllGlobals())

describe('helpers', () => {
  it('builds query strings without empty values', () => {
    expect(toQueryString({ a: 1, b: '', c: undefined, d: null, e: 'x y' })).toBe('?a=1&e=x+y')
    expect(toQueryString({})).toBe('')
  })

  it('trims blank padding and makes null an empty string', () => {
    expect(normalize({ a: 'X  ', b: [{ c: '   ', d: null }], n: 3, z: 0 }))
      .toEqual({ a: 'X', b: [{ c: '', d: '' }], n: 3, z: 0 })
  })
})

describe('apiRequest', () => {
  it('calls /ctf/API/v1 with the query and a JSON body', async () => {
    const calls = stubFetch(() => ({ status: 201, body: ok({ teamID: 7, teamName: 'Root  ' }) }))
    const data = await apiRequest('POST', '/teams', { query: { x: 1 }, body: { eventID: 1, teamName: 'Root' } })
    expect(data).toMatchObject({ teamID: 7, teamName: 'Root' })
    expect(calls[0]).toEqual({
      method: 'POST', path: '/ctf/API/v1/teams', query: { x: '1' }, body: { eventID: 1, teamName: 'Root' },
    })
    expect(fetch.mock.calls[0][1].credentials).toBe('same-origin')
  })

  it('throws ApiError with the backend codes and message', async () => {
    stubFetch(() => err(409, '08', '54', 'Already solved by your team  '))
    const e = await apiRequest('POST', '/submissions', { body: {} }).catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toMatchObject({ status: 409, retCode: '08', reasonCode: '54' })
    expect(e.isAlreadySolved).toBe(true)
    expect(e.isAttemptsUsedUp).toBe(false)
    expect(e.message).toBe('Not possible right now: Already solved by your team')
  })

  it('knows not found only for 404 with 04', async () => {
    stubFetch(() => err(404, '04', '01', 'Event not found'))
    expect((await apiRequest('GET', '/events/9').catch((x) => x)).isNotFound).toBe(true)
    stubFetch(() => err(404, '08', '13'))
    expect((await apiRequest('POST', '/teams').catch((x) => x)).isNotFound).toBe(false)
  })

  it('knows a missing session: 401, or a 404 that is not from the backend', async () => {
    stubFetch(() => ({ status: 404, body: '' }))
    expect((await apiRequest('GET', '/me', { signInOn401: false }).catch((x) => x)).isNoSession).toBe(true)
    stubFetch(() => ({ status: 401, body: '' }))
    expect((await apiRequest('GET', '/me', { signInOn401: false }).catch((x) => x)).isNoSession).toBe(true)
    stubFetch(() => err(404, '04', '01', 'Event not found'))
    expect((await apiRequest('GET', '/events/9').catch((x) => x)).isNoSession).toBe(false)
  })

  it('copes with a body that is not JSON', async () => {
    stubFetch(() => ({ status: 500, body: 'CICS abend' }))
    const e = await apiRequest('GET', '/me', { signInOn401: false }).catch((x) => x)
    expect(e.message).toBe('Backend error: CICS abend')
  })

  it('reports an unreachable backend as 502', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('network') }))
    const e = await apiRequest('GET', '/events').catch((x) => x)
    expect(e).toMatchObject({ status: 502, message: 'Backend not reachable' })
  })

  it('sends a 404 without envelope to sign-in only when the session is gone', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    stubFetch(() => ({ status: 404, body: '' }))
    await expect(apiRequest('GET', '/myEvents')).rejects.toMatchObject({ status: 404 })
    expect(handler).toHaveBeenCalledTimes(1)
    // Signed in, but the path isn't on LWW: an error, no sign-in
    stubFetch(({ path }) => (path.endsWith('/me') ? { body: ok({ role: 'P' }) } : { status: 404, body: '' }))
    await expect(apiRequest('GET', '/notThere')).rejects.toMatchObject({ status: 404 })
    expect(handler).toHaveBeenCalledTimes(1)
    // A 404 of the backend itself: no question asked
    const calls = stubFetch(() => err(404, '04', '01', 'Challenge not found'))
    await expect(apiRequest('GET', '/challenges/9')).rejects.toMatchObject({ retCode: '04' })
    expect(calls).toHaveLength(1)
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('sends a 401 to sign-in, unless the caller handles it', async () => {
    const handler = vi.fn()
    setUnauthorizedHandler(handler)
    stubFetch(() => ({ status: 401, body: '' }))
    await expect(apiRequest('GET', '/myEvents')).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledTimes(1)
    await expect(apiRequest('GET', '/me', { signInOn401: false })).rejects.toMatchObject({ status: 401 })
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
