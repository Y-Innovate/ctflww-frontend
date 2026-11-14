import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../../api/client'
import { stubBackend } from '../../test/backend'
import { openApp } from '../../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => vi.unstubAllGlobals())

const asOrganizer = () => stubBackend({ user: 'ADMIN01' })
const rows = (name) => within(screen.getByRole('table', { name })).getAllByRole('row').slice(1)
  .map((r) => within(r).getAllByRole('cell').map((c) => c.textContent))

describe('the teams of an event', () => {
  it('lists the teams by rank with size, captain, awards and live score', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=1&tab=teams')
    await screen.findByRole('table', { name: 'Teams' })
    await vi.waitFor(() => expect(rows('Teams')[0][3]).toBe('Alice (CTF0001)'))
    expect(rows('Teams')).toEqual([
      ['1', 'Root Access', '2 / 4', 'Alice (CTF0001)', '3', '+50', '724'],
      ['2', 'Packet Pirates', '2 / 4', 'Frank (CTF0006)', '3', '-25', '709'],
      ['3', 'Null Pointers', '1 / 4', 'Heidi (CTF0008)', '1', '', '100'],
    ])
  })

  it('gives a penalty after checking the form, and the score drops', async () => {
    const { calls } = asOrganizer()
    openApp('/admin/event?eventID=1&tab=teams')
    const form = await screen.findByRole('form', { name: 'Give an award or penalty' })
    await userEvent.type(within(form).getByLabelText(/points/i), '0')
    await userEvent.click(within(form).getByRole('button', { name: 'Give' }))
    expect(within(form).getByText('Pick a team')).toBeInTheDocument()
    expect(within(form).getByText('Not 0')).toBeInTheDocument()
    expect(within(form).getByText('A reason is required')).toBeInTheDocument()

    await vi.waitFor(() => expect(within(form).getAllByRole('option')).toHaveLength(4))
    await userEvent.selectOptions(within(form).getByLabelText('Team'), 'Null Pointers')
    await userEvent.clear(within(form).getByLabelText(/points/i))
    await userEvent.type(within(form).getByLabelText(/points/i), '-40')
    await userEvent.type(within(form).getByLabelText(/reason/i), 'Brute-forcing flags')
    await userEvent.click(within(form).getByRole('button', { name: 'Give' }))
    expect(await within(form).findByRole('status')).toHaveTextContent('Given: -40 for Null Pointers.')
    await vi.waitFor(() => expect(rows('Teams')[2]).toEqual(['3', 'Null Pointers', '1 / 4', 'Heidi (CTF0008)', '1', '-40', '60']))
    expect(within(screen.getByRole('list', { name: 'Awards' })).getAllByRole('listitem')).toHaveLength(3)
    expect(calls.find((c) => c.method === 'POST').body).toEqual({ eventID: 1, teamID: 3, points: -40, reason: 'Brute-forcing flags' })
  })

  it('deletes an award', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=1&tab=teams')
    const list = await screen.findByRole('list', { name: 'Awards' })
    const award = within(list).getByText('Best write-up of the morning').closest('li')
    await userEvent.click(within(award).getByRole('button', { name: 'Delete award 1' }))
    expect(within(award).getByRole('group')).toHaveTextContent('Delete +50 for Root Access?')
    await userEvent.click(within(award).getByRole('button', { name: 'Delete' }))
    await vi.waitFor(() => expect(within(list).getAllByRole('listitem')).toHaveLength(1))
    await vi.waitFor(() => expect(rows('Teams')[0][6]).toBe('709')) // Packet Pirates lead now
  })

  it('calls them players in an individual event', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=2&tab=teams')
    await screen.findByRole('table', { name: 'Players' })
    expect(screen.queryByRole('columnheader', { name: 'Members' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Player')).toBeInTheDocument()
  })

  it('changes nothing in a closed event', async () => {
    asOrganizer()
    openApp('/admin/event?eventID=5&tab=teams')
    await screen.findByRole('table', { name: 'Players' })
    expect(screen.queryByRole('form', { name: 'Give an award or penalty' })).not.toBeInTheDocument()
  })
})
