import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../../api/client'
import { stubBackend } from '../../test/backend'
import { openApp } from '../../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => vi.unstubAllGlobals())

const asOrganizer = () => stubBackend({ user: 'ADMIN01' })
const found = () => within(screen.getByRole('table', { name: 'Players found' })).getAllByRole('row').slice(1)
  .map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))

async function confirm(label) {
  await userEvent.click(screen.getByRole('button', { name: label }))
  await userEvent.click(within(screen.getByRole('group', { name: label })).getByRole('button', { name: label }))
}

describe('finding players', () => {
  it('lists everybody, 20 at a time, and finds by name', async () => {
    asOrganizer()
    openApp('/admin/players')
    await screen.findByRole('table', { name: 'Players found' })
    expect(found()).toHaveLength(20)
    expect(found()[0]).toEqual(['1', 'CTF0001', 'Alice', 'Active'])
    await userEvent.type(screen.getByLabelText('Display name starts with'), 'al')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    await vi.waitFor(() => expect(found()).toEqual([['1', 'CTF0001', 'Alice', 'Active']]))
    expect(window.location.search).toBe('?name=al')
  })

  it('finds by event and status', async () => {
    asOrganizer()
    openApp('/admin/players?event=3')
    await vi.waitFor(() => expect(found().map((r) => r[2])).toEqual(['Carol', 'Erin']))
    await vi.waitFor(() => expect(screen.getByLabelText('Plays in')).toHaveValue('3'))
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'V')
    await userEvent.click(screen.getByRole('button', { name: 'Search' }))
    expect(await screen.findByText('No players found.')).toBeInTheDocument()
    expect(window.location.search).toBe('?status=V&event=3')
  })
})

describe('a player', () => {
  it('resets the passphrase: the claim token once, with the link for R3', async () => {
    const { calls } = asOrganizer()
    openApp('/admin/player?playerID=2')
    expect(await screen.findByRole('heading', { name: 'Bob' })).toBeInTheDocument()
    expect(screen.getByText('CTF0002')).toBeInTheDocument()
    await confirm('Reset passphrase')
    const note = await screen.findByRole('status')
    expect(within(note).getByText(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/)).toBeInTheDocument()
    expect(note).toHaveTextContent('/ctf/register?registrationID=2')
    expect(within(note).getByRole('button', { name: 'Copy claim token' })).toBeInTheDocument()
    expect(calls.some((c) => c.method === 'POST' && c.path === '/admin/playerResets/2')).toBe(true)
    expect(window.localStorage.length + window.sessionStorage.length).toBe(0)

    // One open job at a time
    await confirm('Revoke')
    expect(await screen.findByRole('alert')).toHaveTextContent('This player has an open job.')
  })

  it('revokes, and offers resume and delete once the job is done', async () => {
    const backend = asOrganizer()
    openApp('/admin/player?playerID=4')
    await screen.findByRole('heading', { name: 'Dave' })
    expect(screen.queryByRole('button', { name: 'Resume' })).not.toBeInTheDocument()
    await confirm('Revoke')
    expect(await screen.findByRole('status')).toHaveTextContent(/Job \d+ is submitted/)
    expect(screen.getByText('Active')).toBeInTheDocument() // until the job is done

    backend.advance(5000)
    await userEvent.click(within(screen.getByRole('navigation', { name: 'Admin' })).getByRole('link', { name: /players/i }))
    await vi.waitFor(() => expect(found().find((r) => r[1] === 'CTF0004')[3]).toBe('Revoked'))
    await userEvent.click(screen.getByRole('link', { name: 'CTF0004' }))
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete userid' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revoke' })).not.toBeInTheDocument()
  })

  it('says why a pending player has no actions', async () => {
    const { db } = asOrganizer()
    db.data.players.find((p) => p.playerID === 5).playerStatus = 'P'
    openApp('/admin/player?playerID=5')
    expect(await screen.findByText(/being created: wait for its job/)).toBeInTheDocument()
    const nav = screen.getByRole('navigation', { name: 'Admin' })
    expect(within(nav).getByRole('link', { name: /players/i })).toHaveAttribute('aria-current', 'page')
  })
})
