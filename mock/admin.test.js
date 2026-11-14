import { beforeEach, describe, expect, it } from 'vitest'
import { createDb } from './db.js'
import { dispatch } from './routes.js'
import { buildSeed } from './seed.js'

let db
beforeEach(() => {
  db = createDb(buildSeed())
})

const get = (path, user, query = {}) => dispatch(db, { method: 'GET', path, user, query })

describe('the admin check (CTFADMP)', () => {
  it('lets organizers in, refuses players with 08 50, and has no session for nobody', () => {
    expect(get('/admin/events', 'ADMIN01').status).toBe(200)
    expect(get('/admin/events', 'CTF0001')).toMatchObject({ status: 403, body: { retCode: '08', reasonCode: '50' } })
    expect(get('/admin/events', null)).toEqual({ status: 404, body: '' })
  })
})

describe('admin events (CTFM402)', () => {
  it('lists every event by ID, drafts and closed ones too', () => {
    const { events } = get('/admin/events', 'ADMIN01').body
    expect(events.map((e) => e.eventID)).toEqual([1, 2, 3, 4, 5, 6])
    expect(events[0]).toMatchObject({ eventName: 'Spring Team CTF', phase: 'R', racfGroup: 'CTFPLAY', createdBy: 'ADMIN01' })
    expect(events[5]).toMatchObject({ eventStatus: 'D', phase: '' })
    expect(events[0]).not.toHaveProperty('regCode')
  })

  it('filters on status and pages after an ID', () => {
    expect(get('/admin/events', 'ADMIN01', { eventStatus_filter: 'd' }).body.events.map((e) => e.eventID)).toEqual([6])
    expect(get('/admin/events', 'ADMIN01', { eventID_since: '4' }).body.events.map((e) => e.eventID)).toEqual([5, 6])
  })
})

describe('reference tables (CTFM001, CTFM401)', () => {
  const call = (method, path, { query = {}, body = {} } = {}) =>
    dispatch(db, { method, path, user: 'ADMIN01', query, body })
  const reason = (r) => `${r.body.retCode} ${r.body.reasonCode}`

  it('lists by table and key, filtered on the start of the table ID', () => {
    const all = get('/admin/refTables', 'ADMIN01').body.refTables
    expect(all.map((r) => r.tableID)).toEqual([...all.map((r) => r.tableID)].sort())
    const groups = get('/admin/refTables', 'ADMIN01', { tableID_filter: 'racf' }).body.refTables
    expect(groups.map((r) => r.tabKey)).toEqual(['CTFPLAY', 'CTFTEST'])
    const after = get('/admin/refTables', 'ADMIN01', { tableID_since: 'RACFGRP', tabKey_since: 'CTFPLAY' }).body.refTables
    expect(after[0]).toMatchObject({ tableID: 'RACFGRP', tabKey: 'CTFTEST' })
  })

  it('adds an entry in upper case, once', () => {
    const r = call('POST', '/admin/refTables', { body: { tableID: 'category', tabKey: 'pwn', tabValue: 'Binary exploitation' } })
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ tableID: 'CATEGORY', tabKey: 'PWN', createdBy: 'ADMIN01' })
    expect(reason(call('POST', '/admin/refTables', { body: { tableID: 'CATEGORY', tabKey: 'PWN', tabValue: 'x' } }))).toBe('08 11')
    expect(reason(call('POST', '/admin/refTables', { body: { tableID: 'CATEGORY', tabKey: 'TOOLONGKEY' } }))).toBe('08 02')
  })

  it('takes settings that fit their field, and numbers for CLAIMHRS and JOBMINS (R025)', () => {
    const put = (key, tabValue) => call('PUT', '/admin/refTables/SETTINGS', { query: { tabKey: key }, body: { tabValue } })
    expect(put('CLAIMHRS', '24').body.tabValue).toBe('24')
    expect(reason(put('CLAIMHRS', 'day'))).toBe('08 03')
    expect(reason(put('CLAIMHRS', '12345'))).toBe('08 02') // length first, as R025
    expect(reason(put('JOBMINS', 'sixty'))).toBe('08 03')
    expect(put('JOBCLASS', 'B').body.tabValue).toBe('B')
    expect(reason(put('JOBCLASS', 'AB'))).toBe('08 02')
    expect(put('BATCHUSR', 'CTFJOBS').status).toBe(200)
    expect(reason(put('BATCHUSR', ''))).toBe('08 02')
    expect(put('NOSUCH', '1')).toMatchObject({ status: 404, body: { reasonCode: '31' } })
  })

  it('keeps settings, and categories and groups in use', () => {
    const del = (tableID, tabKey) => call('DELETE', `/admin/refTables/${tableID}`, { query: { tabKey } })
    expect(reason(del('SETTINGS', 'CLAIMHRS'))).toBe('08 53')
    expect(reason(del('CATEGORY', 'ZOS'))).toBe('08 53')
    expect(reason(del('RACFGRP', 'CTFPLAY'))).toBe('08 53')
    expect(del('CATEGORY', 'MISC').status).toBe(200)
    expect(del('RACFGRP', 'CTFTEST').status).toBe(200)
    expect(reason(del('RACFGRP', 'CTFTEST'))).toBe('08 41')
  })
})

describe('events (CTFM002)', () => {
  const call = (method, path, body = {}) => dispatch(db, { method, path, user: 'ADMIN01', query: {}, body })
  const reason = (r) => `${r.body.retCode} ${r.body.reasonCode}`
  const valid = {
    eventName: 'Test CTF', eventDescription: '', playMode: 'T', maxTeamSize: 3, maxPlayers: 50, regCode: 'TEST-2027',
    racfGroup: 'ctftest', startTS: '2027-03-01-09.00.00.000000', endTS: '2027-03-01-17.00.00.000000',
    freezeTS: '', regFromTS: '2027-02-01-00.00.00.000000', regToTS: '2027-03-01-09.00.00.000000',
  }
  // The event as GET answers it, without the envelope, to send back with PUT
  const current = (eventID) => {
    const e = { ...call('GET', `/admin/events/${eventID}`).body }
    for (const k of ['retCode', 'reasonCode', 'infoMessage']) delete e[k]
    return e
  }

  it('creates a DRAFT, with the group in upper case', () => {
    const r = call('POST', '/admin/events', valid)
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ eventID: 7, eventStatus: 'D', racfGroup: 'CTFTEST', regCode: 'TEST-2027', phase: '' })
    expect(reason(call('POST', '/admin/events', { ...valid, eventStatus: 'P' }))).toBe('08 03')
  })

  it('checks the fields in the module\'s order', () => {
    const post = (fields) => reason(call('POST', '/admin/events', { ...valid, ...fields }))
    expect(post({ eventName: '' })).toBe('08 02')
    expect(post({ regCode: '' })).toBe('08 02')
    expect(post({ playMode: 'X' })).toBe('08 03')
    expect(post({ playMode: 'I', maxTeamSize: 2 })).toBe('08 04')
    expect(post({ maxTeamSize: 1 })).toBe('08 04')
    expect(post({ maxPlayers: 0 })).toBe('08 04')
    expect(post({ racfGroup: 'NOGROUP' })).toBe('08 06')
    expect(post({ regToTS: '' })).toBe('08 05')
    expect(post({ endTS: valid.startTS })).toBe('08 05')
    expect(post({ freezeTS: valid.endTS })).toBe('08 05')
    expect(post({ regFromTS: valid.regToTS })).toBe('08 05')
    expect(call('POST', '/admin/events', { ...valid, playMode: 'I', maxTeamSize: 0 }).body.maxTeamSize).toBe(1)
  })

  it('publishes only with a visible challenge', () => {
    expect(reason(call('PUT', '/admin/events/6', { ...current(6), eventStatus: 'P' }))).toBe('08 53')
    db.data.eventChallenges.push({ eventID: 6, challengeID: 1, sortOrder: 1, scoreType: 'S', initPoints: 100, minPoints: 0, decaySolves: 0, isVisible: 'Y', maxAttempts: 0 })
    expect(call('PUT', '/admin/events/6', { ...current(6), eventStatus: 'P' }).body.eventStatus).toBe('P')
  })

  it('locks play mode, group, sizes and the status once players joined', () => {
    const e = current(3) // upcoming, Carol and Erin have a place
    expect(reason(call('PUT', '/admin/events/3', { ...e, eventStatus: 'D' }))).toBe('08 53')
    expect(reason(call('PUT', '/admin/events/3', { ...e, playMode: 'I', maxTeamSize: 1 }))).toBe('08 53')
    expect(reason(call('PUT', '/admin/events/3', { ...e, racfGroup: 'CTFTEST' }))).toBe('08 53')
    expect(reason(call('PUT', '/admin/events/1', { ...current(1), maxTeamSize: 2, maxPlayers: 1 }))).toBe('08 53')
    expect(call('PUT', '/admin/events/3', { ...e, eventName: 'Summer CTF' }).body.eventName).toBe('Summer CTF')
    expect(reason(call('PUT', '/admin/events/5', current(5)))).toBe('08 53') // closed
  })

  it('deletes only a DRAFT, with what belongs to it', () => {
    db.data.announcements.push({ announceID: 50, eventID: 6, announceTitle: 'x', announceBody: '', createdDate: '' })
    expect(reason(call('DELETE', '/admin/events/1'))).toBe('08 53')
    expect(call('DELETE', '/admin/events/6').status).toBe(200)
    expect(db.data.announcements.some((a) => a.eventID === 6)).toBe(false)
    expect(call('GET', '/admin/events/6').status).toBe(404)
    expect(reason(call('DELETE', '/admin/events/6'))).toBe('08 41')
  })
})

describe('the library (CTFM007 to CTFM010)', () => {
  const call = (method, path, body = {}, query = {}) => dispatch(db, { method, path, user: 'ADMIN01', query, body })
  const reason = (r) => `${r.body.retCode} ${r.body.reasonCode}`
  const challenge = { challengeTitle: 'New one', category: 'web', challengeDescription: 'Find it.' }

  it('lists by ID, filtered on the start of the category', () => {
    const all = call('GET', '/admin/challenges').body.challenges
    expect(all.map((c) => c.challengeID)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(all[0]).toMatchObject({ challengeType: 'S', category: 'ZOS' })
    expect(call('GET', '/admin/challenges', {}, { category_filter: 'cr' }).body.challenges.map((c) => c.challengeID))
      .toEqual([5, 6])
  })

  it('creates a challenge with a category from the list', () => {
    const r = call('POST', '/admin/challenges', challenge)
    expect(r.status).toBe(201)
    expect(r.body).toMatchObject({ challengeID: 9, category: 'WEB', challengeType: 'S', createdBy: 'ADMIN01' })
    expect(reason(call('POST', '/admin/challenges', { ...challenge, challengeDescription: '' }))).toBe('08 02')
    expect(reason(call('POST', '/admin/challenges', { ...challenge, verifierPgm: 'CHECKIT' }))).toBe('08 03')
    expect(reason(call('POST', '/admin/challenges', { ...challenge, category: 'NOPE' }))).toBe('08 06')
  })

  it('deletes a challenge only outside events, with its flags, hints and links', () => {
    expect(reason(call('DELETE', '/admin/challenges/2'))).toBe('08 53')
    const { challengeID } = call('POST', '/admin/challenges', challenge).body
    call('POST', '/admin/flags', { challengeID, flagValue: 'flag{x}', caseSensitive: 'Y' })
    call('POST', '/admin/links', { challengeID, linkName: 'Site', linkUrl: 'https://example.com' })
    expect(call('DELETE', `/admin/challenges/${challengeID}`).status).toBe(200)
    expect(db.data.flags.some((f) => f.challengeID === challengeID)).toBe(false)
    expect(db.data.links.some((l) => l.challengeID === challengeID)).toBe(false)
  })

  it('keeps the last flag of a challenge visible in an event', () => {
    const flags = call('GET', '/admin/flags', {}, { challengeID: '2' }).body.flags
    expect(flags).toHaveLength(1)
    expect(reason(call('DELETE', `/admin/flags/${flags[0].flagID}`))).toBe('08 53')
    const second = call('POST', '/admin/flags', { challengeID: 2, flagValue: 'flag{RC12}', caseSensitive: 'n' })
    expect(second.body).toMatchObject({ caseSensitive: 'N' })
    expect(call('DELETE', `/admin/flags/${flags[0].flagID}`).status).toBe(200)
    expect(reason(call('POST', '/admin/flags', { challengeID: 2, flagValue: 'x', caseSensitive: '' }))).toBe('08 03')
    expect(reason(call('POST', '/admin/flags', { challengeID: 99, flagValue: 'x', caseSensitive: 'Y' }))).toBe('08 13')
  })

  it('keeps a hint that teams unlocked, and checks costs and links', () => {
    expect(reason(call('DELETE', '/admin/hints/1'))).toBe('08 53') // unlocked by Root Access
    expect(call('DELETE', '/admin/hints/2').status).toBe(200)
    expect(reason(call('POST', '/admin/hints', { challengeID: 2, hintText: 'x', cost: -1, sortOrder: 3 }))).toBe('08 04')
    expect(call('PUT', '/admin/hints/1', { hintText: 'Cheaper now', cost: 5, sortOrder: 1 }).body.cost).toBe(5)
    expect(reason(call('POST', '/admin/links', { challengeID: 2, linkName: '', linkUrl: 'x' }))).toBe('08 02')
    expect(reason(call('PUT', '/admin/links/99', { linkName: 'a', linkUrl: 'b' }))).toBe('08 31')
  })

  it('lists the challenges of an event, hidden ones too (CTFM411)', () => {
    const rows = call('GET', '/admin/eventChallenges', {}, { eventID: '1' }).body.eventChallenges
    expect(rows.map((r) => r.challengeID)).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(rows.find((r) => r.challengeID === 7)).toMatchObject({ isVisible: 'N', challengeTitle: 'Lost in the logs' })
  })
})

describe('challenges in an event (CTFM011, CTFM012)', () => {
  const call = (method, path, body = {}, query = {}) => dispatch(db, { method, path, user: 'ADMIN01', query, body })
  const reason = (r) => `${r.body.retCode} ${r.body.reasonCode}`
  const scoring = { scoreType: 'S', initPoints: 100, minPoints: 0, decaySolves: 0, isVisible: 'Y', sortOrder: 1, maxAttempts: 0 }
  const add = (eventID, challengeID, fields = {}) =>
    call('POST', '/admin/eventChallenges', { eventID, challengeID, ...scoring, ...fields })

  it('puts a challenge in an event, checking the scoring', () => {
    expect(add(6, 1).status).toBe(201)
    expect(reason(add(6, 1))).toBe('08 11')
    expect(reason(add(6, 2, { scoreType: 'X' }))).toBe('08 03')
    expect(reason(add(6, 2, { scoreType: 'D', initPoints: 100, minPoints: 200, decaySolves: 5 }))).toBe('08 04')
    expect(reason(add(6, 2, { scoreType: 'D', initPoints: 500, minPoints: 100, decaySolves: 0 }))).toBe('08 04')
    expect(reason(add(6, 2, { maxAttempts: -1 }))).toBe('08 04')
    expect(reason(add(5, 2))).toBe('08 53') // closed
    expect(reason(add(99, 2))).toBe('08 13')
    expect(reason(add(6, 99, { isVisible: 'N' }))).toBe('08 13')
    // Static scoring keeps no minimum or decay
    expect(add(6, 3, { minPoints: 50, decaySolves: 9 }).body).toMatchObject({ minPoints: 0, decaySolves: 0 })
  })

  it('makes a challenge visible only with a flag', () => {
    db.data.flags = db.data.flags.filter((f) => f.challengeID !== 4)
    expect(reason(add(6, 4))).toBe('08 53')
    expect(add(6, 4, { isVisible: 'N' }).status).toBe(201)
  })

  it('changes scoring and visibility, and takes out a challenge without submissions', () => {
    const put = (challengeID, fields) => call('PUT', `/admin/eventChallenges/${challengeID}`, { ...scoring, ...fields }, { eventID: '1' })
    expect(put(7, { isVisible: 'Y', initPoints: 250 }).body).toMatchObject({ isVisible: 'Y', initPoints: 250 })
    expect(reason(put(99, {}))).toBe('08 53') // no flag: R020 comes before the row
    expect(reason(put(99, { isVisible: 'N' }))).toBe('08 31')
    const del = (challengeID, eventID = '1') => call('DELETE', `/admin/eventChallenges/${challengeID}`, {}, { eventID })
    expect(reason(del(5))).toBe('08 53') // submissions
    expect(reason(del(2))).toBe('08 53') // a hint was unlocked
    expect(del(8).status).toBe(200) // and its prerequisites with it
    expect(db.data.prereqs.some((q) => q.challengeID === 8)).toBe(false)
    expect(reason(del(8))).toBe('08 41')
  })

  it('adds prerequisites without cycles, and removes them', () => {
    const post = (challengeID, reqChallengeID) =>
      call('POST', '/admin/prerequisites', { eventID: 1, challengeID, reqChallengeID })
    expect(call('GET', '/admin/prerequisites', {}, { eventID: '1' }).body.prerequisites
      .map((q) => [q.challengeID, q.reqChallengeID])).toEqual([[8, 2], [8, 3]])
    expect(reason(post(4, 4))).toBe('08 03')
    expect(reason(post(2, 8))).toBe('08 53') // 8 requires 2
    expect(post(3, 1).status).toBe(201)
    expect(reason(post(1, 8))).toBe('08 53') // 8 -> 3 -> 1
    expect(reason(post(3, 1))).toBe('08 11')
    expect(reason(post(4, 99))).toBe('08 13')
    const del = (challengeID, reqChallengeID) =>
      call('DELETE', `/admin/prerequisites/${challengeID}`, {}, { eventID: '1', reqChallengeID: String(reqChallengeID) })
    expect(del(8, 2).status).toBe(200)
    expect(reason(del(8, 2))).toBe('08 41')
  })
})

describe('the monitor (CTFM314 admin view, CTFM405, CTFM413, CTFM414, CTFM514)', () => {
  const call = (method, path, body = {}, query = {}) => dispatch(db, { method, path, user: 'ADMIN01', query, body })
  const reason = (r) => `${r.body.retCode} ${r.body.reasonCode}`

  it('ranks without the freeze, unlike the public board', () => {
    const pub = dispatch(db, { method: 'GET', path: '/leaderboard/2', query: {} }).body.leaderboard
    const live = call('GET', '/admin/leaderboard/2').body.leaderboard
    const dave = (rows) => rows.find((r) => r.teamName === 'Dave')
    expect(dave(live).score).toBeGreaterThan(dave(pub).score) // two solves after the freeze
    expect(call('GET', '/admin/leaderboard/6').status).toBe(200) // a draft too
  })

  it('lists teams, and submissions newest first with filters', () => {
    expect(call('GET', '/admin/teams', {}, { eventID: '1' }).body.teams.map((t) => t.teamName))
      .toEqual(['Root Access', 'Packet Pirates', 'Null Pointers'])
    const subs = call('GET', '/admin/submissions', {}, { eventID: '1' }).body.submissions
    expect(subs.map((x) => x.submissionID)).toEqual([...subs.map((x) => x.submissionID)].sort((a, b) => b - a))
    const wrong = call('GET', '/admin/submissions', {}, { eventID: '1', isCorrect_filter: 'N' }).body.submissions
    expect(wrong.map((x) => x.submittedText)).toEqual(['flag{caesar}'])
    expect(reason(call('GET', '/admin/submissions', {}, { eventID: '1', isCorrect_filter: 'X' }))).toBe('08 01')
    expect(call('GET', '/admin/submissions', {}, { eventID: '1', submissionID_since: String(subs[1].submissionID) })
      .body.submissions[0].submissionID).toBe(subs[2].submissionID)
  })

  it('reverses a solve: the points go, the attempt stays with who, when and why', () => {
    const solves = () => call('GET', '/admin/solves', {}, { eventID: '1', teamID_filter: '1' }).body.solves
    expect(solves().map((x) => x.challengeID)).toEqual([1, 3, 5])
    const before = call('GET', '/admin/leaderboard/1').body.leaderboard.find((r) => r.teamID === 1).score
    const reverse = (body) => call('POST', '/admin/solveReversals', { eventID: 1, challengeID: 3, teamID: 1, ...body })
    expect(reason(reverse({ reverseReason: '' }))).toBe('08 02')
    expect(reverse({ reverseReason: 'Shared flag' }).status).toBe(200)
    expect(solves().map((x) => x.challengeID)).toEqual([1, 5])
    expect(call('GET', '/admin/leaderboard/1').body.leaderboard.find((r) => r.teamID === 1).score).toBeLessThan(before)
    const sub = call('GET', '/admin/submissions', {}, { eventID: '1', challengeID_filter: '3', teamID_filter: '1' }).body.submissions[0]
    expect(sub).toMatchObject({ isCorrect: 'Y', reversedBy: 'ADMIN01', reverseReason: 'Shared flag' })
    expect(reason(reverse({ reverseReason: 'Again' }))).toBe('08 41')
    expect(reason(call('POST', '/admin/solveReversals', { eventID: 5, challengeID: 1, teamID: 99, reverseReason: 'x' }))).toBe('08 53')
  })
})

describe('awards and penalties (CTFM016, CTFM416)', () => {
  const call = (method, path, body = {}, query = {}) => dispatch(db, { method, path, user: 'ADMIN01', query, body })
  const reason = (r) => `${r.body.retCode} ${r.body.reasonCode}`
  const give = (body) => call('POST', '/admin/awards', { eventID: 1, teamID: 3, points: 30, reason: 'Nice', ...body })

  it('lists by ID, filtered on team', () => {
    expect(call('GET', '/admin/awards', {}, { eventID: '1' }).body.awards.map((a) => a.points)).toEqual([50, -25])
    expect(call('GET', '/admin/awards', {}, { eventID: '1', teamID_filter: '2' }).body.awards.map((a) => a.reason))
      .toEqual(['Scanning the scoreboard host'])
  })

  it('gives an award or penalty that changes the score, and deletes it', () => {
    const score = () => call('GET', '/admin/leaderboard/1').body.leaderboard.find((r) => r.teamID === 3).score
    const before = score()
    const r = give({ points: -40 })
    expect(r.status).toBe(201)
    expect(score()).toBe(before - 40)
    expect(call('DELETE', `/admin/awards/${r.body.awardID}`).status).toBe(200)
    expect(score()).toBe(before)
    expect(reason(call('DELETE', `/admin/awards/${r.body.awardID}`))).toBe('08 41')
  })

  it('refuses 0 points, no reason, a team of another event and a closed event', () => {
    expect(reason(give({ points: 0 }))).toBe('08 02')
    expect(reason(give({ reason: ' ' }))).toBe('08 03')
    expect(reason(give({ teamID: 4 }))).toBe('08 13') // a team of event 2
    expect(reason(give({ eventID: 5 }))).toBe('08 53')
  })
})

describe('announcements (CTFM017, CTFM417)', () => {
  const call = (method, path, body = {}, query = {}) => dispatch(db, { method, path, user: 'ADMIN01', query, body })
  const reason = (r) => `${r.body.retCode} ${r.body.reasonCode}`
  const post = (body) => call('POST', '/admin/announcements', { eventID: 1, announceTitle: 'Hi', announceBody: 'Text', ...body })

  it('publishes one that players see, also on a draft, not in a closed event', () => {
    const r = post({ announceTitle: 'Forensics open' })
    expect(r.status).toBe(201)
    const players = dispatch(db, { method: 'GET', path: '/announcements', user: 'CTF0001', query: { eventID: '1' } })
    expect(players.body.announcements[0].announceTitle).toBe('Forensics open')
    expect(post({ eventID: 6 }).status).toBe(201)
    expect(reason(post({ eventID: 5 }))).toBe('08 53')
    expect(reason(post({ eventID: 99 }))).toBe('08 13')
    expect(reason(post({ announceTitle: '' }))).toBe('08 02')
    expect(reason(post({ announceBody: '' }))).toBe('08 03')
  })

  it('lists newest first, corrects and deletes', () => {
    const list = () => call('GET', '/admin/announcements', {}, { eventID: '1' }).body.announcements
    expect(list().map((a) => a.announceID)).toEqual([3, 2, 1])
    const created = list()[2].createdDate
    expect(call('PUT', '/admin/announcements/1', { announceTitle: 'Welcome all!', announceBody: 'Have fun' }).body)
      .toMatchObject({ announceTitle: 'Welcome all!' })
    expect(list()[2]).toMatchObject({ announceTitle: 'Welcome all!', updatedBy: 'ADMIN01', createdDate: created })
    expect(call('DELETE', '/admin/announcements/2').status).toBe(200)
    expect(list().map((a) => a.announceID)).toEqual([3, 1])
    expect(reason(call('DELETE', '/admin/announcements/2'))).toBe('08 41')
    expect(reason(call('PUT', '/admin/announcements/2', { announceTitle: 'x', announceBody: 'y' }))).toBe('08 31')
  })
})

describe('closing an event (CTFM502)', () => {
  const close = (eventID) => dispatch(db, { method: 'POST', path: `/admin/eventClosures/${eventID}`, user: 'ADMIN01', query: {}, body: {} })
  const reason = (r) => `${r.body.retCode} ${r.body.reasonCode}`

  it('closes only a published event after its end', () => {
    expect(reason(close(1))).toBe('08 53') // running
    expect(reason(close(6))).toBe('08 53') // draft
    expect(reason(close(5))).toBe('08 53') // closed already
    expect(close(99).status).toBe(404)
  })

  it('queues the offboarding: remove from the group, revoke who plays nowhere else', () => {
    // Event 4: Alice, Dave, Ivan and Judy. All but Judy also play in an open event.
    db.data.participants = db.data.participants.filter((x) => !(x.playerID === 10 && x.eventID === 2))
    const r = close(4)
    expect(r.body).toMatchObject({ eventID: 4, eventStatus: 'C' })
    const jobs = db.data.provJobs.filter((j) => j.eventID === 4)
    const removes = jobs.filter((j) => j.provAction === 'M')
    const revokes = jobs.filter((j) => j.provAction === 'V')
    expect(removes).toHaveLength(4)
    expect(removes.every((j) => j.racfGroup === 'CTFPLAY' && j.jobStatus === 'Q')).toBe(true)
    expect(revokes.map((j) => j.playerID)).toEqual([10])
    expect(reason(dispatch(db, { method: 'POST', path: '/admin/announcements', user: 'ADMIN01', query: {},
      body: { eventID: 4, announceTitle: 'x', announceBody: 'y' } }))).toBe('08 53')
  })
})

describe('players (CTFM403, CTFM503, CTFM510)', () => {
  let clock
  let pdb
  beforeEach(() => {
    clock = { now: new Date() }
    pdb = createDb(buildSeed(clock.now), () => clock.now)
  })
  const call = (method, path, query = {}) => dispatch(pdb, { method, path, user: 'ADMIN01', query, body: {} })
  const reason = (r) => `${r.body.retCode} ${r.body.reasonCode}`
  const status = (id) => call('GET', `/admin/players/${id}`).body.playerStatus
  const later = (ms) => {
    clock.now = new Date(clock.now.getTime() + ms)
  }

  it('finds players by name or userid from the start, status and event', () => {
    const find = (query) => call('GET', '/admin/players', query).body.players.map((p) => p.racfUserid)
    expect(find({ displayName_filter: 'al' })).toEqual(['CTF0001'])
    expect(find({ racfUserid_filter: 'ctf000' })).toHaveLength(9)
    expect(find({ playerStatus_filter: 'A', eventID_filter: '1' })).toEqual(['CTF0001', 'CTF0002', 'CTF0003', 'CTF0006', 'CTF0007', 'CTF0008'])
    expect(call('GET', '/admin/players/99').status).toBe(404)
  })

  it('revokes, resumes and deletes through jobs that change the player when done', () => {
    expect(call('POST', '/admin/playerRevocations/2').body).toHaveProperty('provJobID')
    expect(status(2)).toBe('A') // the job runs
    expect(reason(call('POST', '/admin/playerResets/2'))).toBe('08 53') // one open job per player
    later(5000)
    expect(status(2)).toBe('V')
    expect(pdb.signIn('CTF0002', 'a passphrase')).toBeNull()
    expect(reason(call('POST', '/admin/playerRevocations/2'))).toBe('08 53') // revoked already
    call('POST', '/admin/playerResumptions/2')
    later(5000)
    expect(status(2)).toBe('A')
    expect(reason(call('DELETE', '/admin/players/2'))).toBe('08 53') // only from revoked
  })

  it('resets a passphrase with a new claim token, for R3', () => {
    const r = call('POST', '/admin/playerResets/1')
    expect(r.body.claimToken).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/)
    later(5000)
    expect(status(1)).toBe('R')
    const activate = (claimToken) => pdb.activate('1', { claimToken, passphrase: 'a new long passphrase' })
    expect(reason(activate('WRONG-TOKEN'))).toBe('08 57')
    expect(activate(r.body.claimToken).body).toMatchObject({ racfUserid: 'CTF0001' })
    expect(status(1)).toBe('A')
  })
})

describe('provisioning jobs (CTFM404, CTFM520)', () => {
  let clock
  let jdb
  beforeEach(() => {
    clock = { now: new Date() }
    jdb = createDb(buildSeed(clock.now), () => clock.now)
  })
  const call = (method, path, query = {}) => dispatch(jdb, { method, path, user: 'ADMIN01', query, body: {} })
  const reason = (r) => `${r.body.retCode} ${r.body.reasonCode}`
  const jobs = (query = {}) => call('GET', '/admin/provisioningJobs', query).body.provisioningJobs

  it('lists newest first, with filters', () => {
    expect(jobs().map((j) => j.provJobID)).toEqual([3, 2, 1])
    expect(jobs({ jobStatus_filter: 'f' }).map((j) => j.provAction)).toEqual(['C', 'M'])
    expect(jobs({ eventID_filter: '5' }).map((j) => j.provJobID)).toEqual([2])
    expect(jobs({ provJobID_since: '3' }).map((j) => j.provJobID)).toEqual([2, 1])
    expect(jobs()[0]).not.toHaveProperty('doneAt')
  })

  it('retries a failed CREATE with a new claim token, which then works for R3', () => {
    const r = call('POST', '/admin/jobRetries/3')
    expect(r.body).toMatchObject({ provJobID: 3, jobStatus: 'N' })
    expect(r.body.claimToken).toMatch(/^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/)
    const fay = jobs()[0].playerID
    expect(call('GET', `/admin/players/${fay}`).body.playerStatus).toBe('P')
    expect(jobs()[0]).toMatchObject({ retryCount: 1, jobRC: -1 })
    expect(reason(call('POST', '/admin/jobRetries/3'))).toBe('08 53') // not failed any more
    clock.now = new Date(clock.now.getTime() + 5000)
    expect(jobs()[0]).toMatchObject({ jobStatus: 'D', jobRC: 0 })
    expect(jdb.activate(String(fay), { claimToken: r.body.claimToken, passphrase: 'a long new passphrase' }).status).toBe(201)
  })

  it('queues a REMOVE for the batch, without a token', () => {
    expect(call('POST', '/admin/jobRetries/2').body).toMatchObject({ jobStatus: 'Q', claimToken: '' })
    expect(reason(call('POST', '/admin/jobRetries/1'))).toBe('08 53') // done
    expect(call('POST', '/admin/jobRetries/99').status).toBe(404)
  })
})
