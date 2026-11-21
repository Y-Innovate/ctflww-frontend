import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../../api/client'
import { stubBackend } from '../../test/backend'
import { openApp } from '../../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => vi.unstubAllGlobals())

const asOrganizer = () => stubBackend({ user: 'ADMIN01' })
const names = (table) => within(table).getAllByRole('row').slice(1).map((r) => within(r).getByRole('link').textContent)
const setDate = (label, value) => fireEvent.change(screen.getByLabelText(label), { target: { value } })

async function confirm(label, confirmLabel) {
  await userEvent.click(screen.getByRole('button', { name: label }))
  await userEvent.click(within(screen.getByRole('group', { name: label })).getByRole('button', { name: confirmLabel }))
}

describe('the admin event list', () => {
  it('lists every event, drafts and closed ones too', async () => {
    asOrganizer()
    openApp('/admin')
    const table = await screen.findByRole('table')
    expect(names(table)).toEqual(['Spring Team CTF', 'Frozen Night CTF', 'Summer Team CTF', 'Autumn Solo CTF',
      'Winter CTF 2025', 'Draft CTF'])
    const draft = within(table).getByRole('link', { name: 'Draft CTF' }).closest('tr')
    expect(draft).toHaveTextContent('Draft')
    expect(within(table).getByRole('link', { name: 'Spring Team CTF' })).toHaveAttribute('href', '/ctf/admin/event?eventID=1')
  })

  it('filters on status', async () => {
    asOrganizer()
    openApp('/admin')
    await screen.findByRole('table')
    await userEvent.click(screen.getByRole('button', { name: 'Drafts' }))
    await vi.waitFor(() => expect(names(screen.getByRole('table'))).toEqual(['Draft CTF']))
    expect(window.location.search).toBe('?status=D')
    expect(screen.getByRole('button', { name: 'Drafts' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows archived events only under their filter', async () => {
    asOrganizer()
    openApp('/admin')
    const table = await screen.findByRole('table')
    expect(names(table)).not.toContain('Spring CTF 2025')
    await userEvent.click(screen.getByRole('button', { name: 'Archived' }))
    await vi.waitFor(() => expect(names(screen.getByRole('table'))).toEqual(['Spring CTF 2025']))
    expect(window.location.search).toBe('?status=A')
  })
})

describe('a new event', () => {
  it('checks the form, then creates a draft', async () => {
    const { calls } = asOrganizer()
    openApp('/admin')
    await userEvent.click(await screen.findByRole('link', { name: /new event/i }))
    await userEvent.click(await screen.findByRole('button', { name: 'Create draft' }))
    expect(screen.getByText('A name is required')).toBeInTheDocument()
    expect(screen.getByText('A registration code is required')).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST')).toBe(false)

    await userEvent.type(screen.getByLabelText('Name'), 'Spring 2027')
    await userEvent.click(screen.getByRole('button', { name: 'Generate' }))
    expect(screen.getByLabelText('Registration code').value).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/)
    setDate('Start', '2027-03-01T09:00')
    setDate('End', '2027-03-01T08:00')
    setDate('Registration opens', '2027-02-01T00:00')
    setDate('Registration closes', '2027-03-01T09:00')
    expect(screen.getByText('After the start')).toBeInTheDocument()
    setDate('End', '2027-03-01T17:00')
    await userEvent.selectOptions(screen.getByLabelText('RACF group'), 'CTFTEST')
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }))

    expect(await screen.findByRole('heading', { name: 'Spring 2027' })).toBeInTheDocument()
    expect(window.location.search).toBe('?eventID=8')
    const sent = calls.find((c) => c.method === 'POST').body
    expect(sent).toMatchObject({
      eventStatus: 'D', playMode: 'T', maxTeamSize: 4, maxPlayers: 100, racfGroup: 'CTFTEST', freezeTS: '',
      startTS: '2027-03-01-09.00.00.000000', endTS: '2027-03-01-17.00.00.000000',
    })
  })

  it('shows the backend\'s refusal', async () => {
    const { db } = asOrganizer()
    openApp('/admin/event')
    await userEvent.type(await screen.findByLabelText('Name'), 'X')
    await userEvent.type(screen.getByLabelText('Registration code'), 'CODE-1234')
    setDate('Start', '2027-03-01T09:00')
    setDate('End', '2027-03-01T17:00')
    setDate('Registration opens', '2027-02-01T00:00')
    setDate('Registration closes', '2027-03-01T09:00')
    await vi.waitFor(() => expect(within(screen.getByLabelText('RACF group')).getAllByRole('option')).toHaveLength(3))
    await userEvent.selectOptions(screen.getByLabelText('RACF group'), 'CTFTEST')
    // Another organizer removes the group meanwhile
    db.data.refTables = db.data.refTables.filter((r) => r.tabKey !== 'CTFTEST')
    await userEvent.click(screen.getByRole('button', { name: 'Create draft' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('racfGroup is not in the RACFGRP list')
    expect(screen.getByLabelText('Name')).toHaveValue('X')
  })
})

describe('an event', () => {
  it('saves changed settings', async () => {
    const { calls } = asOrganizer()
    openApp('/admin/event?eventID=3')
    const name = await screen.findByLabelText('Name')
    expect(name).toHaveValue('Summer Team CTF')
    expect(screen.getByLabelText('Registration code')).toHaveValue('SUMMER-TEAM-2026')
    await userEvent.clear(name)
    await userEvent.type(name, 'Summer CTF')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { name: 'Summer CTF' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Saved.')
    const put = calls.find((c) => c.method === 'PUT')
    expect(put.path).toBe('/admin/events/3')
    expect(put.body).toMatchObject({ eventName: 'Summer CTF', eventStatus: 'P', regCode: 'SUMMER-TEAM-2026' })
  })

  it('locks play mode and group once players joined', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=1')
    expect(await screen.findByLabelText('Play mode')).toBeDisabled()
    expect(screen.getByLabelText('RACF group')).toBeDisabled()
    expect(screen.getByText(/players have joined/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Back to draft' })).not.toBeInTheDocument()
  })

  it('refuses to publish a draft without a visible challenge', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=6')
    await screen.findByLabelText('Name')
    await confirm('Publish', 'Publish')
    expect(await screen.findByRole('alert')).toHaveTextContent('Publishing needs at least one visible challenge.')
  })

  it('publishes a draft with a visible challenge, and takes it back', async () => {
    const { db } = asOrganizer()
    db.data.eventChallenges.push({ eventID: 6, challengeID: 1, sortOrder: 1, scoreType: 'S', initPoints: 100,
      minPoints: 0, decaySolves: 0, isVisible: 'Y', maxAttempts: 0 })
    openApp('/admin/event?eventID=6')
    await screen.findByLabelText('Name')
    await confirm('Publish', 'Publish')
    expect(await screen.findByRole('link', { name: 'Public page' })).toHaveAttribute('href', '/ctf?eventID=6')
    await confirm('Back to draft', 'Back to draft')
    await vi.waitFor(() => expect(screen.queryByRole('link', { name: 'Public page' })).not.toBeInTheDocument())
  })

  it('deletes a draft', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=6')
    await screen.findByLabelText('Name')
    await confirm('Delete draft', 'Delete')
    const table = await screen.findByRole('table')
    await vi.waitFor(() => expect(names(table)).not.toContain('Draft CTF'))
    expect(window.location.pathname).toBe('/ctf/admin')
  })

  it('shows a closed event read-only', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=5')
    expect(await screen.findByText(/this event is closed/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
    const status = screen.getByRole('region', { name: 'Status' })
    expect(within(status).getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(within(status).queryByRole('button', { name: 'Close event' })).not.toBeInTheDocument()
  })

  it('says when the event does not exist', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=99')
    expect(await screen.findByText(/doesn't exist/)).toBeInTheDocument()
  })
})

describe('closing an event', () => {
  it('closes an ended event and queues its offboarding', async () => {
    const { db, calls } = asOrganizer()
    openApp('/admin/event?eventID=4')
    expect(await screen.findByText(/players are removed from RACF group CTFPLAY/)).toBeInTheDocument()
    await confirm('Close event', 'Close and offboard')
    expect(await screen.findByText(/nothing about it can change any more/)).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(within(screen.getByRole('region', { name: 'Status' })).getByRole('button', { name: 'Archive' })).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/eventClosures/4')).toBe(true)
    expect(db.data.provJobs.filter((j) => j.eventID === 4 && j.provAction === 'M')).toHaveLength(4)
  })

  it('offers closing only after the end', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=1')
    expect(await screen.findByText(/it can be closed after its end/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close event' })).not.toBeInTheDocument()
  })
})

describe('archiving an event', () => {
  it('archives a closed event, and restores it', async () => {
    const { calls } = asOrganizer()
    openApp('/admin/event?eventID=5')
    await screen.findByText(/this event is closed/i)
    await confirm('Archive', 'Archive')
    expect(await screen.findByText(/this event is archived/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toBeDisabled()
    expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/eventArchives/5')).toBe(true)

    await confirm('Restore', 'Restore')
    expect(await screen.findByText(/this event is closed/i)).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/admin/eventArchives/5')).toBe(true)
  })
})
