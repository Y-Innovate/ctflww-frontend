import { expect, it } from 'vitest'
import { rememberReturn, safeReturn } from './returnTo'

const ORIGIN = 'https://t01.example'

it('accepts paths of the app, also as a full URL of this host', () => {
  expect(safeReturn('/ctf/board?eventID=1', ORIGIN)).toBe('/ctf/board?eventID=1')
  expect(safeReturn('https://t01.example/ctf/team?eventID=2', ORIGIN)).toBe('/ctf/team?eventID=2')
})

it('drops a trailing slash, which LWW refuses', () => {
  expect(safeReturn('/ctf/', ORIGIN)).toBe('/ctf')
  expect(safeReturn('/ctf', ORIGIN)).toBe('/ctf')
  expect(safeReturn('/ctf/?x=1', ORIGIN)).toBe('/ctf?x=1')
  expect(safeReturn('/ctf/my/', ORIGIN)).toBe('/ctf/my')
  expect(safeReturn('https://t01.example/ctf/', ORIGIN)).toBe('/ctf')
})

it('refuses anything that leaves the app', () => {
  for (const bad of ['https://evil.example/ctf/', '//evil.example/ctf/', '/otherapp/', '/ctfx/', '/ctf//evil', 'javascript:alert(1)',
    '/ctf\\..\\x', '', null, undefined, '/ctf/login', '/ctf/login?failed=1']) {
    expect(safeReturn(bad, ORIGIN)).toBeNull()
  }
})

it('keeps the path for the LWW pages in sessionStorage', () => {
  rememberReturn('/ctf/my')
  expect(sessionStorage.getItem('requestedURL')).toBe('/ctf/my')
  rememberReturn(null)
  expect(sessionStorage.getItem('requestedURL')).toBeNull()
})
