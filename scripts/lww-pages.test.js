import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { PUBLIC_DIR } from './lww-dir.js'

// Runs the script of an LWW page of public/ as LWW would serve it, with
// &NEXTPAGE; filled in; returns where the page sends the browser.
function run(name, nextPage, requested) {
  const html = readFileSync(join(PUBLIC_DIR, name), 'utf8').replaceAll('&NEXTPAGE;', nextPage)
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1]
  const store = new Map(requested === undefined ? [] : [['requestedURL', requested]])
  const sessionStorage = {
    getItem: (k) => store.get(k) ?? null,
    removeItem: (k) => store.delete(k),
  }
  const replace = vi.fn()
  new Function('window', 'sessionStorage', script)({ location: { replace } }, sessionStorage)
  expect(store.has('requestedURL')).toBe(false)
  return replace.mock.calls[0][0]
}

describe.each([
  ['process_login.html', '/ctf/my'],
  ['auth', '/ctf'],
])('%s', (name, fallback) => {
  it('goes to the requested page after sign-in', () => {
    expect(run(name, 'true', '/ctf/board?eventID=1')).toBe('/ctf/board?eventID=1')
  })

  it('goes to its default page without one, or with one outside the app', () => {
    expect(run(name, 'true')).toBe(fallback)
    expect(run(name, 'true', 'https://evil.example/')).toBe(fallback)
    expect(run(name, 'true', '/ctf//evil.example')).toBe(fallback)
  })

  it('drops a trailing slash, which LWW refuses', () => {
    expect(run(name, 'true', '/ctf/')).toBe('/ctf')
    expect(run(name, 'true', '/ctf/my/?eventID=1')).toBe('/ctf/my?eventID=1')
    expect(run(name, 'true', '/ctfx')).toBe(fallback)
  })

  it('goes back to the sign-in page otherwise', () => {
    expect(run(name, 'false', '/ctf/my')).toBe('/ctf/login?failed=1')
  })
})

it('points the login redirect at the React sign-in page, and the organizer sign-in at Entra', () => {
  expect(readFileSync(join(PUBLIC_DIR, 'redirect_to_login.html'), 'utf8')).toBe('/ctf/login<% LINK(LWWADPLR) %>')
  // Only LWWADPLS, as fixed on t01: LWWADPLR there broke the redirect to Entra
  const sso = readFileSync(join(PUBLIC_DIR, 'redirect_to_sso_login.html'), 'utf8')
  expect(sso).toMatch(/^<% LINK\(LWWADPLS\) %>&AUTHEPV2;\?client_id=&CLIENTID;/)
  expect(sso).not.toContain('LWWADPLR')
})

it('has no page that sends the browser to a path ending in a slash', () => {
  for (const name of ['process_login.html', 'auth']) {
    // <base href="/ctf/"> must end in a slash; it is never navigated to
    const html = readFileSync(join(PUBLIC_DIR, name), 'utf8').replace(/<base [^>]*>/, '')
    expect(html).not.toMatch(/['"]\/ctf\/['"]/)
  }
})

describe('logout.html', () => {
  const page = () => readFileSync(join(PUBLIC_DIR, 'logout.html'), 'utf8')

  it('has LWW end the session with LWWADPLO, never from a cache', () => {
    const meta = readFileSync(join(PUBLIC_DIR, '.logout.html'), 'utf8')
    expect(meta).toMatch(/^\s+preexecLoadModule: "LWWADPLO"$/m)
    expect(meta).toMatch(/^\s+preventCache: "Y"$/m)
    expect(meta).toMatch(/^\s+transaction: "LWBL"$/m)
  })

  it('says so, and links back to the sign-in page', () => {
    expect(page()).toContain('You have been signed out')
    expect(page()).toContain('href="/ctf/login"')
  })

  it('forgets the page to return to after sign-in', () => {
    const script = /<script>([\s\S]*?)<\/script>/.exec(page())[1]
    const removeItem = vi.fn()
    new Function('sessionStorage', script)({ removeItem })
    expect(removeItem).toHaveBeenCalledWith('requestedURL')
  })

  it('has no & that LWW could take for a symbol to fill in', () => {
    expect(page()).not.toContain('&')
  })
})
