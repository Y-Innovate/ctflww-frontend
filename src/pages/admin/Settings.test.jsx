import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../../api/client'
import { stubBackend } from '../../test/backend'
import { openApp } from '../../test/render'

setUnauthorizedHandler(() => {})
afterEach(() => vi.unstubAllGlobals())

const section = (name) => screen.findByRole('region', { name })
const rowOf = (region, key) => within(region).getByText(key, { selector: 'code' }).closest('li')

async function openSettings(setup) {
  const backend = stubBackend({ user: 'ADMIN01' })
  setup?.(backend.db)
  openApp('/admin/settings')
  await section('Challenge categories')
  return backend
}

describe('the reference tables', () => {
  it('changes a text setting within the length of its field', async () => {
    const { calls } = await openSettings()
    const settings = await section('Settings')
    await userEvent.click(within(settings).getByRole('button', { name: 'Edit JOBCLASS' }))
    const input = within(settings).getByLabelText('Value of JOBCLASS')
    expect(input).toHaveAttribute('maxLength', '1')
    await userEvent.clear(input)
    expect(within(settings).getByText('A value is required')).toBeInTheDocument()
    expect(within(settings).getByRole('button', { name: 'Save' })).toBeDisabled()
    await userEvent.type(input, 'B')
    await userEvent.click(within(settings).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(rowOf(settings, 'JOBCLASS')).toHaveTextContent('B'))
    expect(calls.findLast((c) => c.method === 'PUT')).toMatchObject({
      path: '/admin/refTables/SETTINGS', query: { tabKey: 'JOBCLASS' }, body: { tabValue: 'B' },
    })
  })

  it('shows categories, RACF groups and settings', async () => {
    await openSettings()
    const categories = await section('Challenge categories')
    expect(rowOf(categories, 'ZOS')).toHaveTextContent('z/OS')
    const groups = await section('Allowed RACF groups')
    expect(rowOf(groups, 'CTFPLAY')).toBeInTheDocument()
    const settings = await section('Settings')
    // Every setting can be changed, none deleted or added
    expect(within(rowOf(settings, 'CLAIMHRS')).getByRole('button', { name: 'Edit CLAIMHRS' })).toBeInTheDocument()
    expect(within(rowOf(settings, 'JOBCLASS')).getByRole('button', { name: 'Edit JOBCLASS' })).toBeInTheDocument()
    expect(within(settings).queryByRole('button', { name: /delete/i })).not.toBeInTheDocument()
    expect(within(settings).queryByRole('form')).not.toBeInTheDocument()
  })

  it('shows a table the programs don\'t know too', async () => {
    await openSettings((db) => db.data.refTables.push({ tableID: 'EXTRA', tabKey: 'ONE', tabValue: 'x' }))
    expect(rowOf(await section('EXTRA'), 'ONE')).toHaveTextContent('x')
  })

  it('adds a category in upper case, but not one that exists', async () => {
    const { calls } = await openSettings()
    const categories = await section('Challenge categories')
    const form = within(categories).getByRole('form', { name: 'Add to Challenge categories' })
    await userEvent.type(within(form).getByLabelText('Key'), 'zos')
    await userEvent.type(within(form).getByLabelText('Name'), 'Again')
    await userEvent.click(within(form).getByRole('button', { name: 'Add' }))
    expect(await within(categories).findByRole('alert')).toHaveTextContent('This key exists already.')

    await userEvent.clear(within(form).getByLabelText('Key'))
    await userEvent.type(within(form).getByLabelText('Key'), 'pwn')
    await userEvent.clear(within(form).getByLabelText('Name'))
    await userEvent.type(within(form).getByLabelText('Name'), 'Binary exploitation')
    await userEvent.click(within(form).getByRole('button', { name: 'Add' }))
    await vi.waitFor(() => expect(rowOf(categories, 'PWN')).toHaveTextContent('Binary exploitation'))
    expect(calls.findLast((c) => c.method === 'POST').body).toEqual({ tableID: 'CATEGORY', tabKey: 'PWN', tabValue: 'Binary exploitation' })
    expect(within(form).getByLabelText('Key')).toHaveValue('')
  })

  it('changes a setting, to a number only', async () => {
    await openSettings()
    const settings = await section('Settings')
    await userEvent.click(within(settings).getByRole('button', { name: 'Edit CLAIMHRS' }))
    const input = within(settings).getByLabelText('Value of CLAIMHRS')
    await userEvent.clear(input)
    await userEvent.type(input, 'a day')
    expect(within(settings).getByText('A number')).toBeInTheDocument()
    expect(within(settings).getByRole('button', { name: 'Save' })).toBeDisabled()
    await userEvent.clear(input)
    await userEvent.type(input, '24')
    await userEvent.click(within(settings).getByRole('button', { name: 'Save' }))
    await vi.waitFor(() => expect(rowOf(settings, 'CLAIMHRS')).toHaveTextContent('24'))
    expect(rowOf(settings, 'CLAIMHRS')).toHaveTextContent('ADMIN01')
  })

  it('deletes a category nobody uses, and says why one in use stays', async () => {
    await openSettings()
    const categories = await section('Challenge categories')
    await userEvent.click(within(rowOf(categories, 'ZOS')).getByRole('button', { name: 'Delete ZOS' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Delete ZOS' })).getByRole('button', { name: 'Delete' }))
    expect(await within(categories).findByRole('alert')).toHaveTextContent('A challenge uses this category.')

    await userEvent.click(within(rowOf(categories, 'MISC')).getByRole('button', { name: 'Delete MISC' }))
    await userEvent.click(within(screen.getByRole('group', { name: 'Delete MISC' })).getByRole('button', { name: 'Delete' }))
    await vi.waitFor(() => expect(within(categories).queryByText('MISC')).not.toBeInTheDocument())
  })
})
