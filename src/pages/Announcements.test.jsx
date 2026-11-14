import { act, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../api/client'
import { markSeen, seenIds } from '../lib/seen'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

const titles = () => screen.getAllByRole('article').map((a) => within(a).getByRole('heading').textContent)
const isNew = (title) => within(screen.getByRole('heading', { name: title }).closest('article')).queryByText('New') !== null

describe('the announcements', () => {
  it('lists them newest first, all new on the first visit, and marks them seen', async () => {
    stubBackend({ user: 'CTF0001' })
    openApp('/announcements?eventID=1')
    await screen.findByRole('heading', { name: 'Welcome!' })
    expect(titles()).toEqual(['New challenge soon', 'Hint prices', 'Welcome!'])
    expect(screen.getByText(/A forensics challenge opens at noon/)).toBeInTheDocument()
    expect(isNew('Welcome!')).toBe(true)
    expect(isNew('New challenge soon')).toBe(true)
    await vi.waitFor(() => expect([...seenIds('1')].sort()).toEqual([1, 2, 3]))
    // The badge in the event bar clears
    await vi.waitFor(() => expect(screen.queryByLabelText(/unread/)).not.toBeInTheDocument())
  })

  it('marks only the ones not seen before as new', async () => {
    markSeen('1', [1, 2])
    stubBackend({ user: 'CTF0001' })
    openApp('/announcements?eventID=1')
    await screen.findByRole('heading', { name: 'Welcome!' })
    expect(isNew('New challenge soon')).toBe(true)
    expect(isNew('Hint prices')).toBe(false)
    expect(isNew('Welcome!')).toBe(false)
  })

  it('shows a new announcement within a minute, as new', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    markSeen('1', [1, 2, 3])
    const { db } = stubBackend({ user: 'CTF0001' })
    openApp('/announcements?eventID=1')
    await screen.findByRole('heading', { name: 'Welcome!' })
    expect(screen.queryByText('New')).not.toBeInTheDocument()
    db.data.announcements.push({ announceID: 9, eventID: 1, announceTitle: 'Forensics is open', announceBody: 'Go!', createdDate: '2000-01-01-00.00.00.000000' })
    await act(() => vi.advanceTimersByTimeAsync(60_000))
    expect(await screen.findByRole('heading', { name: 'Forensics is open' })).toBeInTheDocument()
    expect(titles()[0]).toBe('Forensics is open')
    expect(isNew('Forensics is open')).toBe(true)
  })

  it('needs a place in the event, but no team', async () => {
    stubBackend({ user: 'CTF0003' }) // Carol, no team in 1
    const { unmount } = openApp('/announcements?eventID=1')
    expect(await screen.findByRole('heading', { name: 'Welcome!' })).toBeInTheDocument()
    unmount()
    vi.unstubAllGlobals()

    stubBackend({ user: 'CTF0002' }) // Bob is not in 2
    openApp('/announcements?eventID=2')
    expect(await screen.findByText(/haven't joined this event/i)).toBeInTheDocument()
  })

  it('says when there are none', async () => {
    stubBackend({ user: 'CTF0001' })
    openApp('/announcements?eventID=4')
    expect(await screen.findByText(/no announcements yet/i)).toBeInTheDocument()
  })
})
