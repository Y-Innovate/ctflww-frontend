import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../api/client'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => vi.unstubAllGlobals())

const memberRow = async (name) => (await screen.findByText(name, { selector: 'span.font-medium' })).closest('li')

// Event 3 hasn't started: Carol captain of Byte Club, Erin (made active) a member
function upcomingTeam() {
  const backend = stubBackend({ user: 'CTF0003' })
  const { db } = backend
  db.data.participants.find((x) => x.eventID === 3 && x.playerID === 5).partStatus = 'A'
  const { body } = db.createTeam('CTF0003', { eventID: 3, teamName: 'Byte Club' })
  db.joinTeam('CTF0005', { eventID: 3, joinCode: body.joinCode })
  return backend
}

async function confirm(row, label, confirmLabel) {
  await userEvent.click(within(row).getByRole('button', { name: label }))
  await userEvent.click(within(screen.getByRole('group', { name: label })).getByRole('button', { name: confirmLabel }))
}

describe('the team page', () => {
  it('shows the team, its score and the join code to the captain', async () => {
    stubBackend({ user: 'CTF0001' }) // Alice, captain of Root Access
    openApp('/team?eventID=1')
    expect(await screen.findByRole('heading', { name: 'Root Access' })).toBeInTheDocument()
    expect(screen.getByText('You are captain')).toBeInTheDocument()
    expect(screen.getByText('Score', { selector: 'dt' }).nextSibling).toHaveTextContent('724')
    expect(screen.getByText('Members', { selector: 'dt' }).nextSibling).toHaveTextContent('2 of 4')
    expect(screen.getByText('ROOTACCESS01')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy join code' })).toBeInTheDocument()

    const alice = await memberRow('Alice')
    expect(alice).toHaveTextContent('Captain')
    expect(alice).toHaveTextContent('you')
    // Started: no leaving or removing, but handing over is possible
    expect(within(alice).queryByRole('button')).not.toBeInTheDocument()
    const bob = await memberRow('Bob')
    expect(within(bob).getByRole('button', { name: 'Make captain' })).toBeInTheDocument()
    expect(within(bob).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(screen.getByText(/nobody can leave the team or be removed now/)).toBeInTheDocument()
  })

  it('shows the own solves and awards', async () => {
    stubBackend({ user: 'CTF0002' }) // Bob
    openApp('/team?eventID=1')
    const solves = await screen.findByRole('region', { name: 'Solves' })
    await within(solves).findByRole('link', { name: 'Caesar salad' })
    const rows = within(solves).getAllByRole('row').slice(1).map((r) => r.cells[0].textContent + '/' + r.cells[1].textContent)
    expect(rows).toEqual(['Hello mainframe/Alice', 'RACF riddle/Alice', 'Caesar salad/Bob'])
    const awards = await screen.findByRole('region', { name: 'Awards and penalties' })
    expect(awards).toHaveTextContent('+50')
    expect(awards).toHaveTextContent('Best write-up of the morning')
    // Not the captain: no join code, no actions
    expect(screen.queryByText('ROOTACCESS01')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Make captain' })).not.toBeInTheDocument()
  })

  it('shows a penalty', async () => {
    stubBackend({ user: 'CTF0006' }) // Frank, Packet Pirates
    openApp('/team?eventID=1')
    const awards = await screen.findByRole('region', { name: 'Awards and penalties' })
    expect(awards).toHaveTextContent('-25')
    expect(awards).toHaveTextContent('Scanning the scoreboard host')
  })

  it('shows only the own progress in an individual event', async () => {
    stubBackend({ user: 'CTF0004' }) // Dave, event 2 is frozen
    openApp('/team?eventID=2')
    expect(await screen.findByRole('heading', { name: 'Your progress' })).toBeInTheDocument()
    expect(screen.getByText(/these are your own numbers/i)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Members' })).not.toBeInTheDocument()
    const solves = await screen.findByRole('region', { name: 'Solves' })
    await within(solves).findByRole('link', { name: 'EBCDIC or bust' })
    expect(within(solves).queryByRole('columnheader', { name: 'Solved by' })).not.toBeInTheDocument()
  })
})

describe('without a team', () => {
  it('creates a team and becomes its captain', async () => {
    const { calls } = stubBackend({ user: 'CTF0003' }) // Carol, no team in 1
    openApp('/team?eventID=1')
    await userEvent.type(await screen.findByLabelText('Team name'), 'root access')
    await userEvent.click(screen.getByRole('button', { name: 'Create team' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('taken in this event')

    await userEvent.clear(screen.getByLabelText('Team name'))
    await userEvent.type(screen.getByLabelText('Team name'), 'Byte Club')
    await userEvent.click(screen.getByRole('button', { name: 'Create team' }))
    expect(await screen.findByRole('heading', { name: 'Byte Club' })).toBeInTheDocument()
    expect(screen.getByText('You are captain')).toBeInTheDocument()
    expect(calls.findLast((c) => c.method === 'POST' && c.path === '/teams').body).toEqual({ eventID: 1, teamName: 'Byte Club' })
  })

  it('joins a team with its code, or says why not', async () => {
    const { db } = stubBackend({ user: 'CTF0003' })
    openApp('/team?eventID=1')
    const code = await screen.findByLabelText('Join code')
    await userEvent.type(code, 'NOSUCHCODE')
    await userEvent.click(screen.getByRole('button', { name: 'Join team' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('no team with this join code')

    db.data.events.find((e) => e.eventID === 1).maxTeamSize = 2
    await userEvent.clear(code)
    await userEvent.type(code, 'ROOTACCESS01')
    await userEvent.click(screen.getByRole('button', { name: 'Join team' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This team is full.')

    db.data.events.find((e) => e.eventID === 1).maxTeamSize = 4
    await userEvent.click(screen.getByRole('button', { name: 'Join team' }))
    expect(await screen.findByRole('heading', { name: 'Root Access' })).toBeInTheDocument()
    expect(await memberRow('Carol')).toHaveTextContent('you')
  })

  it('says when teams can no longer be formed', async () => {
    const { db } = stubBackend({ user: 'CTF0003' })
    db.data.events.find((e) => e.eventID === 1).regToTS = '2000-01-01-00.00.00.000000'
    openApp('/team?eventID=1')
    expect(await screen.findByText(/teams can only be formed while registration is open/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Team name')).not.toBeInTheDocument()
  })
})

describe('before the start', () => {
  it('lets a captain with members leave only after handing over', async () => {
    upcomingTeam()
    openApp('/team?eventID=3')
    const carol = await memberRow('Carol')
    expect(carol).toHaveTextContent('Hand over captaincy before you leave.')
    await confirm(await memberRow('Erin'), 'Make captain', 'Hand over')
    await vi.waitFor(async () => expect(await memberRow('Erin')).toHaveTextContent('Captain'))
    expect(screen.queryByText('You are captain')).not.toBeInTheDocument()

    await confirm(await memberRow('Carol'), 'Leave team', 'Leave')
    expect(await screen.findByRole('heading', { name: 'Find a team' })).toBeInTheDocument()
  })

  it('lets the captain remove a member', async () => {
    upcomingTeam()
    openApp('/team?eventID=3')
    const erin = await memberRow('Erin')
    await userEvent.click(within(erin).getByRole('button', { name: 'Remove' }))
    expect(screen.getByRole('group', { name: 'Remove' })).toHaveTextContent('Remove Erin from the team?')
    await userEvent.click(within(screen.getByRole('group', { name: 'Remove' })).getByRole('button', { name: 'Remove' }))
    await vi.waitFor(() => expect(screen.getByText('Members', { selector: 'dt' }).nextSibling).toHaveTextContent('1 of 4'))
    expect(screen.queryByText('Erin')).not.toBeInTheDocument()
  })

  it('deletes the team when the last member leaves', async () => {
    const { db } = stubBackend({ user: 'CTF0003' })
    db.createTeam('CTF0003', { eventID: 3, teamName: 'Solo Club' })
    openApp('/team?eventID=3')
    const carol = await memberRow('Carol')
    await userEvent.click(within(carol).getByRole('button', { name: 'Leave team' }))
    expect(screen.getByRole('group', { name: 'Leave team' })).toHaveTextContent('the team is deleted')
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }))
    expect(await screen.findByRole('heading', { name: 'Find a team' })).toBeInTheDocument()
    expect(db.data.teams.some((t) => t.teamName === 'Solo Club')).toBe(false)
  })
})
