// The backend's one-letter codes in words. Values from ctf_1.0.0.yaml.

export const PHASE = { U: 'Upcoming', R: 'Running', F: 'Frozen', E: 'Ended' }
export const EVENT_STATUS = { D: 'Draft', P: 'Published', C: 'Closed' }
export const PLAY_MODE = { I: 'Individual', T: 'Teams' }
export const PART_STATUS = { P: 'Pending', A: 'Active' }
export const REGISTRATION_STATUS = {
  P: 'Pending',
  R: 'Ready',
  A: 'Active',
  F: 'Failed',
  V: 'Revoked',
  X: 'Deleted',
}
export const ROLE = { A: 'Organizer', P: 'Player' }
// Provisioning jobs (TBCTF004)
export const PROV_ACTION = {
  C: 'Create', N: 'Connect', M: 'Remove', P: 'Reset', V: 'Revoke', U: 'Resume', X: 'Delete',
}
export const JOB_STATUS = { N: 'New', Q: 'Queued', S: 'Submitted', D: 'Done', F: 'Failed' }

// The word for a code, or the code itself when it is unknown, so a new code
// shows up instead of disappearing.
export function label(map, code) {
  const c = String(code ?? '').trim().toUpperCase()
  return map[c] ?? c
}

export function isYes(value) {
  return String(value ?? '').trim().toUpperCase() === 'Y'
}

// The phase only exists for published events; a closed one is "Closed".
export function eventPhase({ eventStatus, phase }) {
  if (String(eventStatus ?? '').trim().toUpperCase() === 'C') return 'Closed'
  return label(PHASE, phase)
}

// Running or frozen: flags can be submitted and hints unlocked.
export function isPlayable({ eventStatus, phase }) {
  const p = String(phase ?? '').trim().toUpperCase()
  return String(eventStatus ?? 'P').trim().toUpperCase() !== 'C' && (p === 'R' || p === 'F')
}

// attemptsLeft is -1 when there is no limit.
export function attemptsText(attemptsLeft) {
  if (attemptsLeft === undefined || attemptsLeft === null || attemptsLeft < 0) return 'No limit'
  return attemptsLeft === 1 ? '1 attempt left' : `${attemptsLeft} attempts left`
}
