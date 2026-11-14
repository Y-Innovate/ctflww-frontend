import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setUnauthorizedHandler } from '../api/client'
import { stubBackend } from '../test/backend'
import { openApp } from '../test/render'

setUnauthorizedHandler(() => {})
let user
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function registerAs(name, code = 'SPRING-TEAM-2026') {
  await user.type(await screen.findByLabelText('Registration code'), code)
  await user.type(screen.getByLabelText('Display name'), name)
  await user.click(screen.getByRole('button', { name: 'Register' }))
}

// Lets the RACF job of the mock finish, and the page see it
async function jobDone(backend) {
  backend.advance(6000)
  await act(() => vi.advanceTimersByTimeAsync(5000))
}

describe('registering', () => {
  it('goes from code and name, via the claim token, to a passphrase and the userid', async () => {
    const backend = stubBackend()
    openApp('/register?eventID=1')
    expect(await screen.findByRole('heading', { name: 'Register for Spring Team CTF' })).toBeInTheDocument()
    await registerAs('Newbie')

    const token = (await screen.findByLabelText('Claim token', { selector: 'code' })).textContent
    expect(token).toMatch(/^\w{4}-\w{4}-\w{4}-\w{4}$/)
    expect(window.location.search).toMatch(/^\?registrationID=\d+$/)
    expect(await screen.findByText(/being made/i)).toBeInTheDocument()

    await jobDone(backend)
    expect(await screen.findByRole('heading', { name: 'Choose your passphrase' })).toBeInTheDocument()
    expect(screen.getByLabelText('Claim token', { selector: 'input' })).toHaveValue(token)

    await user.type(screen.getByLabelText('Passphrase'), 'too short')
    expect(screen.getByText(/at least 14 characters, please/i)).toBeInTheDocument()
    await user.clear(screen.getByLabelText('Passphrase'))
    await user.type(screen.getByLabelText('Passphrase'), 'correct horse battery')
    await user.type(screen.getByLabelText('Passphrase again'), 'correct horse batteryX')
    expect(screen.getByText('The two passphrases differ.')).toBeInTheDocument()
    await user.type(screen.getByLabelText('Passphrase again'), '{Backspace}')
    await user.click(screen.getByRole('button', { name: 'Save passphrase' }))

    const userid = await screen.findByLabelText('Your userid')
    expect(userid.textContent).toMatch(/^CTF\d{4}$/)
    const card = userid.closest('section')
    expect(within(card).getByRole('link', { name: 'Sign in' }).getAttribute('href'))
      .toBe(`/ctf/login?userid=${userid.textContent}&returnTo=${encodeURIComponent('/ctf/my')}`)
    expect(backend.db.signIn(userid.textContent, 'correct horse battery')).toBeTruthy()

    // The token was only ever in memory
    const stored = JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }) + window.location.href
    expect(stored).not.toContain(token)
    expect(stored).not.toContain('correct horse')
  })

  it('refuses a wrong code, a taken name and a full event', async () => {
    const backend = stubBackend()
    openApp('/register?eventID=1')
    await registerAs('Someone', 'WRONG')
    expect(await screen.findByRole('alert')).toHaveTextContent(/registration code is wrong, or registration has closed/i)

    await user.clear(screen.getByLabelText('Registration code'))
    await user.type(screen.getByLabelText('Registration code'), 'SPRING-TEAM-2026')
    await user.clear(screen.getByLabelText('Display name'))
    await user.type(screen.getByLabelText('Display name'), 'ALICE')
    await user.click(screen.getByRole('button', { name: 'Register' }))
    expect(await screen.findByText(/this name is taken/i)).toBeInTheDocument()

    backend.db.data.events.find((e) => e.eventID === 1).maxPlayers = 0
    await user.clear(screen.getByLabelText('Display name'))
    await user.type(screen.getByLabelText('Display name'), 'Latecomer')
    await user.click(screen.getByRole('button', { name: 'Register' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This event is full.')
  })

  it('says when registration is closed', async () => {
    stubBackend()
    openApp('/register?eventID=2')
    expect(await screen.findByText(/registration for frozen night ctf is closed/i)).toBeInTheDocument()
    expect(screen.queryByLabelText('Registration code')).not.toBeInTheDocument()
  })

  it('sends a signed-in player to join instead', async () => {
    stubBackend({ user: 'CTF0004' })
    openApp('/register?eventID=1')
    expect(await screen.findByRole('link', { name: 'Join this event' })).toHaveAttribute('href', '/ctf/my?join=1')
  })
})

describe('coming back later', () => {
  it('asks for the claim token, and says when it is wrong', async () => {
    const backend = stubBackend()
    const { registrationID, claimToken } = backend.db.register({
      eventID: 1, regCode: 'SPRING-TEAM-2026', displayName: 'Returner',
    }).body
    backend.advance(6000)
    openApp(`/register?registrationID=${registrationID}`)
    const tokenField = await screen.findByLabelText('Claim token', { selector: 'input' })
    expect(tokenField).toHaveValue('')
    expect(screen.queryByText(/write down your claim token/i)).not.toBeInTheDocument()

    await user.type(tokenField, 'AAAA-BBBB-CCCC-DDDD')
    await user.type(screen.getByLabelText('Passphrase'), 'a long enough phrase')
    await user.type(screen.getByLabelText('Passphrase again'), 'a long enough phrase')
    await user.click(screen.getByRole('button', { name: 'Save passphrase' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/claim token is wrong/i)
    expect(screen.getByLabelText('Passphrase')).toHaveValue('')

    await user.clear(tokenField)
    await user.type(tokenField, claimToken)
    await user.type(screen.getByLabelText('Passphrase'), 'a long enough phrase')
    await user.type(screen.getByLabelText('Passphrase again'), 'a long enough phrase')
    await user.click(screen.getByRole('button', { name: 'Save passphrase' }))
    expect(await screen.findByLabelText('Your userid')).toBeInTheDocument()
  })

  it('shows RACF refusing the passphrase', async () => {
    const backend = stubBackend()
    const { registrationID, claimToken } = backend.db.register({
      eventID: 1, regCode: 'SPRING-TEAM-2026', displayName: 'Picky',
    }).body
    backend.advance(6000)
    // The mock refuses anything under 14 characters; the form doesn't send
    // those, so make the mock stricter for this test
    const activate = backend.db.activate
    backend.db.activate = (id, body) => (body.passphrase.includes('password')
      ? { status: 400, body: { retCode: '08', reasonCode: '56', infoMessage: 'Not allowed by the RACF rules' } }
      : activate(id, body))
    openApp(`/register?registrationID=${registrationID}`)
    await user.type(await screen.findByLabelText('Claim token', { selector: 'input' }), claimToken)
    await user.type(screen.getByLabelText('Passphrase'), 'password password')
    await user.type(screen.getByLabelText('Passphrase again'), 'password password')
    await user.click(screen.getByRole('button', { name: 'Save passphrase' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('The mainframe refused this passphrase. Not allowed by the RACF rules')
  })

  it('says when the job failed', async () => {
    const backend = stubBackend()
    const { registrationID } = backend.db.register({ eventID: 1, regCode: 'SPRING-TEAM-2026', displayName: 'Please fail' }).body
    openApp(`/register?registrationID=${registrationID}`)
    await screen.findByText(/being made/i)
    await jobDone(backend)
    expect(await screen.findByText(/job that makes your userid failed/i)).toHaveTextContent(`registration number ${registrationID}`)
  })

  it('says when the account is active already, or unknown', async () => {
    stubBackend()
    openApp('/register?registrationID=1')
    expect(await screen.findByRole('heading', { name: 'Your account is ready' })).toBeInTheDocument()
  })

  it('says when the registration does not exist', async () => {
    stubBackend()
    openApp('/register?registrationID=999')
    expect(await screen.findByRole('heading', { name: 'Registration not found' })).toBeInTheDocument()
  })
})
