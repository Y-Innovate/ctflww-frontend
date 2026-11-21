import { expect, it } from 'vitest'
import { attemptsText, eventPhase, isArchived, isPlayable, isReadOnly, isYes, label, PLAY_MODE } from './codes'

it('translates codes, and shows unknown ones as they are', () => {
  expect(label(PLAY_MODE, 'T')).toBe('Teams')
  expect(label(PLAY_MODE, 't ')).toBe('Teams')
  expect(label(PLAY_MODE, 'Q')).toBe('Q')
  expect(label(PLAY_MODE, null)).toBe('')
})

it('reads Y/N', () => {
  expect(isYes('Y')).toBe(true)
  expect(isYes('y ')).toBe(true)
  expect(isYes('N')).toBe(false)
  expect(isYes('')).toBe(false)
})

it('gives a closed event the phase Closed', () => {
  expect(eventPhase({ eventStatus: 'P', phase: 'F' })).toBe('Frozen')
  expect(eventPhase({ eventStatus: 'C', phase: '' })).toBe('Closed')
  expect(eventPhase({ eventStatus: 'A', phase: '' })).toBe('Archived')
})

it('treats closed and archived events as read-only', () => {
  expect(isReadOnly({ eventStatus: 'C' })).toBe(true)
  expect(isReadOnly({ eventStatus: 'A' })).toBe(true)
  expect(isReadOnly({ eventStatus: 'P' })).toBe(false)
  expect(isReadOnly({ eventStatus: 'D' })).toBe(false)
  expect(isArchived({ eventStatus: 'A' })).toBe(true)
  expect(isArchived({ eventStatus: 'C' })).toBe(false)
})

it('knows when flags can be submitted', () => {
  expect(isPlayable({ eventStatus: 'P', phase: 'R' })).toBe(true)
  expect(isPlayable({ phase: 'F' })).toBe(true)
  expect(isPlayable({ eventStatus: 'P', phase: 'E' })).toBe(false)
  expect(isPlayable({ eventStatus: 'C', phase: 'R' })).toBe(false)
  expect(isPlayable({ eventStatus: 'A', phase: 'R' })).toBe(false)
})

it('writes attempts left', () => {
  expect(attemptsText(-1)).toBe('No limit')
  expect(attemptsText(1)).toBe('1 attempt left')
  expect(attemptsText(0)).toBe('0 attempts left')
})
