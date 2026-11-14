import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../../api/client'
import { stubBackend } from '../../test/backend'
import { openApp } from '../../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => vi.unstubAllGlobals())

const asOrganizer = () => stubBackend({ user: 'ADMIN01' })
const region = (name) => screen.findByRole('region', { name })
const bodyRows = (table) => within(table).getAllByRole('row').slice(1)
const attempts = () => bodyRows(screen.getByRole('table', { name: 'Attempts' }))
const scoreOf = (board, name) => within(within(board).getByText(name).closest('tr')).getAllByRole('cell')[2].textContent

describe('the monitor', () => {
  it('shows the live board, without the freeze', async () => {
    const { db } = asOrganizer()
    openApp('/admin/event?eventID=2&tab=monitor')
    const board = await region('Live leaderboard')
    await within(board).findByText('Dave')
    expect(board).toHaveTextContent('Without the freeze')
    // Dave's two solves after the freeze count here, not on the public board
    const pub = db.leaderboard('2', {}).body.leaderboard.find((r) => r.teamName === 'Dave').score
    expect(Number(scoreOf(board, 'Dave'))).toBeGreaterThan(pub)
    expect(screen.getByRole('link', { name: 'Monitor' })).toHaveAttribute('aria-current', 'page')
  })

  it('lists the attempts newest first, with names, and filters them', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=1&tab=monitor')
    await screen.findByRole('table', { name: 'Attempts' })
    // By submission ID, as CTFM413: the seed added this one last
    await vi.waitFor(() => expect(attempts()[0]).toHaveTextContent('Null Pointers'))
    expect(attempts()).toHaveLength(8)
    expect(attempts()[0]).toHaveTextContent('Hello mainframe')
    expect(attempts()[0]).toHaveTextContent('Heidi (CTF0008)')
    expect(attempts()[0]).toHaveTextContent('flag{hello_zos}')
    expect(attempts()[0]).toHaveTextContent('Right')

    await userEvent.selectOptions(screen.getByLabelText('Right or wrong'), 'N')
    await vi.waitFor(() => expect(attempts()).toHaveLength(1))
    expect(attempts()[0]).toHaveTextContent('flag{caesar}')
    expect(attempts()[0]).toHaveTextContent('Wrong')
    expect(window.location.search).toContain('correct=N')
  })

  it('filters the solves on team', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=1&tab=monitor')
    const solves = await region('Solves')
    await vi.waitFor(() => expect(within(solves).getAllByRole('listitem')).toHaveLength(7))
    await vi.waitFor(() => expect(within(screen.getByLabelText('Team')).getAllByRole('option')).toHaveLength(4))
    await userEvent.selectOptions(screen.getByLabelText('Team'), 'Root Access')
    await vi.waitFor(() => expect(within(solves).getAllByRole('listitem')).toHaveLength(3))
    expect(within(solves).getAllByRole('listitem').map((li) => li.textContent.split(' · ')[0]))
      .toEqual(['Hello mainframe', 'RACF riddle', 'Caesar salad'])
  })

  it('reverses a solve with a reason', async () => {
    const { calls } = asOrganizer()
    openApp('/admin/event?eventID=1&tab=monitor&team=1')
    const solves = await region('Solves')
    const board = await region('Live leaderboard')
    await within(board).findByText('Root Access')
    const before = Number(scoreOf(board, 'Root Access'))
    const name = 'Reverse RACF riddle · Root Access · Alice (CTF0001)'
    await userEvent.click(await within(solves).findByRole('button', { name }))
    const form = within(solves).getByRole('form', { name })
    expect(within(form).getByRole('button', { name: 'Reverse solve' })).toBeDisabled()
    await userEvent.type(within(form).getByLabelText(/reason/i), 'Flag shared on chat')
    await userEvent.click(within(form).getByRole('button', { name: 'Reverse solve' }))

    await vi.waitFor(() => expect(within(solves).getAllByRole('listitem')).toHaveLength(2))
    await vi.waitFor(() => expect(Number(scoreOf(board, 'Root Access'))).toBeLessThan(before))
    const reversed = attempts().find((r) => r.textContent.includes('flag{SECADM}'))
    expect(reversed).toHaveTextContent('Reversed')
    expect(reversed).toHaveTextContent('Flag shared on chat (ADMIN01')
    expect(calls.find((c) => c.path === '/admin/solveReversals').body)
      .toEqual({ eventID: 1, challengeID: 3, teamID: 1, reverseReason: 'Flag shared on chat' })
  })

  it('offers no reversals in a closed event', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=5&tab=monitor')
    const solves = await region('Solves')
    await vi.waitFor(() => expect(within(solves).getAllByRole('listitem').length).toBeGreaterThan(0))
    expect(within(solves).queryByRole('button', { name: /reverse/i })).not.toBeInTheDocument()
  })
})
