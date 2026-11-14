import { beforeEach, describe, expect, it } from 'vitest'
import { challengeValue, createDb, httpStatus } from './db.js'
import { buildSeed } from './seed.js'

const NOW = new Date(2026, 10, 10, 12, 0, 0)
let clock
let db

beforeEach(() => {
  clock = { now: NOW }
  db = createDb(buildSeed(NOW), () => clock.now)
})

const later = (ms) => {
  clock.now = new Date(clock.now.getTime() + ms)
}
const reason = (r) => `${r.body.retCode} ${r.body.reasonCode}`

describe('rules shared with the backend', () => {
  it('maps codes to HTTP status as the wrappers do', () => {
    expect(httpStatus('00', '00')).toBe(200)
    expect(httpStatus('04', '01')).toBe(404)
    expect(httpStatus('08', '13')).toBe(404)
    expect(httpStatus('08', '54')).toBe(409)
    expect(httpStatus('08', '55')).toBe(403)
    expect(httpStatus('08', '02')).toBe(400)
    expect(httpStatus('08', '56')).toBe(400)
    expect(httpStatus('08', '21')).toBe(500)
  })

  it('computes dynamic values as in the data model', () => {
    const ec = { scoreType: 'D', initPoints: 500, minPoints: 100, decaySolves: 5 }
    expect([1, 2, 3, 4, 5, 6].map((n) => challengeValue(ec, n))).toEqual([500, 484, 436, 356, 244, 100])
    expect(challengeValue({ scoreType: 'S', initPoints: 150 }, 9)).toBe(150)
  })
})

describe('public', () => {
  it('lists published and closed events, newest first, without the draft', () => {
    const { events } = db.listEvents({}).body
    expect(events.map((e) => e.eventID)).toEqual([5, 4, 3, 2, 1])
    expect(events.map((e) => e.phase)).toEqual(['', 'E', 'U', 'F', 'R'])
    expect(events.find((e) => e.eventID === 1).registrationOpen).toBe('Y')
    expect(events[0]).not.toHaveProperty('regCode')
    expect(db.getEvent(6).status).toBe(404)
  })

  it('pages the leaderboard and hides what happened after the freeze', () => {
    const first = db.leaderboard(2, {}).body
    expect(first.isFrozen).toBe('Y')
    expect(first.leaderboard).toHaveLength(20)
    const second = db.leaderboard(2, { rank_since: 20 }).body.leaderboard
    expect(second[0].rank).toBe(21)
    const dave = [...first.leaderboard, ...second].find((r) => r.teamName === 'Dave')
    expect(dave.solveCount).toBe(1) // his two solves after the freeze don't show
  })

  it('ranks by score, then by who got there first', () => {
    const board = db.leaderboard(1, {}).body.leaderboard
    expect(board.map((r) => r.teamName)).toEqual(['Root Access', 'Packet Pirates', 'Null Pointers'])
    // Root Access: 100 + 100 + 484 (dynamic, 2 solves) + 50 award - 10 hint
    expect(board[0].score).toBe(724)
  })

  it('registers, waits for the job and activates', () => {
    const reg = db.register({ eventID: 1, regCode: 'SPRING-TEAM-2026', displayName: 'Newbie' })
    expect(reg.status).toBe(201)
    const { registrationID, claimToken } = reg.body
    expect(db.registrationStatus(registrationID).body.registrationStatus).toBe('P')
    expect(reason(db.activate(registrationID, { claimToken, passphrase: 'long enough phrase' }))).toBe('08 53')
    later(6000)
    expect(db.registrationStatus(registrationID).body.registrationStatus).toBe('R')
    expect(reason(db.activate(registrationID, { claimToken: 'XXXX', passphrase: 'long enough phrase' }))).toBe('08 57')
    expect(reason(db.activate(registrationID, { claimToken, passphrase: 'short' }))).toBe('08 56')
    const done = db.activate(registrationID, { claimToken, passphrase: 'long enough phrase' })
    expect(done.status).toBe(201)
    expect(done.body.racfUserid).toMatch(/^CTF\d{4}$/)
    expect(db.signIn(done.body.racfUserid, 'long enough phrase')).toBeTruthy()
  })

  it('refuses wrong codes, closed registration, taken names and full events', () => {
    expect(reason(db.register({ eventID: 1, regCode: 'nope', displayName: 'X' }))).toBe('08 51')
    expect(reason(db.register({ eventID: 2, regCode: 'FROZEN-NIGHT-2026', displayName: 'X' }))).toBe('08 51')
    expect(reason(db.register({ eventID: 1, regCode: 'SPRING-TEAM-2026', displayName: 'alice' }))).toBe('08 11')
    expect(reason(db.register({ eventID: 1, regCode: 'SPRING-TEAM-2026', displayName: '' }))).toBe('08 02')
    for (let i = 0; i < 6; i++) db.register({ eventID: 3, regCode: 'SUMMER-TEAM-2026', displayName: `Fill ${i}` })
    expect(reason(db.register({ eventID: 3, regCode: 'SUMMER-TEAM-2026', displayName: 'One too many' }))).toBe('08 52')
  })

  it('lets a registration fail when the name asks for it', () => {
    const { registrationID } = db.register({ eventID: 1, regCode: 'SPRING-TEAM-2026', displayName: 'Please fail' }).body
    later(6000)
    expect(db.registrationStatus(registrationID).body.registrationStatus).toBe('F')
  })
})

describe('sessions', () => {
  it('signs players in, refuses wrong passphrases, and knows the admin', () => {
    expect(db.signIn('ctf0001', 'wrong one')).toBeNull()
    expect(db.signIn('NOBODY', 'anything')).toBeNull()
    const token = db.signIn('ctf0001', 'anything')
    expect(db.userOf(token)).toBe('CTF0001')
    expect(db.me('CTF0001').body).toMatchObject({ role: 'P', displayName: 'Alice', playerID: 1 })
    expect(db.me(db.userOf(db.signInAdmin())).body).toMatchObject({ role: 'A', playerID: 0 })
    db.signOut(token)
    expect(db.userOf(token)).toBeNull()
  })
})

describe('player', () => {
  it('shows the board, with a locked challenge, and refuses without a team', () => {
    const board = db.board('CTF0001', { eventID: 1 }).body.challenges
    expect(board.map((c) => c.challengeID)).toEqual([1, 4, 5, 2, 6, 3, 8])
    expect(board.find((c) => c.challengeID === 8).isLocked).toBe('Y')
    expect(board.find((c) => c.challengeID === 3)).toMatchObject({ isSolved: 'Y', currentPoints: 484, solveCount: 2 })
    expect(reason(db.board('CTF0003', { eventID: 1 }))).toBe('08 50') // Carol has no team
    expect(reason(db.board('CTF0004', { eventID: 1 }))).toBe('08 50') // Dave isn't in it
    expect(reason(db.board('CTF0003', { eventID: 3 }))).toBe('08 50')
  })

  it('freezes values on the board but shows own solves', () => {
    const board = db.board('CTF0004', { eventID: 2 }).body.challenges
    const ebcdic = board.find((c) => c.challengeID === 6)
    expect(ebcdic).toMatchObject({ isSolved: 'Y', solveCount: 0 })
  })

  it('refuses a locked challenge but shows its prerequisites', () => {
    expect(reason(db.challenge('CTF0001', 8, { eventID: 1 }))).toBe('08 50')
    const reqs = db.prerequisites('CTF0001', { eventID: 1, challengeID: 8 }).body.prerequisites
    expect(reqs).toEqual([
      { reqChallengeID: 2, challengeTitle: 'JCL detective', isSolved: 'N' },
      { reqChallengeID: 3, challengeTitle: 'RACF riddle', isSolved: 'Y' },
    ])
    expect(reason(db.challenge('CTF0001', 7, { eventID: 1 }))).toBe('04 01') // hidden
  })

  it('submits flags: wrong, correct, already solved, attempts used up', () => {
    const sub = (challengeID, flag, user = 'CTF0001') => db.submit(user, { eventID: 1, challengeID, flag })
    expect(sub(2, 'nope').body).toMatchObject({ isCorrect: 'N', attemptsLeft: -1 })
    expect(sub(2, ' flag{rc12} ').body).toMatchObject({ isCorrect: 'Y' })
    expect(reason(sub(2, 'flag{rc12}', 'CTF0002'))).toBe('08 54') // teammate
    expect(db.challenge('CTF0001', 8, { eventID: 1 }).status).toBe(200) // unlocked now
    expect(reason(sub(5, ''))).toBe('08 02')
    // Packet Pirates: 3 attempts on Caesar salad
    for (let i = 0; i < 3; i++) expect(sub(5, 'x', 'CTF0006').body.isCorrect).toBe('N')
    expect(reason(sub(5, 'flag{rotate_me}', 'CTF0006'))).toBe('08 55')
  })

  it('honours the case sensitivity of each flag, as CTFM313', () => {
    const sub = (challengeID, flag) => db.submit('CTF0008', { eventID: 1, challengeID, flag }) // Null Pointers
    expect(sub(2, 'FLAG{RC12}').body.isCorrect).toBe('N') // case-sensitive
    expect(sub(3, 'Flag{secadm}').body.isCorrect).toBe('Y') // ignores case
  })

  it('refuses submissions outside the running event', () => {
    expect(reason(db.submit('CTF0001', { eventID: 4, challengeID: 1, flag: 'x' }))).toBe('08 53')
  })

  it('unlocks a hint once, and charges it once', () => {
    const before = db.progress('CTF0001', 1).body.score
    const first = db.unlockHint('CTF0001', { eventID: 1, hintID: 2 })
    expect(first.status).toBe(201)
    expect(first.body).toMatchObject({ cost: 25, hintText: 'The step name starts with STEP03.' })
    db.unlockHint('CTF0002', { eventID: 1, hintID: 2 })
    expect(db.progress('CTF0001', 1).body.score).toBe(before - 25)
    const hints = db.hints('CTF0001', { eventID: 1, challengeID: 2 }).body.hints
    expect(hints.map((h) => h.isUnlocked)).toEqual(['Y', 'Y'])
    const other = db.hints('CTF0006', { eventID: 1, challengeID: 2 }).body.hints
    expect(other.map((h) => h.hintText)).toEqual([null, null])
  })

  it('shows the join code to the captain only', () => {
    expect(db.progress('CTF0001', 1).body).toMatchObject({ isCaptain: 'Y', joinCode: 'ROOTACCESS01', memberCount: 2 })
    expect(db.progress('CTF0002', 1).body).toMatchObject({ isCaptain: 'N', joinCode: '' })
  })

  it('creates and joins teams while registration is open', () => {
    expect(reason(db.createTeam('CTF0003', { eventID: 3, teamName: 'root access' }))).toBe('00 00')
    expect(reason(db.createTeam('CTF0003', { eventID: 3, teamName: 'Another' }))).toBe('08 53')
    expect(reason(db.createTeam('CTF0003', { eventID: 1, teamName: 'ROOT ACCESS' }))).toBe('08 11')
    expect(reason(db.joinTeam('CTF0003', { eventID: 1, joinCode: 'nope' }))).toBe('04 01')
    expect(db.joinTeam('CTF0003', { eventID: 1, joinCode: 'rootaccess01' }).status).toBe(201)
    expect(reason(db.createTeam('CTF0004', { eventID: 2, teamName: 'Solo' }))).toBe('08 53') // individual
  })

  it('keeps teams fixed once the event has started', () => {
    expect(reason(db.removeMember('CTF0001', 2, { eventID: 1 }))).toBe('08 53')
    expect(db.handOver('CTF0001', 1, { playerID: 2 }).status).toBe(200)
    expect(reason(db.handOver('CTF0001', 1, { playerID: 1 }))).toBe('08 50') // not captain any more
  })

  it('leaves and removes before the start', () => {
    const team = db.createTeam('CTF0003', { eventID: 3, teamName: 'Early birds' }).body
    expect(reason(db.removeMember('CTF0003', 3, { eventID: 3 }))).toBe('00 00')
    expect(db.data.teams.some((t) => t.teamID === team.teamID)).toBe(false) // last member
  })

  it('lists announcements newest first, not for a pending place', () => {
    expect(db.announcements('CTF0003', { eventID: 1 }).body.announcements.map((a) => a.announceID)).toEqual([3, 2, 1])
    expect(reason(db.announcements('CTF0005', { eventID: 3 }))).toBe('08 50')
  })

  it('lists own events with their teams, and joins another', () => {
    const mine = db.myEvents('CTF0003', {}).body.events
    expect(mine.map((e) => [e.eventID, e.teamID ? e.teamName : ''])).toEqual([[1, ''], [2, 'Carol'], [3, '']])
    expect(reason(db.join('CTF0003', { eventID: 1, regCode: 'SPRING-TEAM-2026' }))).toBe('08 11')
    expect(db.join('CTF0002', { eventID: 3, regCode: 'SUMMER-TEAM-2026' }).status).toBe(201)
  })
})
