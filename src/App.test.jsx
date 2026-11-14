import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { setNavigator, setUnauthorizedHandler } from './api/client'
import { markSeen } from './lib/seen'
import { stubBackend } from './test/backend'

function open(path) {
  window.history.pushState({}, '', `/ctf${path}`)
  return render(<App />)
}

let assign
beforeEach(() => {
  assign = vi.fn()
  setNavigator(assign)
  setUnauthorizedHandler(() => {})
})
afterEach(() => {
  setNavigator(null)
  vi.unstubAllGlobals()
})

describe('a visitor', () => {
  it('sees a sign-in link that returns to the page', async () => {
    stubBackend()
    open('/leaderboard?eventID=2')
    const link = await screen.findByRole('link', { name: /sign in/i })
    expect(link).toHaveAttribute('href', `/ctf/login?returnTo=${encodeURIComponent('/ctf/leaderboard?eventID=2')}`)
    expect(screen.queryByRole('link', { name: 'My events' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /sign out/i })).not.toBeInTheDocument()
  })

  it('sees no error about the session, which LWW answers with 404', async () => {
    stubBackend()
    open('/')
    await screen.findByRole('link', { name: /sign in/i })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('is sent to sign-in from a player page', async () => {
    stubBackend()
    open('/board?eventID=1')
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(
      `/ctf/login?returnTo=${encodeURIComponent('/ctf/board?eventID=1')}`,
    ))
  })
})

describe('a player', () => {
  it('sees their name and My events', async () => {
    stubBackend({ user: 'CTF0001' })
    open('/')
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('CTF0001')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'My events' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /sign in/i })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign out/i })).toHaveAttribute('href', '/ctf/logout.html')
  })

  it('gets the event bar with the unread announcements', async () => {
    stubBackend({ user: 'CTF0001' })
    markSeen('1', [1])
    open('/board?eventID=1')
    const bar = await screen.findByRole('navigation', { name: 'Event' })
    expect(await screen.findByText('Spring Team CTF')).toBeInTheDocument()
    expect(within(bar).getByRole('link', { name: /challenges/i })).toHaveAttribute('aria-current', 'page')
    expect(await within(bar).findByLabelText('2 unread')).toBeInTheDocument()
    expect(within(bar).getByRole('link', { name: /leaderboard/i })).toHaveAttribute('href', '/ctf/leaderboard?eventID=1')
  })

  it('has no event bar on pages without an event', async () => {
    stubBackend({ user: 'CTF0001' })
    open('/my')
    await screen.findByText('Alice')
    expect(screen.queryByRole('navigation', { name: 'Event' })).not.toBeInTheDocument()
  })
})

describe('an organizer', () => {
  it('is told that the player pages are not for them', async () => {
    stubBackend({ user: 'ADMIN01' })
    open('/board?eventID=1')
    expect(await screen.findByText(/organizers have no player account/i)).toBeInTheDocument()
    expect(screen.getByText('Organizer')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /sign out/i })).toHaveAttribute('href', '/ctf/logout.html')
  })

  it('gets the admin pages, with their own navigation', async () => {
    stubBackend({ user: 'ADMIN01' })
    open('/')
    await userEvent.click(await screen.findByRole('link', { name: 'Admin' }))
    const nav = await screen.findByRole('navigation', { name: 'Admin' })
    expect(within(nav).getByRole('link', { name: /events/i })).toHaveAttribute('aria-current', 'page')
    await userEvent.click(within(nav).getByRole('link', { name: /settings/i }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
    expect(within(nav).getByRole('link', { name: /settings/i })).toHaveAttribute('aria-current', 'page')
  })

  it('marks the navigation entry of a detail page', async () => {
    stubBackend({ user: 'ADMIN01' })
    open('/admin/challenge?challengeID=3')
    const nav = await screen.findByRole('navigation', { name: 'Admin' })
    expect(within(nav).getByRole('link', { name: /library/i })).toHaveAttribute('aria-current', 'page')
  })

  it('gets not found for an admin page that does not exist', async () => {
    stubBackend({ user: 'ADMIN01' })
    open('/admin/nothing-here')
    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })
})

describe('the admin pages', () => {
  it('are not for players', async () => {
    stubBackend({ user: 'CTF0001' })
    open('/admin/settings')
    expect(await screen.findByText(/this page is for organizers/i)).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Admin' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Admin' })).not.toBeInTheDocument()
  })

  it('send a visitor to sign-in, and back', async () => {
    stubBackend()
    open('/admin/event?eventID=3')
    await vi.waitFor(() => expect(assign).toHaveBeenCalledWith(
      `/ctf/login?returnTo=${encodeURIComponent('/ctf/admin/event?eventID=3')}`,
    ))
  })
})

it('shows a page that does not exist as not found', async () => {
  stubBackend()
  open('/nothing-here')
  expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
})
