import { screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../api/client'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => vi.unstubAllGlobals())

describe('the events list', () => {
  it('shows published and closed events, newest first, without drafts', async () => {
    stubBackend()
    openApp('/')
    await screen.findByText('Spring Team CTF')
    const names = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(names).toEqual(['Winter CTF 2025', 'Autumn Solo CTF', 'Summer Team CTF', 'Frozen Night CTF', 'Spring Team CTF'])
    expect(screen.queryByText('Draft CTF')).not.toBeInTheDocument()
  })

  it('shows phase, play mode and open registration', async () => {
    stubBackend()
    openApp('/')
    const spring = (await screen.findByText('Spring Team CTF')).closest('a')
    expect(within(spring).getByText('Running')).toBeInTheDocument()
    expect(within(spring).getByText('Teams')).toBeInTheDocument()
    expect(within(spring).getByText('Registration open')).toBeInTheDocument()
    expect(spring).toHaveAttribute('href', '/ctf?eventID=1')
    const winter = screen.getByText('Winter CTF 2025').closest('a')
    expect(within(winter).getByText('Closed')).toBeInTheDocument()
    expect(within(winter).queryByText('Registration open')).not.toBeInTheDocument()
    expect(within(screen.getByText('Frozen Night CTF').closest('a')).getByText('Frozen')).toBeInTheDocument()
  })

  it('says so when there are none, and offers no "more" for one page', async () => {
    const { db } = stubBackend()
    db.data.events = []
    openApp('/')
    expect(await screen.findByText(/no events yet/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /older events/i })).not.toBeInTheDocument()
  })

  it('pages through more than 20 events', async () => {
    const { db } = stubBackend()
    const template = db.data.events[0]
    for (let i = 0; i < 20; i++) db.data.events.push({ ...template, eventID: 100 + i, eventName: `Extra ${i}` })
    openApp('/')
    await screen.findByText('Extra 19')
    expect(screen.queryByText('Spring Team CTF')).not.toBeInTheDocument()
    screen.getByRole('button', { name: /older events/i }).click()
    expect(await screen.findByText('Spring Team CTF')).toBeInTheDocument()
  })
})

describe('an event', () => {
  it('offers a visitor to register, or to sign in', async () => {
    stubBackend()
    openApp('/?eventID=1')
    expect(await screen.findByRole('heading', { name: 'Spring Team CTF' })).toBeInTheDocument()
    expect(screen.getByText(/teams of up to four/i)).toBeInTheDocument()
    expect(screen.getByText('Teams of up to 4')).toBeInTheDocument()
    expect(screen.getByText(/\(open now\)/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Register' })).toHaveAttribute('href', '/ctf/register?eventID=1')
    expect(screen.getByRole('link', { name: /have a userid/i }))
      .toHaveAttribute('href', `/ctf/login?returnTo=${encodeURIComponent('/ctf?eventID=1')}`)
    expect(screen.getByRole('link', { name: /leaderboard/i })).toHaveAttribute('href', '/ctf/leaderboard?eventID=1')
  })

  it('shows the freeze, and that registration is closed', async () => {
    stubBackend()
    openApp('/?eventID=2')
    expect(await screen.findByText(/^Frozen since /)).toBeInTheDocument()
    expect(screen.getByText('Individual')).toBeInTheDocument()
    expect(screen.getByText('Registration is closed.')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Register' })).not.toBeInTheDocument()
  })

  it('takes a player in the event to the challenges', async () => {
    stubBackend({ user: 'CTF0001' })
    openApp('/?eventID=1')
    expect(await screen.findByRole('link', { name: /go to the challenges/i })).toHaveAttribute('href', '/ctf/board?eventID=1')
    expect(screen.queryByRole('link', { name: 'Register' })).not.toBeInTheDocument()
  })

  it('lets another player join', async () => {
    stubBackend({ user: 'CTF0004' })
    openApp('/?eventID=1')
    expect(await screen.findByRole('link', { name: /join this event/i })).toHaveAttribute('href', '/ctf/my?join=1')
  })

  it('tells a player with a pending place to wait', async () => {
    stubBackend({ user: 'CTF0005' })
    openApp('/?eventID=3')
    expect(await screen.findByText(/waits for its RACF job/i)).toBeInTheDocument()
  })

  it('offers an organizer only the leaderboard', async () => {
    stubBackend({ user: 'ADMIN01' })
    openApp('/?eventID=1')
    await screen.findByRole('heading', { name: 'Spring Team CTF' })
    await screen.findByText('Organizer')
    expect(screen.queryByRole('link', { name: 'Register' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /join/i })).not.toBeInTheDocument()
  })

  it('says a draft or unknown event does not exist', async () => {
    stubBackend()
    openApp('/?eventID=6')
    expect(await screen.findByText(/doesn't exist, or isn't published yet/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'All events' })).toHaveAttribute('href', '/ctf')
  })
})
