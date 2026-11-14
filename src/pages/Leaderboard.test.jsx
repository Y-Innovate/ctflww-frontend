import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../api/client'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const rowsOf = (table) => within(table).getAllByRole('row').slice(1).map((r) =>
  within(r).getAllByRole('cell').map((c) => c.textContent))

describe('the leaderboard', () => {
  it('ranks the teams of an event with their scores', async () => {
    stubBackend()
    openApp('/leaderboard?eventID=1')
    const table = await screen.findByRole('table')
    expect(within(table).getByRole('columnheader', { name: 'Team' })).toBeInTheDocument()
    expect(rowsOf(table)).toEqual([
      ['1', 'Root Access', '724', '3'],
      ['2', 'Packet Pirates', '709', '3'],
      ['3', 'Null Pointers', '100', '1'],
    ])
    expect(screen.queryByText(/frozen/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Spring Team CTF' })).toHaveAttribute('href', '/ctf?eventID=1')
  })

  it('says when the board is frozen, and pages through 28 players', async () => {
    stubBackend()
    openApp('/leaderboard?eventID=2')
    const table = await screen.findByRole('table')
    expect(screen.getByText(/scoreboard is frozen since/i)).toBeInTheDocument()
    expect(within(table).getByRole('columnheader', { name: 'Player' })).toBeInTheDocument()
    expect(rowsOf(table)).toHaveLength(20)
    await userEvent.click(screen.getByRole('button', { name: 'Next 20' }))
    await vi.waitFor(() => expect(rowsOf(screen.getByRole('table'))).toHaveLength(28))
    expect(screen.queryByRole('button', { name: 'Next 20' })).not.toBeInTheDocument()
  })

  it('marks the team of the signed-in player', async () => {
    stubBackend({ user: 'CTF0002' })
    openApp('/leaderboard?eventID=1')
    const you = await screen.findByText('you')
    expect(you.closest('tr')).toHaveTextContent('Root Access')
  })

  it('says when nobody is on the board yet', async () => {
    stubBackend()
    openApp('/leaderboard?eventID=3')
    expect(await screen.findByText(/nobody is on the board yet/i)).toBeInTheDocument()
  })

  it('says when the event does not exist', async () => {
    stubBackend()
    openApp('/leaderboard?eventID=6')
    expect(await screen.findByText(/doesn't exist, or isn't published yet/i)).toBeInTheDocument()
  })

  it('asks for an event without an eventID', async () => {
    stubBackend()
    openApp('/leaderboard')
    expect(await screen.findByText(/pick an event first/i)).toBeInTheDocument()
  })

  it('refreshes itself every 30 seconds while the event runs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { db } = stubBackend()
    openApp('/leaderboard?eventID=1')
    await screen.findByText('724')
    db.data.awards.push({ awardID: 99, eventID: 1, teamID: 3, points: 1000, reason: 'Test', createdDate: '2000-01-01-00.00.00.000000' })
    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(await screen.findByText('1100')).toBeInTheDocument()
    expect(rowsOf(screen.getByRole('table'))[0][1]).toBe('Null Pointers')
  })

  it('does not refresh an event that has ended', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { calls } = stubBackend()
    openApp('/leaderboard?eventID=4')
    await screen.findByRole('table')
    const before = calls.filter((c) => c.path.startsWith('/leaderboard')).length
    await act(() => vi.advanceTimersByTimeAsync(90_000))
    expect(calls.filter((c) => c.path.startsWith('/leaderboard')).length).toBe(before)
  })
})
