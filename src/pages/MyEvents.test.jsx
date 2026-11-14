import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../api/client'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => vi.unstubAllGlobals())

const card = async (name) => (await screen.findByRole('link', { name })).closest('li')

describe('my events', () => {
  it('lists the events with where to go next', async () => {
    stubBackend({ user: 'CTF0003' }) // Carol
    openApp('/my')
    const spring = await card('Spring Team CTF')
    expect(within(spring).getByText(/no team yet/i)).toBeInTheDocument()
    expect(within(spring).getByRole('link', { name: /find a team/i })).toHaveAttribute('href', '/ctf/team?eventID=1')
    const frozen = await card('Frozen Night CTF')
    expect(within(frozen).getByText('Frozen')).toBeInTheDocument()
    expect(within(frozen).getByRole('link', { name: /challenges/i })).toHaveAttribute('href', '/ctf/board?eventID=2')
    expect(within(frozen).queryByRole('link', { name: /^team$/i })).not.toBeInTheDocument()
  })

  it('shows the team of a team event', async () => {
    stubBackend({ user: 'CTF0001' }) // Alice
    openApp('/my')
    const spring = await card('Spring Team CTF')
    expect(within(spring).getByText('Team Root Access')).toBeInTheDocument()
    expect(within(spring).getByRole('link', { name: /^team$/i })).toHaveAttribute('href', '/ctf/team?eventID=1')
  })

  it('says a pending place waits for its job', async () => {
    stubBackend({ user: 'CTF0005' }) // Erin
    openApp('/my')
    const summer = await card('Summer Team CTF')
    expect(within(summer).getByText(/waits for its RACF job/i)).toBeInTheDocument()
    expect(within(summer).queryByRole('link', { name: /challenges/i })).not.toBeInTheDocument()
  })
})

describe('joining', () => {
  it('joins an open event with its code', async () => {
    stubBackend({ user: 'CTF0004' }) // Dave: in 2 and 4
    openApp('/my')
    const select = await screen.findByLabelText('Event')
    await vi.waitFor(() => expect(within(select).getAllByRole('option')).toHaveLength(3))
    await userEvent.selectOptions(select, screen.getByRole('option', { name: /spring team ctf/i }))
    await userEvent.type(screen.getByLabelText('Registration code'), 'NOPE')
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/code is wrong/i)

    await userEvent.clear(screen.getByLabelText('Registration code'))
    await userEvent.type(screen.getByLabelText('Registration code'), 'SPRING-TEAM-2026')
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(await screen.findByRole('status')).toHaveTextContent('You joined Spring Team CTF.')
    expect(await card('Spring Team CTF')).toBeInTheDocument()
    await vi.waitFor(() => expect(within(screen.getByLabelText('Event')).getAllByRole('option')).toHaveLength(2))
  })

  it('preselects the event it came from', async () => {
    stubBackend({ user: 'CTF0004' })
    openApp('/my?join=3')
    const select = await screen.findByLabelText('Event')
    await vi.waitFor(() => expect(select).toHaveValue('3'))
  })

  it('says when the event is full', async () => {
    const { db } = stubBackend({ user: 'CTF0004' })
    db.data.events.find((e) => e.eventID === 3).maxPlayers = 2
    openApp('/my?join=3')
    await vi.waitFor(() => expect(screen.getByLabelText('Event')).toHaveValue('3'))
    await userEvent.type(screen.getByLabelText('Registration code'), 'SUMMER-TEAM-2026')
    await userEvent.click(screen.getByRole('button', { name: 'Join' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This event is full.')
  })

  it('says when there is nothing left to join', async () => {
    stubBackend({ user: 'CTF0003' }) // Carol is in both open events
    openApp('/my')
    expect(await screen.findByText(/no other event is open/i)).toBeInTheDocument()
  })
})

describe('the passphrase', () => {
  async function change(current, next, again = next) {
    await userEvent.type(screen.getByLabelText('Current passphrase'), current)
    await userEvent.type(screen.getByLabelText('New passphrase'), next)
    await userEvent.type(screen.getByLabelText('New passphrase again'), again)
    await userEvent.click(screen.getByRole('button', { name: 'Change passphrase' }))
  }

  it('changes it, and clears the fields', async () => {
    stubBackend({ user: 'CTF0001' })
    openApp('/my')
    await screen.findByLabelText('Current passphrase')
    await change('old one', 'a brand new passphrase')
    expect(await screen.findByText('Your passphrase is changed.')).toBeInTheDocument()
    for (const f of ['Current passphrase', 'New passphrase', 'New passphrase again']) {
      expect(screen.getByLabelText(f)).toHaveValue('')
    }
  })

  it('shows a refusal, and checks length and repeat first', async () => {
    const { calls } = stubBackend({ user: 'CTF0001' })
    openApp('/my')
    await screen.findByLabelText('Current passphrase')
    await change('x', 'short')
    expect(screen.getByText(/at least 14 characters, please/i)).toBeInTheDocument()
    await userEvent.clear(screen.getByLabelText('New passphrase'))
    await userEvent.clear(screen.getByLabelText('New passphrase again'))
    await userEvent.type(screen.getByLabelText('New passphrase'), 'a brand new passphrase')
    await userEvent.type(screen.getByLabelText('New passphrase again'), 'something else entirely')
    expect(screen.getByText('The two passphrases differ.')).toBeInTheDocument()
    expect(calls.some((c) => c.path === '/myPassphrase')).toBe(false)

    await userEvent.clear(screen.getByLabelText('Current passphrase'))
    await userEvent.clear(screen.getByLabelText('New passphrase again'))
    await userEvent.type(screen.getByLabelText('Current passphrase'), 'wrong one')
    await userEvent.type(screen.getByLabelText('New passphrase again'), 'a brand new passphrase')
    await userEvent.click(screen.getByRole('button', { name: 'Change passphrase' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/current passphrase is wrong/i)
  })
})
