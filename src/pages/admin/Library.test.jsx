import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../../api/client'
import { stubBackend } from '../../test/backend'
import { openApp } from '../../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => vi.unstubAllGlobals())

const asOrganizer = () => stubBackend({ user: 'ADMIN01' })
const titles = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
  .map((r) => within(r).getByRole('link').textContent)
const section = (name) => screen.findByRole('region', { name })

async function confirm(scope, label, confirmLabel) {
  await userEvent.click(within(scope).getByRole('button', { name: label }))
  await userEvent.click(within(within(scope).getByRole('group', { name: label })).getByRole('button', { name: confirmLabel }))
}

describe('the library', () => {
  it('lists the challenges with their category, and filters on it', async () => {
    asOrganizer()
    openApp('/admin/library')
    await screen.findByRole('table')
    expect(titles()).toHaveLength(8)
    expect(screen.getByRole('link', { name: 'Cookie jar' }).closest('tr')).toHaveTextContent('Web')
    await vi.waitFor(() => expect(within(screen.getByLabelText('Category')).getAllByRole('option')).toHaveLength(6))
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'CRYPTO')
    await vi.waitFor(() => expect(titles()).toEqual(['Caesar salad', 'EBCDIC or bust']))
    expect(window.location.search).toBe('?category=CRYPTO')
  })

  it('creates a challenge after checking the form', async () => {
    const { calls } = asOrganizer()
    openApp('/admin/library')
    await userEvent.click(await screen.findByRole('link', { name: /new challenge/i }))
    await userEvent.click(await screen.findByRole('button', { name: 'Create challenge' }))
    expect(screen.getByText('A title is required')).toBeInTheDocument()
    expect(screen.getByText('Pick a category')).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText('Title'), 'Open redirect')
    await vi.waitFor(() => expect(within(screen.getByLabelText('Category')).getAllByRole('option').length).toBeGreaterThan(1))
    await userEvent.selectOptions(screen.getByLabelText('Category'), 'WEB')
    await userEvent.type(screen.getByLabelText(/description/i), 'Where does it send you?')
    await userEvent.click(screen.getByRole('button', { name: 'Create challenge' }))
    expect(await screen.findByRole('heading', { name: 'Open redirect' })).toBeInTheDocument()
    expect(within(await section('Flags')).getByText('None yet.')).toBeInTheDocument()
    expect(calls.find((c) => c.method === 'POST').body).toEqual({
      challengeTitle: 'Open redirect', category: 'WEB', challengeDescription: 'Where does it send you?',
      challengeType: 'S', verifierPgm: '',
    })
    expect(screen.queryByRole('note')).not.toBeInTheDocument() // in no running event
  })
})

describe('a library challenge', () => {
  it('warns that a running event uses it', async () => {
    asOrganizer()
    openApp('/admin/challenge?challengeID=2')
    expect(await screen.findByRole('note')).toHaveTextContent('Running now in Spring Team CTF')
  })

  it('saves a changed title', async () => {
    asOrganizer()
    openApp('/admin/challenge?challengeID=2')
    const title = await screen.findByLabelText('Title')
    await userEvent.clear(title)
    await userEvent.type(title, 'JCL detective II')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('heading', { name: 'JCL detective II' })).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent('Saved.')
  })

  it('keeps the last flag of a visible challenge, and adds one trimmed', async () => {
    const { calls } = asOrganizer()
    openApp('/admin/challenge?challengeID=2')
    const flagsBox = await section('Flags')
    await within(flagsBox).findByText('flag{rc12}')
    await confirm(flagsBox, 'Delete flag 1', 'Delete')
    expect(await within(flagsBox).findByRole('alert')).toHaveTextContent('The last flag of a challenge visible in an event.')

    await userEvent.click(within(flagsBox).getByRole('button', { name: 'New flag' }))
    const form = within(flagsBox).getByRole('form', { name: 'New flag' })
    await userEvent.click(within(form).getByLabelText('Flag'))
    await userEvent.paste('  flag{RC12} ')
    await userEvent.click(within(form).getByLabelText('Case sensitive'))
    await userEvent.click(within(form).getByRole('button', { name: 'Add flag' }))
    const added = await within(flagsBox).findByText('flag{RC12}')
    expect(added.closest('li')).toHaveTextContent('ignores case')
    expect(calls.find((c) => c.method === 'POST' && c.path === '/admin/flags').body)
      .toEqual({ challengeID: 2, flagValue: 'flag{RC12}', caseSensitive: 'N' })
  })

  it('keeps a hint that teams unlocked, and changes a cost', async () => {
    asOrganizer()
    openApp('/admin/challenge?challengeID=2')
    const hintsBox = await section('Hints')
    await within(hintsBox).findByText('Look at the JESYSMSG of each step.')
    await confirm(hintsBox, 'Delete hint 1', 'Delete')
    expect(await within(hintsBox).findByRole('alert')).toHaveTextContent('Teams have unlocked this hint.')

    await userEvent.click(within(hintsBox).getByRole('button', { name: 'Edit hint 2' }))
    const form = within(hintsBox).getByRole('form', { name: 'Edit hint 2' })
    const cost = within(form).getByLabelText('Cost (points)')
    await userEvent.clear(cost)
    await userEvent.type(cost, '30')
    await userEvent.click(within(form).getByRole('button', { name: 'Save' }))
    expect(await within(hintsBox).findByText('Order 2 · costs 30 points')).toBeInTheDocument()
  })

  it('adds a link, with both fields required', async () => {
    asOrganizer()
    openApp('/admin/challenge?challengeID=3')
    const linksBox = await section('Links')
    await within(linksBox).findByText('None yet.')
    await userEvent.click(within(linksBox).getByRole('button', { name: 'New link' }))
    const form = within(linksBox).getByRole('form', { name: 'New link' })
    await userEvent.type(within(form).getByLabelText('Name'), 'RACF manual')
    await userEvent.click(within(form).getByRole('button', { name: 'Add link' }))
    expect(within(form).getByText('Required')).toBeInTheDocument()
    await userEvent.type(within(form).getByLabelText('URL'), 'https://example.com/racf')
    await userEvent.click(within(form).getByRole('button', { name: 'Add link' }))
    expect(await within(linksBox).findByText('https://example.com/racf')).toBeInTheDocument()
  })

  it('deletes only a challenge that no event uses', async () => {
    asOrganizer()
    openApp('/admin/challenge?challengeID=2')
    const box = await section('Delete')
    await confirm(box, 'Delete challenge', 'Delete')
    expect(await within(box).findByRole('alert')).toHaveTextContent('The challenge is in an event; take it out first.')
  })

  it('deletes a spare challenge and goes back to the library', async () => {
    const { db } = asOrganizer()
    db.data.library.push({ challengeID: 9, challengeTitle: 'Spare', category: 'WEB', challengeDescription: 'x' })
    openApp('/admin/challenge?challengeID=9')
    await confirm(await section('Delete'), 'Delete challenge', 'Delete')
    await screen.findByRole('table')
    await vi.waitFor(() => expect(titles()).not.toContain('Spare'))
    expect(window.location.pathname).toBe('/ctf/admin/library')
  })
})
