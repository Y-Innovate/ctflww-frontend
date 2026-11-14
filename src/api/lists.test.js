import { afterEach, describe, expect, it, vi } from 'vitest'
import { challenges, events, leaderboard } from './lists'
import { err, ok, stubFetch } from '../test/fetchStub'

afterEach(() => vi.unstubAllGlobals())

const rows = (n, from = 1) =>
  Array.from({ length: n }, (_, i) => ({ challengeID: from + i, sortOrder: 1 + Math.floor((from + i) / 10) }))

describe('lists', () => {
  it('asks for the next page with the keys of the last row', async () => {
    const calls = stubFetch(({ query }) =>
      ({ body: ok({ challenges: query.challengeID_since ? rows(5, 21) : rows(20) }) }))
    const first = await challenges.list({ eventID: 3 })
    expect(first.rows).toHaveLength(20)
    expect(first.next).toEqual({ sortOrder_since: 3, challengeID_since: 20 })
    const second = await challenges.list({ eventID: 3 }, first.next)
    expect(second.next).toBeNull()
    expect(calls[1].query).toEqual({ eventID: '3', sortOrder_since: '3', challengeID_since: '20' })
  })

  it('collects all pages with listAll', async () => {
    stubFetch(({ query }) => ({ body: ok({ challenges: query.challengeID_since ? rows(3, 21) : rows(20) }) }))
    expect(await challenges.listAll({ eventID: 3 })).toHaveLength(23)
  })

  it('takes an empty array sent as null as no rows', async () => {
    stubFetch(() => ({ body: ok({ events: null }) }))
    expect(await events.list()).toEqual({ rows: [], next: null, meta: {} })
  })

  it('puts the event ID in the path of the leaderboard, and keeps isFrozen', async () => {
    const calls = stubFetch(() => ({ body: ok({ isFrozen: 'Y', leaderboard: [] }) }))
    const page = await leaderboard.list({ eventID: 4 })
    expect(calls[0].path).toBe('/ctf/API/v1/leaderboard/4')
    expect(page.meta).toEqual({ isFrozen: 'Y' })
  })

  it('throws a 404: the event itself is unknown', async () => {
    stubFetch(() => err(404, '04', '01', 'Event not found'))
    await expect(leaderboard.list({ eventID: 99 })).rejects.toMatchObject({ status: 404 })
  })
})
