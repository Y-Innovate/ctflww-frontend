import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../../api/client'
import { stubBackend } from '../../test/backend'
import { openApp } from '../../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => vi.unstubAllGlobals())

const asOrganizer = () => stubBackend({ user: 'ADMIN01' })
const rows = () => within(screen.getByRole('table', { name: 'Jobs' })).getAllByRole('row').slice(1)
const rowOf = (id) => rows().find((r) => within(r).getAllByRole('cell')[0].textContent === String(id))

async function retry(id, scope = document.body) {
  const label = `Retry job ${id}`
  await userEvent.click(within(scope).getByRole('button', { name: label }))
  await userEvent.click(within(within(scope).getByRole('group', { name: label })).getByRole('button', { name: 'Retry' }))
}

describe('the provisioning jobs', () => {
  it('lists them newest first with action, player, status and result', async () => {
    asOrganizer()
    openApp('/admin/jobs')
    await screen.findByRole('table', { name: 'Jobs' })
    expect(rows()).toHaveLength(3)
    expect(rows()[0]).toHaveTextContent('Create')
    expect(rows()[0]).toHaveTextContent('Failed')
    expect(rows()[0]).toHaveTextContent('RC 12')
    expect(rows()[0]).toHaveTextContent('ICH01024I')
    expect(within(rows()[0]).getByRole('link', { name: 'player 32' })).toHaveAttribute('href', '/ctf/admin/player?playerID=32')
    await vi.waitFor(() => expect(rowOf(2)).toHaveTextContent('Remove'))
    await vi.waitFor(() => expect(rowOf(2)).toHaveTextContent('Winter CTF 2025 · CTFPLAY'))
    expect(rowOf(1)).toHaveTextContent('Done')
    expect(within(rowOf(1)).queryByRole('button')).not.toBeInTheDocument()
  })

  it('filters on status and event', async () => {
    asOrganizer()
    openApp('/admin/jobs?status=F')
    await screen.findByRole('table', { name: 'Jobs' })
    await vi.waitFor(() => expect(rows()).toHaveLength(2))
    await vi.waitFor(() => expect(within(screen.getByLabelText('Event')).getAllByRole('option').length).toBeGreaterThan(1))
    await userEvent.selectOptions(screen.getByLabelText('Event'), 'Winter CTF 2025')
    await vi.waitFor(() => expect(rows()).toHaveLength(1))
    expect(window.location.search).toBe('?status=F&event=5')
  })

  it('retries a failed REMOVE for the batch', async () => {
    asOrganizer()
    openApp('/admin/jobs')
    await screen.findByRole('table', { name: 'Jobs' })
    await retry(2)
    expect(await screen.findByRole('status')).toHaveTextContent('Job 2 is queued again: the batch carries it out.')
    await vi.waitFor(() => expect(rowOf(2)).toHaveTextContent('Queued'))
    expect(rowOf(2)).toHaveTextContent('retried 1×')
  })

  it('retries a failed CREATE with a new claim token, shown once', async () => {
    const { calls } = asOrganizer()
    openApp('/admin/jobs')
    await screen.findByRole('table', { name: 'Jobs' })
    await retry(3)
    const note = await screen.findByRole('status')
    expect(within(note).getByText(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/)).toBeInTheDocument()
    expect(note).toHaveTextContent('/ctf/register?registrationID=32')
    expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/jobRetries/3')).toBe(true)
    expect(window.localStorage.length + window.sessionStorage.length).toBe(0)
  })

  it('shows them on the player page, with retry there', async () => {
    asOrganizer()
    openApp('/admin/player?playerID=32')
    expect(await screen.findByRole('heading', { name: 'Fay' })).toBeInTheDocument()
    expect(screen.getByText(/failed: retry it below/)).toBeInTheDocument()
    const jobs = await screen.findByRole('region', { name: 'Jobs of this player' })
    await within(jobs).findByRole('table', { name: 'Jobs' })
    expect(within(jobs).queryByRole('columnheader', { name: 'Player' })).not.toBeInTheDocument()
    await retry(3, jobs)
    expect(await within(jobs).findByRole('status')).toHaveTextContent('Hand this over')
    await vi.waitFor(() => expect(screen.getByText('Pending')).toBeInTheDocument())
  })
})
