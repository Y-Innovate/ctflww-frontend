// In-memory stand-in for the CTF backend: public and player operations, with
// the checks and reason codes of the CTFMnnn modules (headers in
// ctflww/COBOL), the HTTP mapping of the CTFCnnn wrappers, and the scoring
// of ctflww/docs/03-data-model.md. Every operation returns { status, body }.
import { FAR_FUTURE, ts } from './clock.js'
import { createAdmin } from './admin.js'
import { int, ok, page, randomCode, refuse, run, text, upper } from './util.js'

export { httpStatus, PAGE_SIZE } from './util.js'

// Dynamic value with n solves; see 03-data-model.md
export function challengeValue(ec, n) {
  if (ec.scoreType !== 'D') return ec.initPoints
  const k = Math.max(n - 1, 0)
  const v = Math.ceil(ec.initPoints + ((ec.minPoints - ec.initPoints) * k * k) / (ec.decaySolves * ec.decaySolves))
  return Math.max(ec.minPoints, v)
}

export function createDb(seed, clock = () => new Date()) {
  const d = structuredClone(seed)
  const sessions = new Map()
  const now = () => ts(clock())
  const next = (rows, key) => rows.reduce((m, r) => Math.max(m, r[key]), 0) + 1

  // ---- Events ------------------------------------------------------------
  const eventOf = (eventID) => d.events.find((e) => e.eventID === int(eventID))

  function phaseOf(e, t = now()) {
    if (e.eventStatus !== 'P') return ''
    if (t < e.startTS) return 'U'
    if (t >= e.endTS) return 'E'
    if (e.freezeTS && e.freezeTS <= t) return 'F'
    return 'R'
  }
  const regOpen = (e, t = now()) => e.eventStatus === 'P' && e.regFromTS <= t && t < e.regToTS
  const cutoffOf = (e, t = now()) => (e.freezeTS && e.freezeTS <= t ? e.freezeTS : FAR_FUTURE)

  function publicEvent(e) {
    const fields = ['eventID', 'eventName', 'eventStatus', 'playMode', 'maxTeamSize', 'startTS', 'endTS',
      'freezeTS', 'regFromTS', 'regToTS']
    return {
      ...Object.fromEntries(fields.map((f) => [f, e[f]])),
      phase: phaseOf(e),
      registrationOpen: regOpen(e) ? 'Y' : 'N',
    }
  }

  // ---- Scoring -----------------------------------------------------------
  const ecOf = (eventID, challengeID) =>
    d.eventChallenges.find((x) => x.eventID === int(eventID) && x.challengeID === int(challengeID))
  const solvesUpTo = (eventID, challengeID, cutoff) =>
    d.solves.filter((s) => s.eventID === eventID && s.challengeID === challengeID && s.createdDate <= cutoff).length
  const valueAt = (ec, cutoff) => challengeValue(ec, solvesUpTo(ec.eventID, ec.challengeID, cutoff))

  // Score of a team: solves at the values up to valueCutoff, and everything
  // of the team up to ownCutoff (the board's view for progress, the
  // freeze for the public leaderboard)
  function teamScore(team, valueCutoff, ownCutoff) {
    const e = team.eventID
    let score = 0
    let last = ''
    const solves = d.solves.filter((s) => s.teamID === team.teamID && s.createdDate <= ownCutoff)
    for (const s of solves) {
      score += valueAt(ecOf(e, s.challengeID), valueCutoff)
      if (s.createdDate > last) last = s.createdDate
    }
    for (const a of d.awards.filter((x) => x.teamID === team.teamID && x.createdDate <= ownCutoff)) {
      score += a.points
      if (a.points > 0 && a.createdDate > last) last = a.createdDate
    }
    const hints = d.hintUnlocks.filter((h) => h.teamID === team.teamID && h.createdDate <= ownCutoff)
    for (const h of hints) score -= h.cost
    return { score, last: last || FAR_FUTURE, solveCount: solves.length, hintCount: hints.length }
  }

  // The public board stops at the freeze; the organizers' view (CTFM314
  // with ADMINVIEW) passes FAR_FUTURE
  function ranking(e, cutoff = cutoffOf(e)) {
    return d.teams
      .filter((t) => t.eventID === e.eventID)
      .map((t) => ({ t, ...teamScore(t, cutoff, cutoff) }))
      .sort((a, b) => b.score - a.score || a.last.localeCompare(b.last) || a.t.teamID - b.t.teamID)
      .map((r, i) => ({ rank: i + 1, teamID: r.t.teamID, teamName: r.t.teamName, score: r.score, solveCount: r.solveCount }))
  }

  // ---- Who is playing (CTFCTXP) ------------------------------------------
  const playerOf = (userid) => d.players.find((p) => p.racfUserid === upper(userid))
  const isAdmin = (userid) => d.admins.includes(upper(userid))

  function context(userid, eventID) {
    const player = playerOf(userid)
    const part = player && player.playerStatus === 'A' &&
      d.participants.find((x) => x.eventID === int(eventID) && x.playerID === player.playerID)
    const event = eventOf(eventID)
    if (!part || !event || event.eventStatus === 'D') refuse('08', '50', 'You did not join this event')
    const team = d.teams.find((t) => t.teamID === part.teamID)
    return { player, part, event, team }
  }
  function needTeam(c) {
    if (!c.team || c.part.partStatus !== 'A') refuse('08', '50', 'You have no active place in a team here')
    return c
  }
  function needActive(c) {
    if (c.part.partStatus !== 'A') refuse('08', '50', 'Your place in this event is not active yet')
    return c
  }
  function needStarted(c) {
    if (now() < c.event.startTS) refuse('08', '53', 'This event has not started yet')
    return c
  }
  function needRunning(c) {
    needStarted(c)
    if (now() >= c.event.endTS || c.event.eventStatus !== 'P') refuse('08', '53', 'This event is not running')
    return c
  }
  function needTeamMode(c) {
    if (c.event.playMode !== 'T') refuse('08', '53', 'This is not a team event')
    return c
  }
  const solvedBy = (teamID, eventID, challengeID) =>
    d.solves.some((s) => s.teamID === teamID && s.eventID === eventID && s.challengeID === challengeID)
  function isLocked(c, challengeID) {
    return d.prereqs.some((q) => q.eventID === c.event.eventID && q.challengeID === challengeID &&
      !solvedBy(c.team?.teamID, c.event.eventID, q.reqChallengeID))
  }
  // R106: visible in the event; locked refused unless allowLocked
  function checkChallenge(c, challengeID, { allowLocked = false } = {}) {
    const ec = ecOf(c.event.eventID, challengeID)
    if (!ec || ec.isVisible !== 'Y') refuse('04', '01', 'Challenge not found')
    if (!allowLocked && isLocked(c, ec.challengeID)) refuse('08', '50', 'This challenge is still locked')
    return ec
  }
  const categoryName = (key) =>
    d.refTables.find((r) => r.tableID === 'CATEGORY' && r.tabKey === key)?.tabValue ?? ''
  const libraryOf = (challengeID) => d.library.find((x) => x.challengeID === challengeID)
  const wrongAttempts = (teamID, eventID, challengeID) => d.submissions.filter((s) =>
    s.teamID === teamID && s.eventID === eventID && s.challengeID === challengeID && s.isCorrect === 'N').length
  const attemptsLeft = (ec, teamID) =>
    ec.maxAttempts > 0 ? Math.max(ec.maxAttempts - wrongAttempts(teamID, ec.eventID, ec.challengeID), 0) : -1

  function addTeam(event, teamName, captain, joinCode = randomCode(12)) {
    const team = { teamID: next(d.teams, 'teamID'), eventID: event.eventID, teamName, joinCode, captainID: captain.playerID, memberCount: 1 }
    d.teams.push(team)
    return team
  }

  // ---- Registration (CTFREGP) --------------------------------------------
  function checkRegistration(event, regCode) {
    if (!event || !regOpen(event) || text(regCode) !== event.regCode) {
      refuse('08', '51', 'Wrong registration code, or registration is closed')
    }
    if (event.playerCount >= event.maxPlayers) refuse('08', '52', 'This event is full')
  }
  function settle(player) {
    // Admin jobs (reset, revoke, resume, delete) finish after a few seconds too
    admin.settleJobs()
    // The provisioning job "runs" a few seconds after registering
    if (player.playerStatus === 'P' && now() >= player.readyAt) {
      player.playerStatus = /fail/i.test(player.displayName) ? 'F' : 'R'
    }
  }
  function takePlace(event, player, partStatus) {
    event.playerCount += 1
    let teamID = 0
    if (event.playMode === 'I') teamID = addTeam(event, player.displayName, player).teamID
    d.participants.push({ eventID: event.eventID, playerID: player.playerID, teamID, partStatus })
    return teamID
  }

  const admin = createAdmin({ d, now, phaseOf, later: (ms) => ts(new Date(clock().getTime() + ms)) })

  return {
    data: d,
    // The admin wrappers' check (CTFADMP); used by mock/routes.js
    isAdmin,
    ...admin,

    // ---- Sessions (LWW in real life) ----
    signIn(userid, passphrase) {
      const player = playerOf(userid)
      if (!player || player.playerStatus !== 'A' || !text(passphrase) || /^wrong/i.test(passphrase)) return null
      const token = randomCode(24)
      sessions.set(token, player.racfUserid)
      return token
    },
    signInAdmin(userid = d.admins[0]) {
      const token = randomCode(24)
      sessions.set(token, upper(userid))
      return token
    },
    signOut(token) {
      sessions.delete(token)
    },
    userOf(token) {
      return token ? sessions.get(token) ?? null : null
    },

    // ---- Public ----
    me(userid) {
      if (isAdmin(userid)) {
        return ok({ racfUserid: upper(userid), name: 'CTF ORGANIZER', role: 'A', playerID: 0, displayName: '' })
      }
      const p = playerOf(userid)
      return ok({ racfUserid: p.racfUserid, name: p.displayName.toUpperCase(), role: 'P', playerID: p.playerID, displayName: p.displayName })
    },

    // CTFM202: published and closed; eventStatus_filter P, C or A: only that
    listEvents(query) {
      const since = int(query.eventID_since)
      const status = String(query.eventStatus_filter ?? '').trim().toUpperCase()
      const wanted = status ? [status] : ['P', 'C']
      const rows = d.events
        .filter((e) => e.eventStatus !== 'D' && wanted.includes(e.eventStatus) && (!since || e.eventID < since))
        .sort((a, b) => b.eventID - a.eventID)
      return ok({ events: page(rows).map(publicEvent) })
    },

    getEvent(eventID) {
      return run(() => {
        const e = eventOf(eventID)
        if (!e || e.eventStatus === 'D') refuse('04', '01', 'Event not found')
        return ok({ ...publicEvent(e), eventDescription: e.eventDescription })
      })
    },

    leaderboard(eventID, query) {
      return run(() => {
        const e = eventOf(eventID)
        if (!e || e.eventStatus === 'D') refuse('04', '01', 'Event not found')
        const since = int(query.rank_since)
        const frozen = e.freezeTS && e.freezeTS <= now()
        return ok({ isFrozen: frozen ? 'Y' : 'N', leaderboard: page(ranking(e).filter((r) => r.rank > since)) })
      })
    },

    // GET /admin/leaderboard (CTFC530 -> CTFM314 ADMINVIEW): no freeze, drafts too
    adminLeaderboard(eventID, query) {
      return run(() => {
        const e = eventOf(eventID)
        if (!e) refuse('04', '01', 'Event not found')
        const since = int(query.rank_since)
        return ok({ leaderboard: page(ranking(e, FAR_FUTURE).filter((r) => r.rank > since)) })
      })
    },

    register(body) {
      return run(() => {
        const displayName = text(body.displayName)
        if (!displayName || displayName.length > 30) refuse('08', '02', 'displayName is required, up to 30 characters')
        const event = eventOf(body.eventID)
        checkRegistration(event, body.regCode)
        if (d.players.some((p) => p.displayName.toUpperCase() === displayName.toUpperCase())) {
          refuse('08', '11', 'This display name is taken')
        }
        const playerID = next(d.players, 'playerID')
        const claimToken = `${randomCode(4)}-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`
        const player = {
          playerID, racfUserid: `CTF${String(playerID).padStart(4, '0')}`, displayName,
          playerStatus: 'P', claimToken, readyAt: ts(new Date(clock().getTime() + 5000)),
        }
        d.players.push(player)
        takePlace(event, player, 'P')
        return ok({ registrationID: playerID, claimToken }, 201)
      })
    },

    registrationStatus(registrationID) {
      const player = d.players.find((p) => p.playerID === int(registrationID))
      if (!player) return run(() => refuse('04', '01', 'Not found'))
      settle(player)
      return ok({ registrationStatus: player.playerStatus })
    },

    activate(registrationID, body) {
      return run(() => {
        if (!text(body.claimToken) || !text(body.passphrase)) refuse('08', '02', 'Claim token and passphrase are required')
        const player = d.players.find((p) => p.playerID === int(registrationID))
        if (player) settle(player)
        if (!player || player.playerStatus !== 'R') refuse('08', '53', 'This registration is not ready')
        if (upper(body.claimToken) !== player.claimToken) refuse('08', '57', 'Wrong or expired claim token')
        if (text(body.passphrase).length < 14) {
          refuse('08', '56', 'RACF refused the passphrase: it must be 14 to 100 characters')
        }
        player.playerStatus = 'A'
        delete player.claimToken
        for (const part of d.participants.filter((x) => x.playerID === player.playerID)) part.partStatus = 'A'
        return ok({ racfUserid: player.racfUserid }, 201)
      })
    },

    // ---- Player ----
    changePassphrase(userid, body) {
      return run(() => {
        if (!text(body.currentPassphrase) || !text(body.newPassphrase)) {
          refuse('08', '02', 'Current and new passphrase are required')
        }
        if (/^wrong/i.test(body.currentPassphrase) || text(body.newPassphrase).length < 14) {
          refuse('08', '56', 'The current passphrase is wrong, or RACF refused the new one')
        }
        return ok()
      })
    },

    myEvents(userid, query) {
      const player = playerOf(userid)
      const since = int(query.eventID_since)
      const rows = d.participants
        .filter((x) => player && x.playerID === player.playerID && x.eventID > since)
        .map((x) => ({ x, e: eventOf(x.eventID) }))
        .filter(({ e }) => e.eventStatus !== 'D')
        .sort((a, b) => a.e.eventID - b.e.eventID)
        .map(({ x, e }) => ({
          eventID: e.eventID, eventName: e.eventName, phase: phaseOf(e), playMode: e.playMode,
          partStatus: x.partStatus, teamID: x.teamID,
          teamName: d.teams.find((t) => t.teamID === x.teamID)?.teamName ?? '',
        }))
      return ok({ events: page(rows) })
    },

    join(userid, body) {
      return run(() => {
        const player = playerOf(userid)
        if (!player || player.playerStatus !== 'A') refuse('08', '50', 'Your account is not active')
        if (d.participants.some((x) => x.playerID === player.playerID && x.eventID === int(body.eventID))) {
          refuse('08', '11', 'You are in this event already')
        }
        const event = eventOf(body.eventID)
        checkRegistration(event, body.regCode)
        const teamID = takePlace(event, player, 'A')
        return ok({ eventID: event.eventID, partStatus: 'A', teamID }, 201)
      })
    },

    board(userid, query) {
      return run(() => {
        const c = needStarted(needTeam(context(userid, query.eventID)))
        const cutoff = cutoffOf(c.event)
        const so = int(query.sortOrder_since)
        const ci = int(query.challengeID_since)
        const rows = d.eventChallenges
          .filter((ec) => ec.eventID === c.event.eventID && ec.isVisible === 'Y')
          .filter((ec) => ec.sortOrder > so || (ec.sortOrder === so && ec.challengeID > ci))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.challengeID - b.challengeID)
          .map((ec) => {
            const lib = libraryOf(ec.challengeID)
            return {
              challengeID: ec.challengeID, challengeTitle: lib.challengeTitle, category: lib.category,
              categoryName: categoryName(lib.category), currentPoints: valueAt(ec, cutoff),
              solveCount: solvesUpTo(c.event.eventID, ec.challengeID, cutoff),
              isSolved: solvedBy(c.team.teamID, c.event.eventID, ec.challengeID) ? 'Y' : 'N',
              isLocked: isLocked(c, ec.challengeID) ? 'Y' : 'N', sortOrder: ec.sortOrder,
            }
          })
        return ok({ challenges: page(rows) })
      })
    },

    challenge(userid, challengeID, query) {
      return run(() => {
        const c = needStarted(needTeam(context(userid, query.eventID)))
        const ec = checkChallenge(c, challengeID)
        const lib = libraryOf(ec.challengeID)
        const cutoff = cutoffOf(c.event)
        return ok({
          challengeID: ec.challengeID, challengeTitle: lib.challengeTitle, category: lib.category,
          categoryName: categoryName(lib.category), challengeDescription: lib.challengeDescription,
          currentPoints: valueAt(ec, cutoff), solveCount: solvesUpTo(c.event.eventID, ec.challengeID, cutoff),
          isSolved: solvedBy(c.team.teamID, c.event.eventID, ec.challengeID) ? 'Y' : 'N',
          attemptsLeft: attemptsLeft(ec, c.team.teamID),
        })
      })
    },

    challengeLinks(userid, query) {
      return run(() => {
        const c = needStarted(needTeam(context(userid, query.eventID)))
        const ec = checkChallenge(c, query.challengeID)
        const since = int(query.linkID_since)
        const rows = d.links.filter((l) => l.challengeID === ec.challengeID && l.linkID > since)
          .map(({ linkID, linkName, linkUrl }) => ({ linkID, linkName, linkUrl }))
        return ok({ links: page(rows) })
      })
    },

    prerequisites(userid, query) {
      return run(() => {
        const c = needStarted(needTeam(context(userid, query.eventID)))
        const ec = checkChallenge(c, query.challengeID, { allowLocked: true })
        const since = int(query.reqChallengeID_since)
        const rows = d.prereqs
          .filter((q) => q.eventID === c.event.eventID && q.challengeID === ec.challengeID && q.reqChallengeID > since)
          .sort((a, b) => a.reqChallengeID - b.reqChallengeID)
          .map((q) => {
            const req = ecOf(c.event.eventID, q.reqChallengeID)
            return {
              reqChallengeID: q.reqChallengeID,
              challengeTitle: req?.isVisible === 'Y' ? libraryOf(q.reqChallengeID).challengeTitle : '',
              isSolved: solvedBy(c.team.teamID, c.event.eventID, q.reqChallengeID) ? 'Y' : 'N',
            }
          })
        return ok({ prerequisites: page(rows) })
      })
    },

    hints(userid, query) {
      return run(() => {
        const c = needStarted(needTeam(context(userid, query.eventID)))
        const ec = checkChallenge(c, query.challengeID)
        const so = int(query.sortOrder_since)
        const hi = int(query.hintID_since)
        const rows = d.hints
          .filter((h) => h.challengeID === ec.challengeID)
          .filter((h) => h.sortOrder > so || (h.sortOrder === so && h.hintID > hi))
          .sort((a, b) => a.sortOrder - b.sortOrder || a.hintID - b.hintID)
          .map((h) => {
            const u = d.hintUnlocks.find((x) => x.hintID === h.hintID && x.teamID === c.team.teamID && x.eventID === c.event.eventID)
            return { hintID: h.hintID, sortOrder: h.sortOrder, cost: u ? u.cost : h.cost, isUnlocked: u ? 'Y' : 'N', hintText: u ? h.hintText : null }
          })
        return ok({ hints: page(rows) })
      })
    },

    unlockHint(userid, body) {
      return run(() => {
        const c = needTeam(context(userid, body.eventID))
        const hint = d.hints.find((h) => h.hintID === int(body.hintID))
        const ec = hint && ecOf(c.event.eventID, hint.challengeID)
        if (!ec || ec.isVisible !== 'Y') refuse('04', '01', 'Hint not found')
        needRunning(c)
        checkChallenge(c, ec.challengeID)
        let u = d.hintUnlocks.find((x) => x.hintID === hint.hintID && x.teamID === c.team.teamID && x.eventID === c.event.eventID)
        if (!u) {
          u = { eventID: c.event.eventID, hintID: hint.hintID, teamID: c.team.teamID, playerID: c.player.playerID, cost: hint.cost, createdDate: now() }
          d.hintUnlocks.push(u)
        }
        return ok({ hintID: hint.hintID, cost: u.cost, hintText: hint.hintText }, 201)
      })
    },

    submit(userid, body) {
      return run(() => {
        const flag = text(body.flag)
        if (!flag) refuse('08', '02', 'flag is required')
        const c = needRunning(needTeam(context(userid, body.eventID)))
        const ec = checkChallenge(c, body.challengeID)
        if (solvedBy(c.team.teamID, c.event.eventID, ec.challengeID)) refuse('08', '54', 'Your team solved this challenge already')
        if (attemptsLeft(ec, c.team.teamID) === 0) refuse('08', '55', 'Your team has used up its attempts')
        const flags = d.flags.filter((f) => f.challengeID === ec.challengeID)
        // CTFM313 R135: exact, or both in upper case when the flag ignores case
        const matches = (f) => f.caseSensitive === 'Y' ? f.flagValue === flag : upper(f.flagValue) === upper(flag)
        const isCorrect = flags.some(matches) ? 'Y' : 'N'
        const submissionID = next(d.submissions, 'submissionID')
        const createdDate = now()
        d.submissions.push({
          submissionID, eventID: c.event.eventID, challengeID: ec.challengeID, teamID: c.team.teamID,
          playerID: c.player.playerID, submittedText: flag, isCorrect, createdDate,
        })
        if (isCorrect === 'Y') {
          d.solves.push({ eventID: c.event.eventID, challengeID: ec.challengeID, teamID: c.team.teamID, playerID: c.player.playerID, submissionID, createdDate })
        }
        return ok({ submissionID, isCorrect, attemptsLeft: attemptsLeft(ec, c.team.teamID) }, 201)
      })
    },

    progress(userid, eventID) {
      return run(() => {
        const c = needTeam(context(userid, eventID))
        const s = teamScore(c.team, cutoffOf(c.event), FAR_FUTURE)
        const isCaptain = c.team.captainID === c.player.playerID
        return ok({
          teamID: c.team.teamID, teamName: c.team.teamName, score: s.score, solveCount: s.solveCount,
          hintCount: s.hintCount, memberCount: c.team.memberCount, isCaptain: isCaptain ? 'Y' : 'N',
          joinCode: isCaptain ? c.team.joinCode : '',
        })
      })
    },

    progressSolves(userid, query) {
      return run(() => {
        const c = needTeam(context(userid, query.eventID))
        const cutoff = cutoffOf(c.event)
        const since = int(query.challengeID_since)
        const rows = d.solves
          .filter((s) => s.teamID === c.team.teamID && s.challengeID > since)
          .sort((a, b) => a.challengeID - b.challengeID)
          .map((s) => ({
            challengeID: s.challengeID, challengeTitle: libraryOf(s.challengeID).challengeTitle,
            currentPoints: valueAt(ecOf(c.event.eventID, s.challengeID), cutoff),
            solvedBy: d.players.find((p) => p.playerID === s.playerID).displayName, solvedDate: s.createdDate,
          }))
        return ok({ solves: page(rows) })
      })
    },

    progressAwards(userid, query) {
      return run(() => {
        const c = needTeam(context(userid, query.eventID))
        const since = int(query.awardID_since)
        const rows = d.awards.filter((a) => a.teamID === c.team.teamID && a.awardID > since)
          .sort((a, b) => a.awardID - b.awardID)
          .map(({ awardID, points, reason, createdDate }) => ({ awardID, points, reason, createdDate }))
        return ok({ awards: page(rows) })
      })
    },

    announcements(userid, query) {
      return run(() => {
        const c = needActive(context(userid, query.eventID))
        const since = int(query.announceID_since)
        const rows = d.announcements
          .filter((a) => a.eventID === c.event.eventID && (!since || a.announceID < since))
          .sort((a, b) => b.announceID - a.announceID)
          .map(({ announceID, announceTitle, announceBody, createdDate }) => ({ announceID, announceTitle, announceBody, createdDate }))
        return ok({ announcements: page(rows) })
      })
    },

    createTeam(userid, body) {
      return run(() => {
        const teamName = text(body.teamName)
        if (!teamName || teamName.length > 30) refuse('08', '02', 'teamName is required, up to 30 characters')
        const c = needTeamMode(needActive(context(userid, body.eventID)))
        if (!regOpen(c.event)) refuse('08', '53', 'Registration is closed')
        if (c.team) refuse('08', '53', 'You are in a team already')
        if (d.teams.some((t) => t.eventID === c.event.eventID && t.teamName.toUpperCase() === teamName.toUpperCase())) {
          refuse('08', '11', 'This team name is taken in this event')
        }
        const team = addTeam(c.event, teamName, c.player)
        c.part.teamID = team.teamID
        return ok({ teamID: team.teamID, teamName: team.teamName, joinCode: team.joinCode }, 201)
      })
    },

    joinTeam(userid, body) {
      return run(() => {
        if (!text(body.joinCode)) refuse('08', '02', 'joinCode is required')
        const c = needTeamMode(needActive(context(userid, body.eventID)))
        if (!regOpen(c.event)) refuse('08', '53', 'Registration is closed')
        if (c.team) refuse('08', '53', 'You are in a team already')
        const team = d.teams.find((t) => t.eventID === c.event.eventID && t.joinCode === upper(body.joinCode))
        if (!team) refuse('04', '01', 'No team with this join code in this event')
        if (team.memberCount >= c.event.maxTeamSize) refuse('08', '52', 'This team is full')
        team.memberCount += 1
        c.part.teamID = team.teamID
        return ok({ teamID: team.teamID, teamName: team.teamName }, 201)
      })
    },

    teamMembers(userid, query) {
      return run(() => {
        const c = needTeam(context(userid, query.eventID))
        const since = int(query.playerID_since)
        const rows = d.participants
          .filter((x) => x.teamID === c.team.teamID && x.playerID > since)
          .sort((a, b) => a.playerID - b.playerID)
          .map((x) => ({
            playerID: x.playerID, displayName: d.players.find((p) => p.playerID === x.playerID).displayName,
            isCaptain: c.team.captainID === x.playerID ? 'Y' : 'N',
          }))
        return ok({ members: page(rows) })
      })
    },

    removeMember(userid, playerID, query) {
      return run(() => {
        const c = needTeamMode(needTeam(context(userid, query.eventID)))
        if (now() >= c.event.startTS) refuse('08', '53', 'The event has started: nobody can leave or be removed')
        const self = int(playerID) === c.player.playerID
        const isCaptain = c.team.captainID === c.player.playerID
        if (self && isCaptain && c.team.memberCount > 1) refuse('08', '53', 'Hand over captaincy before you leave')
        if (!self && !isCaptain) refuse('08', '50', 'Only the captain can remove members')
        const target = d.participants.find((x) => x.teamID === c.team.teamID && x.playerID === int(playerID))
        if (!target) refuse('04', '01', 'Player not in your team')
        target.teamID = 0
        c.team.memberCount -= 1
        if (c.team.memberCount === 0) d.teams = d.teams.filter((t) => t.teamID !== c.team.teamID)
        return ok()
      })
    },

    handOver(userid, eventID, body) {
      return run(() => {
        const c = needTeamMode(needTeam(context(userid, eventID)))
        if (c.team.captainID !== c.player.playerID) refuse('08', '50', 'Only the captain can hand over')
        const target = d.participants.find((x) => x.teamID === c.team.teamID && x.playerID === int(body.playerID))
        if (!target) refuse('04', '01', 'Player not in your team')
        c.team.captainID = target.playerID
        return ok()
      })
    },
  }
}
