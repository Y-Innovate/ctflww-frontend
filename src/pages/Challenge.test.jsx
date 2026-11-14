import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../api/client'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => vi.unstubAllGlobals())

const ALICE = 'CTF0001' // Root Access, event 1
const HEIDI = 'CTF0008' // Null Pointers, event 1

async function submit(flag) {
  const input = screen.getByLabelText('Flag')
  await userEvent.clear(input)
  await userEvent.click(input)
  await userEvent.paste(flag) // type() would read {...} as a key
  await userEvent.click(screen.getByRole('button', { name: 'Submit' }))
}

describe('a challenge', () => {
  it('shows the description, value, links and hints', async () => {
    stubBackend({ user: ALICE })
    openApp('/challenge?eventID=1&challengeID=2')
    expect(await screen.findByRole('heading', { name: 'JCL detective' })).toBeInTheDocument()
    expect(screen.getByText('z/OS')).toBeInTheDocument()
    expect(screen.getByText(/ended with RC 12/)).toBeInTheDocument()
    expect(screen.getByText('200 points')).toBeInTheDocument()
    expect(screen.getByText('No limit')).toBeInTheDocument()
    const link = await screen.findByRole('link', { name: /job output/i })
    expect(link).toHaveAttribute('href', 'https://example.com/ctf/jcl-detective.txt')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')

    const hints = await screen.findByRole('region', { name: 'Hints' })
    const items = within(hints).getAllByRole('listitem')
    expect(items[0]).toHaveTextContent('Hint 1')
    expect(items[0]).toHaveTextContent('Look at the JESYSMSG of each step.')
    expect(within(items[0]).queryByRole('button')).not.toBeInTheDocument()
    expect(items[1]).toHaveTextContent('25 points')
    expect(items[1]).not.toHaveTextContent('STEP03')
    expect(screen.getByRole('link', { name: 'All challenges' })).toHaveAttribute('href', '/ctf/board?eventID=1')
  })

  it('shows a link that is no web address as text', async () => {
    const { db } = stubBackend({ user: ALICE })
    db.data.links.push({ linkID: 9, challengeID: 2, linkName: 'Trap', linkUrl: 'javascript:alert(1)' })
    openApp('/challenge?eventID=1&challengeID=2')
    expect(await screen.findByText('Trap: javascript:alert(1)')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /trap/i })).not.toBeInTheDocument()
  })

  it('unlocks a hint after asking, with its cost', async () => {
    const { calls } = stubBackend({ user: ALICE })
    openApp('/challenge?eventID=1&challengeID=2')
    const hints = await screen.findByRole('region', { name: 'Hints' })
    await userEvent.click(within(hints).getByRole('button', { name: 'Unlock' }))
    const ask = screen.getByRole('group', { name: 'Unlock hint 2' })
    expect(ask).toHaveTextContent('This deducts 25 points from your team')
    await userEvent.click(within(ask).getByRole('button', { name: 'Cancel' }))
    expect(calls.some((c) => c.path === '/hintUnlocks')).toBe(false)

    await userEvent.click(within(hints).getByRole('button', { name: 'Unlock' }))
    await userEvent.click(screen.getByRole('button', { name: 'Unlock hint' }))
    expect(await screen.findByText('The step name starts with STEP03.')).toBeInTheDocument()
    expect(calls.find((c) => c.path === '/hintUnlocks').body).toEqual({ eventID: 1, hintID: 2 })
  })

  it('solves the challenge with the right flag', async () => {
    stubBackend({ user: ALICE })
    openApp('/challenge?eventID=1&challengeID=2')
    await screen.findByRole('heading', { name: 'JCL detective' })
    await submit('flag{rc12}')
    expect(await screen.findByRole('status')).toHaveTextContent('Correct! Solved for your team')
    expect(screen.getByText('Solved')).toBeInTheDocument()
    expect(screen.queryByLabelText('Flag')).not.toBeInTheDocument()
    expect(screen.getByText('1', { selector: 'dd' })).toBeInTheDocument() // solves
  })

  it('counts down the attempts on wrong flags, then closes', async () => {
    stubBackend({ user: HEIDI })
    openApp('/challenge?eventID=1&challengeID=5')
    expect(await screen.findByText('3 attempts left')).toBeInTheDocument()
    await submit('flag{nope}')
    expect(await screen.findByRole('status')).toHaveTextContent('That flag is wrong. 2 attempts left.')
    await submit('flag{nope2}')
    expect(await screen.findByText('That flag is wrong. 1 attempt left.')).toBeInTheDocument()
    await submit('flag{nope3}')
    expect(await screen.findByText(/used up the attempts/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Flag')).not.toBeInTheDocument()
  })

  it('says when a teammate was quicker', async () => {
    const { db } = stubBackend({ user: ALICE })
    openApp('/challenge?eventID=1&challengeID=2')
    await screen.findByRole('heading', { name: 'JCL detective' })
    db.data.solves.push({ eventID: 1, challengeID: 2, teamID: 1, playerID: 2, submissionID: 99, createdDate: '2000-01-01-00.00.00.000000' })
    await submit('flag{rc12}')
    expect(await screen.findByRole('status')).toHaveTextContent('A teammate was quicker')
  })

  it('shows what a locked challenge requires', async () => {
    stubBackend({ user: ALICE })
    openApp('/challenge?eventID=1&challengeID=8')
    expect(await screen.findByRole('heading', { name: 'The final boss' })).toBeInTheDocument()
    expect(screen.getByText('Locked')).toBeInTheDocument()
    expect((await screen.findByRole('link', { name: 'RACF riddle' })).closest('li')).toHaveTextContent('Solved:')
    expect(screen.getByRole('link', { name: 'JCL detective' }).closest('li')).toHaveTextContent('Not solved yet:')
    expect(screen.queryByLabelText('Flag')).not.toBeInTheDocument()
  })

  it('says when the challenge is not part of the event', async () => {
    stubBackend({ user: ALICE })
    openApp('/challenge?eventID=1&challengeID=7') // hidden
    expect(await screen.findByText(/isn't part of this event/)).toBeInTheDocument()
  })

  it('closes the flag form after the end', async () => {
    stubBackend({ user: ALICE })
    openApp('/challenge?eventID=4&challengeID=5')
    expect(await screen.findByText(/flags can no longer be submitted/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Flag')).not.toBeInTheDocument()
  })

  it('sends a player without a team to the team page', async () => {
    const { calls } = stubBackend({ user: 'CTF0003' }) // Carol
    openApp('/challenge?eventID=1&challengeID=2')
    expect(await screen.findByText(/you need a team to play/i)).toBeInTheDocument()
    expect(calls.some((c) => c.path.startsWith('/challenges'))).toBe(false)
  })
})

describe('a wrong flag without an attempt limit', () => {
  it('just says to try again', async () => {
    stubBackend({ user: ALICE })
    openApp('/challenge?eventID=1&challengeID=2')
    await screen.findByRole('heading', { name: 'JCL detective' })
    await submit('flag{nope}')
    expect(await screen.findByRole('status')).toHaveTextContent('That flag is wrong. Try again.')
    expect(screen.getByLabelText('Flag')).toHaveValue('flag{nope}')
  })
})
