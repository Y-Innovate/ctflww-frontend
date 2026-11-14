import { act, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../api/client'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const cardOf = async (title) => screen.findByRole('link', { name: new RegExp(`^${title}`) })

describe('the challenge board', () => {
  it('groups the challenges by category, in the organizers\' order', async () => {
    stubBackend({ user: 'CTF0001' }) // Alice, Root Access
    openApp('/board?eventID=1')
    await cardOf('Hello mainframe')
    const groups = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(groups).toEqual(['z/OS', 'Web', 'Cryptography'])
    const zos = screen.getByRole('region', { name: 'z/OS' })
    expect(within(zos).getAllByRole('link').map((l) => l.textContent.split(/Solved|Locked|\d/)[0]))
      .toEqual(['Hello mainframe', 'JCL detective', 'RACF riddle', 'The final boss'])
    expect(screen.getByText('3 of 7 solved')).toBeInTheDocument()
    expect(screen.queryByText('Lost in the logs')).not.toBeInTheDocument() // hidden
  })

  it('shows value, solves and the marks for solved and locked', async () => {
    stubBackend({ user: 'CTF0001' })
    openApp('/board?eventID=1')
    const hello = await cardOf('Hello mainframe')
    expect(hello).toHaveTextContent('Solved')
    expect(hello).toHaveTextContent('100 points')
    expect(hello).toHaveTextContent('3 solves')
    expect(hello).toHaveAttribute('href', '/ctf/challenge?eventID=1&challengeID=1')
    const boss = await cardOf('The final boss')
    expect(boss).toHaveTextContent('Locked')
    expect(boss).not.toHaveTextContent('Solved')
    expect(await cardOf('JCL detective')).toHaveTextContent('0 solves')
  })

  it('says the board is frozen, with the player\'s own late solves', async () => {
    stubBackend({ user: 'CTF0004' }) // Dave solved 6 after the freeze
    openApp('/board?eventID=2')
    const ebcdic = await cardOf('EBCDIC or bust')
    expect(screen.getByText(/scoreboard is frozen since/i)).toBeInTheDocument()
    expect(ebcdic).toHaveTextContent('Solved')
    expect(ebcdic).toHaveTextContent('0 solves')
  })

  it('says when the event has ended', async () => {
    stubBackend({ user: 'CTF0001' })
    openApp('/board?eventID=4')
    await cardOf('Hello mainframe')
    expect(screen.getByText(/the event has ended/i)).toBeInTheDocument()
  })

  it('sends a player without a team to the team page', async () => {
    const { calls } = stubBackend({ user: 'CTF0003' }) // Carol
    openApp('/board?eventID=1')
    expect(await screen.findByText(/you need a team to play/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /create or join one/i })).toHaveAttribute('href', '/ctf/team?eventID=1')
    expect(calls.some((c) => c.path === '/challenges')).toBe(false)
  })

  it('says when the event starts', async () => {
    const { db } = stubBackend({ user: 'CTF0001' })
    const spring = db.data.events.find((e) => e.eventID === 1)
    spring.startTS = '2999-01-01-10.00.00.000000'
    spring.endTS = '2999-01-02-10.00.00.000000'
    openApp('/board?eventID=1')
    expect(await screen.findByText(/the event starts at/i)).toBeInTheDocument()
  })

  it('says when the player is not in the event, or still waits for a job', async () => {
    stubBackend({ user: 'CTF0002' }) // Bob is only in event 1
    const { unmount } = openApp('/board?eventID=2')
    expect(await screen.findByText(/haven't joined this event/i)).toBeInTheDocument()
    unmount()
    vi.unstubAllGlobals()

    stubBackend({ user: 'CTF0005' }) // Erin, pending in 3
    openApp('/board?eventID=3')
    expect(await screen.findByText(/waits for its RACF job/i)).toBeInTheDocument()
  })

  it('asks for an event without an eventID', async () => {
    stubBackend({ user: 'CTF0001' })
    openApp('/board')
    expect(await screen.findByText(/pick an event first/i)).toBeInTheDocument()
  })

  it('refreshes itself every minute while the event runs', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    const { db } = stubBackend({ user: 'CTF0001' })
    openApp('/board?eventID=1')
    expect(await cardOf('JCL detective')).toHaveTextContent('0 solves')
    db.data.solves.push({ eventID: 1, challengeID: 2, teamID: 3, playerID: 8, submissionID: 99, createdDate: '2000-01-01-00.00.00.000000' })
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    await vi.waitFor(() => expect(screen.getByRole('link', { name: /^JCL detective/ })).toHaveTextContent('1 solve'))
  })
})
