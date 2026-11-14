import { expect, it, vi } from 'vitest'
import { markSeen, seenIds, unreadCount } from './seen'

it('remembers seen announcements per event', () => {
  expect(unreadCount(1, [3, 2, 1])).toBe(3)
  markSeen(1, [1, 2])
  expect(unreadCount(1, [3, 2, 1])).toBe(1)
  expect(unreadCount(2, [3, 2, 1])).toBe(3)
})

it('tells listeners when something was marked', () => {
  const listener = vi.fn()
  window.addEventListener('ctf:seen', listener)
  markSeen(4, [9])
  expect(listener).toHaveBeenCalled()
  window.removeEventListener('ctf:seen', listener)
})

it('survives rubbish in localStorage', () => {
  localStorage.setItem('ctf.seenAnnouncements.5', 'not json')
  expect(seenIds(5).size).toBe(0)
})
