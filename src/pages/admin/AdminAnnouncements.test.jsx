import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../../api/client'
import { stubBackend } from '../../test/backend'
import { openApp } from '../../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => vi.unstubAllGlobals())

const asOrganizer = () => stubBackend({ user: 'ADMIN01' })
const titles = () => within(screen.getByRole('list', { name: 'Announcements' })).getAllByRole('heading', { level: 3 })
  .map((h) => h.textContent)
const itemOf = (title) => screen.getByRole('heading', { level: 3, name: title }).closest('li')

describe('the announcements of an event', () => {
  it('lists them newest first', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=1&tab=announcements')
    await screen.findByRole('heading', { level: 3, name: 'Welcome!' })
    expect(titles()).toEqual(['New challenge soon', 'Hint prices', 'Welcome!'])
    expect(screen.getByText(/see it within a minute/)).toBeInTheDocument()
  })

  it('publishes one that players get, after checking the form', async () => {
    const { db } = asOrganizer()
    openApp('/admin/event?eventID=1&tab=announcements')
    const form = await screen.findByRole('form', { name: 'New announcement' })
    await userEvent.click(within(form).getByRole('button', { name: 'Publish' }))
    expect(within(form).getByText('A title is required')).toBeInTheDocument()
    expect(within(form).getByText('A text is required')).toBeInTheDocument()

    await userEvent.type(within(form).getByLabelText('Title'), 'Forensics is open')
    await userEvent.type(within(form).getByLabelText('Text'), 'Lost in the logs is visible now.')
    expect(within(form).getByText('32 / 1000')).toBeInTheDocument()
    await userEvent.click(within(form).getByRole('button', { name: 'Publish' }))
    await vi.waitFor(() => expect(titles()[0]).toBe('Forensics is open'))
    expect(within(form).getByLabelText('Title')).toHaveValue('')
    const players = db.announcements('CTF0001', { eventID: '1' }).body.announcements
    expect(players[0].announceTitle).toBe('Forensics is open')
  })

  it('corrects one, keeping its publish time', async () => {
    const { calls } = asOrganizer()
    openApp('/admin/event?eventID=1&tab=announcements')
    await screen.findByRole('heading', { level: 3, name: 'Welcome!' })
    await userEvent.click(within(itemOf('Welcome!')).getByRole('button', { name: 'Correct Welcome!' }))
    const form = screen.getByRole('form', { name: 'Correct Welcome!' })
    const title = within(form).getByLabelText('Title')
    await userEvent.clear(title)
    await userEvent.type(title, 'Welcome, all!')
    await userEvent.click(within(form).getByRole('button', { name: 'Save correction' }))
    const item = await screen.findByRole('heading', { level: 3, name: 'Welcome, all!' })
    expect(item.closest('li')).toHaveTextContent(/Corrected .* by ADMIN01/)
    expect(titles()).toEqual(['New challenge soon', 'Hint prices', 'Welcome, all!'])
    expect(calls.find((c) => c.method === 'PUT')).toMatchObject({ path: '/admin/announcements/1' })
  })

  it('deletes one', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=1&tab=announcements')
    await screen.findByRole('heading', { level: 3, name: 'Hint prices' })
    const item = itemOf('Hint prices')
    await userEvent.click(within(item).getByRole('button', { name: 'Delete Hint prices' }))
    await userEvent.click(within(item).getByRole('button', { name: 'Delete' }))
    await vi.waitFor(() => expect(titles()).toEqual(['New challenge soon', 'Welcome!']))
  })

  it('takes them on a draft too, and keeps a closed event read-only', async () => {
    asOrganizer()
    const { unmount } = openApp('/admin/event?eventID=6&tab=announcements')
    expect(await screen.findByText(/once the event is published/)).toBeInTheDocument()
    expect(await screen.findByText('No announcements yet.')).toBeInTheDocument()
    unmount()

    openApp('/admin/event?eventID=5&tab=announcements')
    expect(await screen.findByText(/announcements can no longer change/)).toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'New announcement' })).not.toBeInTheDocument()
  })
})
