import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../../api/client'
import { stubBackend } from '../../test/backend'
import { openApp } from '../../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => vi.unstubAllGlobals())

const asOrganizer = () => stubBackend({ user: 'ADMIN01' })
const open = async (eventID) => {
  openApp(`/admin/event?eventID=${eventID}&tab=challenges`)
  return screen.findByRole('list', { name: 'Challenges of the event' })
}
const rowOf = (title) => screen.getByRole('link', { name: title }).closest('li')
const titles = (list) => within(list).getAllByRole('link').map((l) => l.textContent)

describe('the challenges of an event', () => {
  it('lists them in order with scoring, visibility and prerequisites', async () => {
    asOrganizer()
    const list = await open(1)
    expect(titles(list)).toEqual(['Hello mainframe', 'Cookie jar', 'Caesar salad', 'Lost in the logs',
      'JCL detective', 'EBCDIC or bust', 'RACF riddle', 'The final boss'])
    expect(screen.getByRole('note')).toHaveTextContent('counts for earlier solves too')
    expect(rowOf('Lost in the logs')).toHaveTextContent('Hidden')
    expect(rowOf('Caesar salad')).toHaveTextContent('100 points · 3 attempts')
    expect(rowOf('RACF riddle')).toHaveTextContent('Dynamic: 500 down to 100 over 5 solves · No attempt limit')
    await vi.waitFor(() => expect(rowOf('The final boss')).toHaveTextContent('Needs JCL detective, RACF riddle'))
    expect(screen.getByRole('link', { name: 'Challenges' })).toHaveAttribute('aria-current', 'page')
  })

  it('shows a hidden challenge, and keeps one with submissions in', async () => {
    asOrganizer()
    await open(1)
    await userEvent.click(screen.getByRole('button', { name: 'Show Lost in the logs' }))
    await vi.waitFor(() => expect(rowOf('Lost in the logs')).toHaveTextContent('Visible'))

    const caesar = rowOf('Caesar salad')
    await userEvent.click(within(caesar).getByRole('button', { name: 'Take out Caesar salad' }))
    await userEvent.click(within(caesar).getByRole('button', { name: 'Take out' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The challenge has submissions: hide it instead.')
  })

  it('changes the scoring to dynamic, after checking it', async () => {
    const { calls } = asOrganizer()
    await open(1)
    await userEvent.click(screen.getByRole('button', { name: 'Edit Cookie jar' }))
    const form = screen.getByRole('form', { name: 'Scoring of Cookie jar' })
    await userEvent.selectOptions(within(form).getByLabelText('Scoring'), 'D')
    await userEvent.clear(within(form).getByLabelText('Minimum value'))
    await userEvent.type(within(form).getByLabelText('Minimum value'), '200')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))
    expect(within(form).getByText('Between 0 and the initial value')).toBeInTheDocument()
    expect(within(form).getByText('1 or more')).toBeInTheDocument()

    await userEvent.clear(within(form).getByLabelText('Minimum value'))
    await userEvent.type(within(form).getByLabelText('Minimum value'), '50')
    await userEvent.clear(within(form).getByLabelText('Decay (solves)'))
    await userEvent.type(within(form).getByLabelText('Decay (solves)'), '10')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(rowOf('Cookie jar')).toHaveTextContent('Dynamic: 150 down to 50 over 10 solves'))
    expect(calls.find((c) => c.method === 'PUT')).toMatchObject({
      path: '/admin/eventChallenges/4', query: { eventID: '1' },
      body: { scoreType: 'D', initPoints: 150, minPoints: 50, decaySolves: 10, isVisible: 'Y', sortOrder: 1, maxAttempts: 0 },
    })
  })

  it('adds and removes prerequisites, but no cycles', async () => {
    asOrganizer()
    await open(1)
    await userEvent.click(screen.getByRole('button', { name: 'Edit The final boss' }))
    const boss = screen.getByRole('region', { name: 'Prerequisites of The final boss' })
    await userEvent.click(await within(boss).findByRole('button', { name: 'Remove prerequisite JCL detective' }))
    await vi.waitFor(() => expect(rowOf('The final boss')).toHaveTextContent('Needs RACF riddle'))
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    await userEvent.click(screen.getByRole('button', { name: 'Edit RACF riddle' }))
    const riddle = screen.getByRole('region', { name: 'Prerequisites of RACF riddle' })
    await userEvent.selectOptions(within(riddle).getByLabelText('Add a prerequisite'), 'The final boss')
    await userEvent.click(within(riddle).getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This prerequisite would make a cycle.')
    await userEvent.selectOptions(within(riddle).getByLabelText('Add a prerequisite'), 'Hello mainframe')
    await userEvent.click(within(riddle).getByRole('button', { name: 'Add' }))
    await vi.waitFor(() => expect(rowOf('RACF riddle')).toHaveTextContent('Needs Hello mainframe'))
  })

  it('adds a library challenge to a draft, hidden at first', async () => {
    const { calls } = asOrganizer()
    openApp('/admin/event?eventID=6&tab=challenges')
    expect(await screen.findByText(/no challenges yet/i)).toBeInTheDocument()
    const form = await screen.findByRole('form', { name: 'Add a challenge' })
    await userEvent.click(within(form).getByRole('button', { name: 'Add to event' }))
    expect(within(form).getByText('Pick a challenge')).toBeInTheDocument()
    await userEvent.selectOptions(within(form).getByLabelText('Challenge'), 'Cookie jar (WEB)')
    await userEvent.click(within(form).getByRole('button', { name: 'Add to event' }))
    const list = await screen.findByRole('list', { name: 'Challenges of the event' })
    expect(titles(list)).toEqual(['Cookie jar'])
    expect(rowOf('Cookie jar')).toHaveTextContent('Hidden')
    expect(calls.find((c) => c.method === 'POST').body).toMatchObject({ eventID: 6, challengeID: 4, sortOrder: 1, isVisible: 'N' })
    expect(within(screen.getByLabelText('Challenge')).queryByRole('option', { name: /cookie jar/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('note')).not.toBeInTheDocument() // not running
  })

  it('shows a closed event read-only', async () => {
    asOrganizer()
    await open(5)
    expect(screen.getByText(/its challenges can no longer change/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Edit / })).not.toBeInTheDocument()
    expect(screen.queryByRole('form', { name: 'Add a challenge' })).not.toBeInTheDocument()
  })
})
