import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { setNavigator } from '../api/client'
import { stubBackend } from '../test/backend'

function open(path) {
  window.history.pushState({}, '', `/ctf${path}`)
  return render(<App />)
}

let goTo
beforeEach(() => {
  goTo = vi.fn()
  setNavigator(goTo)
  sessionStorage.clear()
})
afterEach(() => {
  setNavigator(null)
  vi.unstubAllGlobals()
})

it('posts userid and passphrase to LWW, not to the API', async () => {
  stubBackend()
  open('/login')
  const userid = await screen.findByLabelText('Userid')
  const form = userid.closest('form')
  expect(form).toHaveAttribute('action', '/ctf/process_login.html')
  expect(form).toHaveAttribute('method', 'post')
  expect(userid).toHaveAttribute('name', 'username')
  expect(screen.getByLabelText('Passphrase')).toHaveAttribute('name', 'password')
  expect(screen.getByLabelText('Passphrase')).toHaveAttribute('type', 'password')
})

it('remembers the requested page for after sign-in, from LWW or the app', async () => {
  stubBackend()
  open(`/login?requestedURL=${encodeURIComponent('/ctf/board?eventID=1')}`)
  await screen.findByLabelText('Userid')
  expect(sessionStorage.getItem('requestedURL')).toBe('/ctf/board?eventID=1')
})

it('ignores a requested page outside the app', async () => {
  stubBackend()
  open(`/login?returnTo=${encodeURIComponent('https://evil.example/')}`)
  await screen.findByLabelText('Userid')
  expect(sessionStorage.getItem('requestedURL')).toBeNull()
})

it('says when sign-in failed', async () => {
  stubBackend()
  open('/login?failed=1')
  expect(await screen.findByRole('alert')).toHaveTextContent(/sign-in failed/i)
})

it('shows and hides the passphrase', async () => {
  stubBackend()
  open('/login')
  await userEvent.click(await screen.findByRole('button', { name: 'Show passphrase' }))
  expect(screen.getByLabelText('Passphrase')).toHaveAttribute('type', 'text')
  await userEvent.click(screen.getByRole('button', { name: 'Hide passphrase' }))
  expect(screen.getByLabelText('Passphrase')).toHaveAttribute('type', 'password')
})

it('starts the organizer sign-in at LWW', async () => {
  stubBackend()
  open('/login')
  await userEvent.click(await screen.findByRole('button', { name: /organizer sign-in/i }))
  expect(goTo).toHaveBeenCalledWith('/ctf/redirect_to_sso_login.html')
})

it('tells a signed-in player so', async () => {
  stubBackend({ user: 'CTF0002' })
  open('/login')
  expect(await screen.findByText(/signed in as Bob/i)).toBeInTheDocument()
})

it('fills in the userid it was given after registering', async () => {
  stubBackend()
  open('/login?userid=CTF0042&returnTo=%2Fctf%2Fmy')
  expect(await screen.findByLabelText('Userid')).toHaveValue('CTF0042')
  expect(sessionStorage.getItem('requestedURL')).toBe('/ctf/my')
})
