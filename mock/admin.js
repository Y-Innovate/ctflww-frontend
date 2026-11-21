// The admin side of the mock backend: the CTFM operations behind
// /admin/..., with their checks and reason codes. The wrappers' admin check
// (CTFADMP, the RACF resource CTF.ADMIN) is done by mock/routes.js before
// these are called. Shares the data of mock/db.js; each step of
// PLAN-ADMIN.md adds its operations here.
import { int, ok, page, randomCode, refuse, run, text, upper } from './util.js'

// CTFM001 R025: the fields CTFM910 reads the settings into (LCTFC910)
const SETTING_LENGTHS = {
  JOBCLASS: 1, MSGCLASS: 1, DB2SSID: 4, SUBMTXN: 4, CLAIMHRS: 4,
  BATCHUSR: 8, PLAYGRP: 8, CTFPLAN: 8, SUBMUSR: 8, DB2HLQ: 20, DB2SSHLQ: 20, LOADLIB: 44,
}
const NUMERIC_SETTINGS = ['CLAIMHRS', 'JOBMINS']

// ctx: { d (the data), now(), phaseOf(event) } from createDb
export function createAdmin({ d, now, phaseOf, later }) {
  const EVENT_FIELDS = ['eventID', 'eventName', 'eventStatus', 'playMode', 'maxTeamSize', 'startTS', 'endTS',
    'freezeTS', 'regFromTS', 'regToTS', 'maxPlayers', 'racfGroup', 'playerCount', 'createdBy', 'createdDate',
    'updatedBy', 'updatedDate']

  function adminEventRow(e) {
    return { ...Object.fromEntries(EVENT_FIELDS.map((f) => [f, e[f] ?? ''])), phase: phaseOf(e) }
  }
  // GET /admin/events/{id}: also the description and the registration code
  const adminEventFull = (e) => ({ ...adminEventRow(e), eventDescription: e.eventDescription ?? '', regCode: e.regCode ?? '' })
  const eventOf = (eventID) => d.events.find((e) => e.eventID === int(eventID))

  // ---- Events (CTFM002) --------------------------------------------------
  const TS_RE = /^\d{4}-\d{2}-\d{2}-\d{2}\.\d{2}\.\d{2}\.\d{6}$/

  // R020, R021, R022: the fields of C and U, in the module's order
  function checkEvent(body, opcode) {
    const f = {
      eventName: text(body.eventName),
      eventDescription: text(body.eventDescription),
      regCode: text(body.regCode),
      eventStatus: upper(body.eventStatus),
      playMode: upper(body.playMode),
      maxTeamSize: int(body.maxTeamSize),
      maxPlayers: int(body.maxPlayers),
      racfGroup: upper(body.racfGroup),
      startTS: text(body.startTS),
      endTS: text(body.endTS),
      freezeTS: text(body.freezeTS),
      regFromTS: text(body.regFromTS),
      regToTS: text(body.regToTS),
    }
    if (!f.eventName || f.eventName.length > 100) refuse('08', '02', 'eventName is required, up to 100 characters')
    if (f.eventDescription.length > 1000) refuse('08', '02', 'eventDescription has up to 1000 characters')
    if (!f.regCode || f.regCode.length > 32) refuse('08', '02', 'regCode is required, up to 32 characters')
    if (opcode === 'C') {
      f.eventStatus ||= 'D'
      if (f.eventStatus !== 'D') refuse('08', '03', 'A new event is a DRAFT: eventStatus must be D')
    } else {
      if (f.eventStatus === 'C') refuse('08', '53', 'Close an event with POST /admin/eventClosures')
      if (f.eventStatus === 'A') refuse('08', '53', 'Archive an event with POST /admin/eventArchives')
      if (f.eventStatus !== 'D' && f.eventStatus !== 'P') refuse('08', '03', 'eventStatus must be D or P')
    }
    if (f.playMode !== 'I' && f.playMode !== 'T') refuse('08', '03', 'playMode must be I or T')
    if (f.playMode === 'I' && f.maxTeamSize === 0) f.maxTeamSize = 1
    if (f.playMode === 'I' && f.maxTeamSize !== 1) refuse('08', '04', 'An individual event has maxTeamSize 1')
    if (f.playMode === 'T' && f.maxTeamSize < 2) refuse('08', '04', 'A team event has maxTeamSize 2 or more')
    if (f.maxPlayers < 1) refuse('08', '04', 'maxPlayers must be 1 or more')
    if (f.racfGroup && !d.refTables.some((r) => r.tableID === 'RACFGRP' && r.tabKey === f.racfGroup)) {
      refuse('08', '06', 'racfGroup is not in the RACFGRP list')
    }
    if (!f.startTS || !f.endTS || !f.regFromTS || !f.regToTS) {
      refuse('08', '05', 'startTS, endTS, regFromTS and regToTS are required')
    }
    for (const ts of [f.startTS, f.endTS, f.freezeTS, f.regFromTS, f.regToTS]) {
      if (ts && !TS_RE.test(ts)) refuse('08', '05', 'A date is not a valid timestamp')
    }
    if (!(f.startTS < f.endTS)) refuse('08', '05', 'startTS must be before endTS')
    if (f.freezeTS && !(f.freezeTS > f.startTS && f.freezeTS < f.endTS)) {
      refuse('08', '05', 'freezeTS must be after startTS and before endTS')
    }
    if (!(f.regFromTS < f.regToTS)) refuse('08', '05', 'regFromTS must be before regToTS')
    return f
  }

  // R131: status changes and the locks once someone has a place
  function checkState(e, f) {
    const places = d.participants.filter((x) => x.eventID === e.eventID).length
    const maxMembers = Math.max(0, ...d.teams.filter((t) => t.eventID === e.eventID).map((t) => t.memberCount))
    const visible = d.eventChallenges.filter((ec) => ec.eventID === e.eventID && ec.isVisible === 'Y').length
    if (e.eventStatus === 'C' || e.eventStatus === 'A') refuse('08', '53', 'A closed or archived event cannot be changed')
    if (f.eventStatus === 'P' && e.eventStatus === 'D' && visible === 0) {
      refuse('08', '53', 'Publishing needs at least one visible challenge')
    }
    if (places > 0 && f.eventStatus === 'D') refuse('08', '53', 'Players have joined: the event stays published')
    if (places > 0 && (f.playMode !== e.playMode || f.racfGroup !== (e.racfGroup ?? ''))) {
      refuse('08', '53', 'Players have joined: play mode and RACF group are locked')
    }
    if (f.maxTeamSize < maxMembers) refuse('08', '53', 'maxTeamSize is below the size of a team')
    if (f.maxPlayers < e.playerCount) refuse('08', '53', 'maxPlayers is below the places taken')
  }

  // ---- Reference tables (CTFM001, CTFM401) ------------------------------
  const REF_FIELDS = ['tableID', 'tabKey', 'tabValue', 'createdBy', 'createdDate', 'updatedBy', 'updatedDate']
  const refRow = (r) => Object.fromEntries(REF_FIELDS.map((f) => [f, r[f] ?? '']))
  const refOf = (tableID, tabKey) => d.refTables.find((r) => r.tableID === tableID && r.tabKey === tabKey)
  const isNumber = (v) => /^\s*[+-]?(\d+\.?\d*|\.\d+)\s*$/.test(v)

  // R010/R020: keys in upper case, lengths, and numbers for SETTINGS
  function refKeys(tableID, tabKey) {
    const t = upper(tableID)
    const k = upper(tabKey)
    if (!t || !k) refuse('08', '02', 'tableID and tabKey are required')
    if (t.length > 8 || k.length > 8) refuse('08', '02', 'tableID and tabKey have up to 8 characters')
    return [t, k]
  }
  function checkValue(tableID, tabKey, tabValue) {
    const v = text(tabValue)
    if (v.length > 255) refuse('08', '02', 'tabValue has up to 255 characters')
    if (tableID === 'SETTINGS') {
      // R025: required, fits the field of CTFM910, numbers for two keys
      if (!v) refuse('08', '02', 'A setting needs a value')
      const max = SETTING_LENGTHS[tabKey] ?? 255
      if (v.length > max) refuse('08', '02', `This setting has up to ${max} characters`)
      if (NUMERIC_SETTINGS.includes(tabKey) && !isNumber(v)) refuse('08', '03', 'This setting needs a number as its value')
    }
    return v
  }

  // ---- Library (CTFM007 to CTFM010, CTFM407 to CTFM410) ------------------
  const STAMPS = ['createdBy', 'createdDate', 'updatedBy', 'updatedDate']
  const pick = (row, fields) => Object.fromEntries([...fields, ...STAMPS].map((f) => [f, row[f] ?? '']))
  const challengeOf = (challengeID) => d.library.find((c) => c.challengeID === int(challengeID))
  const nextID = (rows, key) => rows.reduce((m, r) => Math.max(m, r[key]), 0) + 1
  const stamped = (userid, row) => {
    const stamp = now()
    return { ...row, createdBy: upper(userid), createdDate: stamp, updatedBy: upper(userid), updatedDate: stamp }
  }
  const touch = (userid, row, fields) => Object.assign(row, fields, { updatedBy: upper(userid), updatedDate: now() })
  // The lists of flags, hints and links of one challenge, by ID
  const childList = (rows, key, query) => {
    const since = int(query[`${key}_since`])
    return page(rows.filter((r) => r.challengeID === int(query.challengeID) && r[key] > since)
      .sort((a, b) => a[key] - b[key]))
  }
  const needChallenge = (challengeID) => {
    if (!challengeOf(challengeID)) refuse('08', '13', 'Challenge not found')
    return int(challengeID)
  }

  const CHALLENGE_FIELDS = ['challengeID', 'challengeTitle', 'category', 'challengeDescription', 'challengeType', 'verifierPgm']
  const challengeRow = (c) => pick({ challengeType: 'S', ...c }, CHALLENGE_FIELDS)
  // CTFM007 R020
  function checkChallenge(body) {
    const f = {
      challengeTitle: text(body.challengeTitle),
      challengeDescription: text(body.challengeDescription),
      challengeType: upper(body.challengeType) || 'S',
      category: upper(body.category),
    }
    if (!f.challengeTitle || f.challengeTitle.length > 100) refuse('08', '02', 'challengeTitle is required, up to 100 characters')
    if (!f.challengeDescription || f.challengeDescription.length > 3000) {
      refuse('08', '02', 'challengeDescription is required, up to 3000 characters')
    }
    if (f.challengeType !== 'S') refuse('08', '03', 'challengeType must be S')
    if (text(body.verifierPgm)) refuse('08', '03', 'There is no verifierPgm in v1')
    if (!d.refTables.some((r) => r.tableID === 'CATEGORY' && r.tabKey === f.category)) {
      refuse('08', '06', 'category is not in the CATEGORY list')
    }
    return f
  }
  // CTFM008, CTFM009, CTFM010 R020
  function checkFlag(body) {
    const flagValue = String(body.flagValue ?? '')
    if (!flagValue || flagValue.length > 255) refuse('08', '02', 'flagValue is required, up to 255 characters')
    const caseSensitive = upper(body.caseSensitive)
    if (caseSensitive !== 'Y' && caseSensitive !== 'N') refuse('08', '03', 'caseSensitive must be Y or N')
    return { flagValue, caseSensitive }
  }
  function checkHint(body) {
    const hintText = text(body.hintText)
    if (!hintText || hintText.length > 1000) refuse('08', '02', 'hintText is required, up to 1000 characters')
    if (int(body.cost) < 0) refuse('08', '04', 'cost must be 0 or more')
    return { hintText, cost: int(body.cost), sortOrder: int(body.sortOrder) }
  }
  function checkLink(body) {
    const linkName = text(body.linkName)
    const linkUrl = text(body.linkUrl)
    if (!linkName || linkName.length > 60) refuse('08', '02', 'linkName is required, up to 60 characters')
    if (!linkUrl || linkUrl.length > 500) refuse('08', '02', 'linkUrl is required, up to 500 characters')
    return { linkName, linkUrl }
  }

  // C, U and D of a flag, hint or link (the three modules are alike)
  function childOps(collection, key, check, notFound, beforeDelete = () => {}) {
    return {
      create(userid, body) {
        return run(() => {
          const fields = check(body)
          const challengeID = needChallenge(body.challengeID)
          const row = stamped(userid, { [key]: nextID(d[collection], key), challengeID, ...fields })
          d[collection].push(row)
          return ok(row, 201)
        })
      },
      update(userid, id, body) {
        return run(() => {
          const fields = check(body)
          const row = d[collection].find((r) => r[key] === int(id))
          if (!row) refuse('08', '31', notFound)
          touch(userid, row, fields)
          return ok(row)
        })
      },
      remove(id) {
        return run(() => {
          const row = d[collection].find((r) => r[key] === int(id))
          if (!row) refuse('08', '41', notFound)
          beforeDelete(row)
          d[collection] = d[collection].filter((r) => r !== row)
          return ok()
        })
      },
    }
  }
  const flagOps = childOps('flags', 'flagID', checkFlag, 'Flag not found', (f) => {
    const others = d.flags.some((x) => x.challengeID === f.challengeID && x.flagID !== f.flagID)
    const visible = d.eventChallenges.some((ec) => ec.challengeID === f.challengeID && ec.isVisible === 'Y')
    if (!others && visible) refuse('08', '53', 'The last flag of a challenge visible in an event')
  })
  const hintOps = childOps('hints', 'hintID', checkHint, 'Hint not found', (h) => {
    if (d.hintUnlocks.some((u) => u.hintID === h.hintID)) refuse('08', '53', 'Teams have unlocked this hint')
  })
  const linkOps = childOps('links', 'linkID', checkLink, 'Link not found')

  // ---- Challenges of an event (CTFM011, CTFM012, CTFM412) ---------------
  // R030: the event exists and isn't closed or archived
  function openEvent(eventID) {
    const e = eventOf(eventID)
    if (!e) refuse('08', '13', 'Event not found')
    if (e.eventStatus === 'C' || e.eventStatus === 'A') refuse('08', '53', 'The event is closed or archived')
    return e
  }
  const ecRowOf = (eventID, challengeID) =>
    d.eventChallenges.find((ec) => ec.eventID === int(eventID) && ec.challengeID === int(challengeID))

  // CTFM011 R020, with R030 and the flag check, in the module's order
  function checkEventChallenge(eventID, challengeID, body) {
    const f = {
      scoreType: upper(body.scoreType),
      isVisible: upper(body.isVisible) || 'N',
      initPoints: int(body.initPoints),
      minPoints: int(body.minPoints),
      decaySolves: int(body.decaySolves),
      maxAttempts: int(body.maxAttempts),
      sortOrder: int(body.sortOrder),
    }
    if (f.scoreType !== 'S' && f.scoreType !== 'D') refuse('08', '03', 'scoreType must be S or D')
    if (f.isVisible !== 'Y' && f.isVisible !== 'N') refuse('08', '03', 'isVisible must be Y or N')
    if (f.initPoints < 0) refuse('08', '04', 'initPoints must be 0 or more')
    if (f.maxAttempts < 0) refuse('08', '04', 'maxAttempts must be 0 (no limit) or more')
    if (f.scoreType === 'D' && (f.minPoints < 0 || f.minPoints > f.initPoints)) {
      refuse('08', '04', 'Dynamic: initPoints >= minPoints >= 0')
    }
    if (f.scoreType === 'D' && f.decaySolves < 1) refuse('08', '04', 'Dynamic: decaySolves must be 1 or more')
    openEvent(eventID)
    if (f.scoreType === 'S') Object.assign(f, { minPoints: 0, decaySolves: 0 }) // NULL in DB2
    if (f.isVisible === 'Y' && !d.flags.some((x) => x.challengeID === int(challengeID))) {
      refuse('08', '53', 'A challenge needs a flag to be visible')
    }
    return f
  }

  // CTFM017 R020
  function checkAnnouncement(body) {
    const announceTitle = text(body.announceTitle)
    const announceBody = text(body.announceBody)
    if (!announceTitle || announceTitle.length > 100) refuse('08', '02', 'announceTitle is required, up to 100 characters')
    if (!announceBody || announceBody.length > 1000) refuse('08', '03', 'announceBody is required, up to 1000 characters')
    return { announceTitle, announceBody }
  }

  // ---- Players (CTFM403, CTFM503, CTFM510) -------------------------------
  const PLAYER_FIELDS = ['playerID', 'racfUserid', 'displayName', 'playerStatus', 'claimExpires']
  const playerRow = (p) => pick(p, PLAYER_FIELDS)
  // Allowed from PLAYERSTATUS, per PROVACTION: P reset, V revoke, U resume, X delete
  const ALLOWED_FROM = { P: ['A', 'R', 'V'], V: ['A', 'R'], U: ['V'], X: ['V'] }
  // What the player becomes when the job reports success (CTFM915)
  const AFTER_JOB = { C: 'R', P: 'R', V: 'V', U: 'A', X: 'X' }
  const JOB_FIELDS = ['provJobID', 'playerID', 'eventID', 'provAction', 'racfGroup', 'jobStatus', 'jesJobID',
    'submittedDate', 'completedDate', 'jobRC', 'jobMessage', 'retryCount']
  const newToken = () => `${randomCode(4)}-${randomCode(4)}-${randomCode(4)}-${randomCode(4)}`
  const OPEN_JOB = ['N', 'Q', 'S']

  // The submitted jobs of CTFM510 finish 5 s (mock time) after submitting
  function settleJobs() {
    for (const j of d.provJobs.filter((x) => ['N', 'S'].includes(x.jobStatus) && x.doneAt && now() >= x.doneAt)) {
      Object.assign(j, { jobStatus: 'D', completedDate: j.doneAt, jobRC: 0, jobMessage: 'Done' })
      const p = d.players.find((x) => x.playerID === j.playerID)
      if (p && AFTER_JOB[j.provAction]) p.playerStatus = AFTER_JOB[j.provAction]
    }
  }

  function playerJob(userid, playerID, provAction) {
    return run(() => {
      settleJobs()
      const p = d.players.find((x) => x.playerID === int(playerID))
      if (!p) refuse('04', '01', 'Player not found')
      if (!ALLOWED_FROM[provAction].includes(p.playerStatus)) refuse('08', '53', 'Not possible with this player status')
      if (d.provJobs.some((j) => j.playerID === p.playerID && OPEN_JOB.includes(j.jobStatus))) {
        refuse('08', '53', 'This player has an open job')
      }
      const provJobID = nextID(d.provJobs, 'provJobID')
      d.provJobs.push(stamped(userid, {
        provJobID, playerID: p.playerID, eventID: 0, provAction, racfGroup: '', jobStatus: 'S',
        jesJobID: `JOB${String(10000 + provJobID).slice(-5)}`, submittedDate: now(), completedDate: '', jobRC: -1,
        jobMessage: '', retryCount: 0, doneAt: later(5000),
      }))
      if (provAction !== 'P') return ok({ provJobID })
      // A reset: a new claim token, the phrase is derived from it
      const claimToken = newToken()
      p.claimToken = claimToken
      return ok({ provJobID, claimToken })
    })
  }

  // CTFM012: does `from`, following its prerequisites, reach `to`?
  function reaches(eventID, from, to, seen = new Set()) {
    if (from === to) return true
    if (seen.has(from)) return false
    seen.add(from)
    return d.prereqs.filter((q) => q.eventID === eventID && q.challengeID === from)
      .some((q) => reaches(eventID, q.reqChallengeID, to, seen))
  }

  return {
    // CTFM401: by table ID and key; the filter matches the start of the table ID
    adminRefTables(query) {
      const filter = upper(query.tableID_filter)
      const t = upper(query.tableID_since)
      const k = upper(query.tabKey_since)
      const rows = d.refTables
        .filter((r) => r.tableID.startsWith(filter))
        .filter((r) => !t || r.tableID > t || (r.tableID === t && r.tabKey > k))
        .sort((a, b) => a.tableID.localeCompare(b.tableID) || a.tabKey.localeCompare(b.tabKey))
        .map(refRow)
      return ok({ refTables: page(rows) })
    },

    createRefTable(userid, body) {
      return run(() => {
        const [tableID, tabKey] = refKeys(body.tableID, body.tabKey)
        const tabValue = checkValue(tableID, tabKey, body.tabValue)
        if (refOf(tableID, tabKey)) refuse('08', '11', 'This entry exists already')
        const stamp = now()
        const row = { tableID, tabKey, tabValue, createdBy: upper(userid), createdDate: stamp, updatedBy: upper(userid), updatedDate: stamp }
        d.refTables.push(row)
        return ok(refRow(row), 201)
      })
    },

    updateRefTable(userid, tableID, tabKey, body) {
      return run(() => {
        const [t, k] = refKeys(tableID, tabKey)
        const tabValue = checkValue(t, k, body.tabValue)
        const row = refOf(t, k)
        if (!row) refuse('08', '31', 'Entry not found')
        Object.assign(row, { tabValue, updatedBy: upper(userid), updatedDate: now() })
        return ok(refRow(row))
      })
    },

    // R040: SETTINGS keys, and categories and groups in use, stay
    deleteRefTable(tableID, tabKey) {
      return run(() => {
        const [t, k] = refKeys(tableID, tabKey)
        const row = refOf(t, k)
        if (!row) refuse('08', '41', 'Entry not found')
        if (t === 'SETTINGS') refuse('08', '53', 'The programs need every SETTINGS key')
        if (t === 'CATEGORY' && d.library.some((c) => c.category === k)) {
          refuse('08', '53', 'A challenge uses this category')
        }
        if (t === 'RACFGRP' && d.events.some((e) => e.racfGroup === k)) refuse('08', '53', 'An event uses this group')
        d.refTables = d.refTables.filter((r) => r !== row)
        return ok()
      })
    },

    adminEvent(eventID) {
      return run(() => {
        const e = eventOf(eventID)
        if (!e) refuse('04', '01', 'Event not found')
        return ok(adminEventFull(e))
      })
    },

    createEvent(userid, body) {
      return run(() => {
        const f = checkEvent(body, 'C')
        const stamp = now()
        const e = {
          eventID: d.events.reduce((m, x) => Math.max(m, x.eventID), 0) + 1, ...f, playerCount: 0,
          createdBy: upper(userid), createdDate: stamp, updatedBy: upper(userid), updatedDate: stamp,
        }
        d.events.push(e)
        return ok(adminEventFull(e), 201)
      })
    },

    updateEvent(userid, eventID, body) {
      return run(() => {
        const f = checkEvent(body, 'U')
        const e = eventOf(eventID)
        if (!e) refuse('08', '31', 'Event not found')
        checkState(e, f)
        Object.assign(e, f, { updatedBy: upper(userid), updatedDate: now() })
        return ok(adminEventFull(e))
      })
    },

    // R140: only a DRAFT, with its challenges, prerequisites and announcements
    deleteEvent(eventID) {
      return run(() => {
        const e = eventOf(eventID)
        if (!e) refuse('08', '41', 'Event not found')
        if (e.eventStatus !== 'D') refuse('08', '53', 'Only a DRAFT event can be deleted')
        d.eventChallenges = d.eventChallenges.filter((x) => x.eventID !== e.eventID)
        d.prereqs = d.prereqs.filter((x) => x.eventID !== e.eventID)
        d.announcements = d.announcements.filter((x) => x.eventID !== e.eventID)
        d.events = d.events.filter((x) => x !== e)
        return ok()
      })
    },

    // CTFM407: the library by ID; the category filter matches the start
    adminChallenges(query) {
      const filter = upper(query.category_filter)
      const since = int(query.challengeID_since)
      const rows = d.library.filter((c) => c.category.startsWith(filter) && c.challengeID > since)
        .sort((a, b) => a.challengeID - b.challengeID)
        .map((c) => pick({ challengeType: 'S', ...c }, ['challengeID', 'challengeTitle', 'category', 'challengeType']))
      return ok({ challenges: page(rows) })
    },
    adminChallenge(challengeID) {
      return run(() => {
        const c = challengeOf(challengeID)
        if (!c) refuse('04', '01', 'Challenge not found')
        return ok(challengeRow(c))
      })
    },
    createChallenge(userid, body) {
      return run(() => {
        const c = stamped(userid, { challengeID: nextID(d.library, 'challengeID'), ...checkChallenge(body) })
        d.library.push(c)
        return ok(challengeRow(c), 201)
      })
    },
    updateChallenge(userid, challengeID, body) {
      return run(() => {
        const fields = checkChallenge(body)
        const c = challengeOf(challengeID)
        if (!c) refuse('08', '31', 'Challenge not found')
        touch(userid, c, fields)
        return ok(challengeRow(c))
      })
    },
    // Not while in an event; otherwise its flags, hints and links go with it
    deleteChallenge(challengeID) {
      return run(() => {
        const c = challengeOf(challengeID)
        if (!c) refuse('08', '41', 'Challenge not found')
        if (d.eventChallenges.some((ec) => ec.challengeID === c.challengeID)) {
          refuse('08', '53', 'The challenge is in an event; take it out first')
        }
        for (const k of ['flags', 'hints', 'links']) d[k] = d[k].filter((r) => r.challengeID !== c.challengeID)
        d.library = d.library.filter((x) => x !== c)
        return ok()
      })
    },

    adminFlags: (query) => ok({ flags: childList(d.flags, 'flagID', query) }),
    createFlag: (userid, body) => flagOps.create(userid, body),
    updateFlag: (userid, id, body) => flagOps.update(userid, id, body),
    deleteFlag: (id) => flagOps.remove(id),
    adminHints: (query) => ok({ hints: childList(d.hints, 'hintID', query) }),
    createHint: (userid, body) => hintOps.create(userid, body),
    updateHint: (userid, id, body) => hintOps.update(userid, id, body),
    deleteHint: (id) => hintOps.remove(id),
    adminLinks: (query) => ok({ links: childList(d.links, 'linkID', query) }),
    createLink: (userid, body) => linkOps.create(userid, body),
    updateLink: (userid, id, body) => linkOps.update(userid, id, body),
    deleteLink: (id) => linkOps.remove(id),

    // CTFM411: the challenges of an event, hidden ones too, by ID
    adminEventChallenges(query) {
      const since = int(query.challengeID_since)
      const rows = d.eventChallenges
        .filter((ec) => ec.eventID === int(query.eventID) && ec.challengeID > since)
        .sort((a, b) => a.challengeID - b.challengeID)
        .map((ec) => pick({ ...ec, challengeTitle: challengeOf(ec.challengeID)?.challengeTitle },
          ['eventID', 'challengeID', 'challengeTitle', 'scoreType', 'initPoints', 'minPoints', 'decaySolves',
            'isVisible', 'sortOrder', 'maxAttempts']))
      return ok({ eventChallenges: page(rows) })
    },

    createEventChallenge(userid, body) {
      return run(() => {
        const f = checkEventChallenge(body.eventID, body.challengeID, body)
        if (!challengeOf(body.challengeID)) refuse('08', '13', 'Event or challenge not found')
        if (ecRowOf(body.eventID, body.challengeID)) refuse('08', '11', 'This row exists already')
        const row = stamped(userid, { eventID: int(body.eventID), challengeID: int(body.challengeID), ...f })
        d.eventChallenges.push(row)
        return ok(row, 201)
      })
    },
    updateEventChallenge(userid, challengeID, eventID, body) {
      return run(() => {
        const f = checkEventChallenge(eventID, challengeID, body)
        const row = ecRowOf(eventID, challengeID)
        if (!row) refuse('08', '31', 'The challenge is not in this event')
        touch(userid, row, f)
        return ok(row)
      })
    },
    // Refused once there are submissions or hint unlocks; prerequisites go with it
    deleteEventChallenge(challengeID, eventID) {
      return run(() => {
        openEvent(eventID)
        const row = ecRowOf(eventID, challengeID)
        if (!row) refuse('08', '41', 'The challenge is not in this event')
        if (d.submissions.some((x) => x.eventID === row.eventID && x.challengeID === row.challengeID)) {
          refuse('08', '53', 'The challenge has submissions: hide it instead')
        }
        const hintIDs = d.hints.filter((h) => h.challengeID === row.challengeID).map((h) => h.hintID)
        if (d.hintUnlocks.some((u) => u.eventID === row.eventID && hintIDs.includes(u.hintID))) {
          refuse('08', '53', 'Teams unlocked its hints: hide it instead')
        }
        d.prereqs = d.prereqs.filter((q) => !(q.eventID === row.eventID &&
          (q.challengeID === row.challengeID || q.reqChallengeID === row.challengeID)))
        d.eventChallenges = d.eventChallenges.filter((x) => x !== row)
        return ok()
      })
    },

    // CTFM412: by challenge and required challenge; filter one locked challenge
    adminPrerequisites(query) {
      const filter = int(query.challengeID_filter)
      const c = int(query.challengeID_since)
      const r = int(query.reqChallengeID_since)
      const rows = d.prereqs
        .filter((q) => q.eventID === int(query.eventID) && (!filter || q.challengeID === filter))
        .filter((q) => q.challengeID > c || (q.challengeID === c && q.reqChallengeID > r))
        .sort((a, b) => a.challengeID - b.challengeID || a.reqChallengeID - b.reqChallengeID)
        .map((q) => pick(q, ['eventID', 'challengeID', 'reqChallengeID']))
      return ok({ prerequisites: page(rows) })
    },
    createPrerequisite(userid, body) {
      return run(() => {
        const [eventID, challengeID, reqChallengeID] = [int(body.eventID), int(body.challengeID), int(body.reqChallengeID)]
        if (challengeID === reqChallengeID) refuse('08', '03', 'A challenge cannot require itself')
        openEvent(eventID)
        if (reaches(eventID, reqChallengeID, challengeID)) refuse('08', '53', 'This prerequisite would make a cycle')
        if (!ecRowOf(eventID, challengeID) || !ecRowOf(eventID, reqChallengeID)) {
          refuse('08', '13', 'Both challenges must be in the event')
        }
        if (d.prereqs.some((q) => q.eventID === eventID && q.challengeID === challengeID && q.reqChallengeID === reqChallengeID)) {
          refuse('08', '11', 'This row exists already')
        }
        const row = stamped(userid, { eventID, challengeID, reqChallengeID })
        d.prereqs.push(row)
        return ok(pick(row, ['eventID', 'challengeID', 'reqChallengeID']), 201)
      })
    },
    deletePrerequisite(challengeID, query) {
      return run(() => {
        const eventID = int(query.eventID)
        openEvent(eventID)
        const row = d.prereqs.find((q) => q.eventID === eventID && q.challengeID === int(challengeID) &&
          q.reqChallengeID === int(query.reqChallengeID))
        if (!row) refuse('08', '41', 'Prerequisite not found')
        d.prereqs = d.prereqs.filter((q) => q !== row)
        return ok()
      })
    },

    // ---- Monitor (CTFM405, CTFM413, CTFM414, CTFM514) ----
    // The teams of an event by ID, also the teams of one of an individual event
    adminTeams(query) {
      const since = int(query.teamID_since)
      const rows = d.teams.filter((t) => t.eventID === int(query.eventID) && t.teamID > since)
        .sort((a, b) => a.teamID - b.teamID)
        .map((t) => pick(t, ['teamID', 'teamName', 'captainID', 'memberCount']))
      return ok({ teams: page(rows) })
    },

    // Newest first: submissionID_since pages downwards
    adminSubmissions(query) {
      return run(() => {
        const correct = upper(query.isCorrect_filter)
        if (correct && correct !== 'Y' && correct !== 'N') refuse('08', '01', 'isCorrect_filter must be Y or N')
        const since = int(query.submissionID_since)
        const f = (k) => int(query[`${k}ID_filter`])
        const rows = d.submissions
          .filter((x) => x.eventID === int(query.eventID) && (!since || x.submissionID < since))
          .filter((x) => (!f('team') || x.teamID === f('team')) && (!f('player') || x.playerID === f('player')) &&
            (!f('challenge') || x.challengeID === f('challenge')) && (!correct || x.isCorrect === correct))
          .sort((a, b) => b.submissionID - a.submissionID)
          .map((x) => ({
            submissionID: x.submissionID, eventID: x.eventID, challengeID: x.challengeID, teamID: x.teamID,
            playerID: x.playerID, submittedText: x.submittedText, isCorrect: x.isCorrect, reversedBy: x.reversedBy ?? '',
            reversedDate: x.reversedDate ?? '', reverseReason: x.reverseReason ?? '', createdDate: x.createdDate,
          }))
        return ok({ submissions: page(rows) })
      })
    },

    // By challenge and team; reversed solves are gone (only in submissions)
    adminSolves(query) {
      const c = int(query.challengeID_since)
      const t = int(query.teamID_since)
      const f = (k) => int(query[`${k}ID_filter`])
      const rows = d.solves
        .filter((x) => x.eventID === int(query.eventID))
        .filter((x) => (!f('team') || x.teamID === f('team')) && (!f('challenge') || x.challengeID === f('challenge')))
        .filter((x) => x.challengeID > c || (x.challengeID === c && x.teamID > t))
        .sort((a, b) => a.challengeID - b.challengeID || a.teamID - b.teamID)
        .map(({ challengeID, teamID, playerID, submissionID, createdDate }) =>
          ({ challengeID, teamID, playerID, submissionID, createdDate }))
      return ok({ solves: page(rows) })
    },

    // CTFM514: the solve goes, the submission keeps isCorrect Y with who, when, why
    reverseSolve(userid, body) {
      return run(() => {
        const reason = text(body.reverseReason)
        if (!reason || reason.length > 255) refuse('08', '02', 'reverseReason is required, up to 255 characters')
        const e = eventOf(body.eventID)
        if (e?.eventStatus === 'C' || e?.eventStatus === 'A') refuse('08', '53', 'The event is closed or archived')
        const solve = d.solves.find((x) => x.eventID === int(body.eventID) && x.challengeID === int(body.challengeID) &&
          x.teamID === int(body.teamID))
        if (!solve) refuse('08', '41', 'No solve to reverse')
        const sub = d.submissions.find((x) => x.submissionID === solve.submissionID)
        if (!sub) refuse('08', '31', 'The submission of the solve is missing')
        Object.assign(sub, { reversedBy: upper(userid), reversedDate: now(), reverseReason: reason })
        d.solves = d.solves.filter((x) => x !== solve)
        return ok()
      })
    },

    // ---- Awards and penalties (CTFM016, CTFM416) ----
    adminAwards(query) {
      const since = int(query.awardID_since)
      const team = int(query.teamID_filter)
      const rows = d.awards
        .filter((a) => a.eventID === int(query.eventID) && a.awardID > since && (!team || a.teamID === team))
        .sort((a, b) => a.awardID - b.awardID)
        .map((a) => pick(a, ['awardID', 'eventID', 'teamID', 'points', 'reason']))
      return ok({ awards: page(rows) })
    },
    // Points may be negative, not 0; no update, only give and delete
    createAward(userid, body) {
      return run(() => {
        const points = int(body.points)
        const reason = text(body.reason)
        if (points === 0) refuse('08', '02', 'points must not be 0')
        if (!reason || reason.length > 255) refuse('08', '03', 'reason is required, up to 255 characters')
        const e = openEvent(body.eventID)
        if (!d.teams.some((t) => t.teamID === int(body.teamID) && t.eventID === e.eventID)) {
          refuse('08', '13', 'Team not found in this event')
        }
        const row = stamped(userid, { awardID: nextID(d.awards, 'awardID'), eventID: e.eventID, teamID: int(body.teamID), points, reason })
        d.awards.push(row)
        return ok(pick(row, ['awardID', 'eventID', 'teamID', 'points', 'reason']), 201)
      })
    },
    deleteAward(awardID) {
      return run(() => {
        const a = d.awards.find((x) => x.awardID === int(awardID))
        if (!a) refuse('08', '41', 'Award not found')
        openEvent(a.eventID)
        d.awards = d.awards.filter((x) => x !== a)
        return ok()
      })
    },

    // ---- Announcements (CTFM017, CTFM417) ----
    // Newest first: announceID_since pages downwards
    adminAnnouncements(query) {
      const since = int(query.announceID_since)
      const rows = d.announcements
        .filter((a) => a.eventID === int(query.eventID) && (!since || a.announceID < since))
        .sort((a, b) => b.announceID - a.announceID)
        .map((a) => pick(a, ['announceID', 'eventID', 'announceTitle', 'announceBody']))
      return ok({ announcements: page(rows) })
    },
    // Also on a DRAFT, not in a CLOSED event. U keeps the publish time.
    createAnnouncement(userid, body) {
      return run(() => {
        const fields = checkAnnouncement(body)
        const e = openEvent(body.eventID)
        const row = stamped(userid, { announceID: nextID(d.announcements, 'announceID'), eventID: e.eventID, ...fields })
        d.announcements.push(row)
        return ok(pick(row, ['announceID', 'eventID', 'announceTitle', 'announceBody']), 201)
      })
    },
    updateAnnouncement(userid, announceID, body) {
      return run(() => {
        const fields = checkAnnouncement(body)
        const a = d.announcements.find((x) => x.announceID === int(announceID))
        if (!a) refuse('08', '31', 'Announcement not found')
        openEvent(a.eventID)
        touch(userid, a, fields)
        return ok(pick(a, ['announceID', 'eventID', 'announceTitle', 'announceBody']))
      })
    },
    deleteAnnouncement(announceID) {
      return run(() => {
        const a = d.announcements.find((x) => x.announceID === int(announceID))
        if (!a) refuse('08', '41', 'Announcement not found')
        openEvent(a.eventID)
        d.announcements = d.announcements.filter((x) => x !== a)
        return ok()
      })
    },

    // ---- Closing (CTFM502) ----
    // A published event after its end becomes CLOSED, and in the same unit of
    // work queues (Q) a REMOVE (M) from the event's RACF group for every active
    // place, and a REVOKE (V) for every ACTIVE or READY player without a place
    // in another published event that hasn't ended. The batch carries them out.
    closeEvent(userid, eventID) {
      return run(() => {
        const e = eventOf(eventID)
        if (!e) refuse('04', '01', 'Event not found')
        if (e.eventStatus !== 'P' || now() < e.endTS) refuse('08', '53', 'Only a published event after its end')
        const places = d.participants.filter((x) => x.eventID === e.eventID)
        const queue = (playerID, provAction, racfGroup = '') => d.provJobs.push(stamped(userid, {
          provJobID: nextID(d.provJobs, 'provJobID'), playerID, eventID: e.eventID, provAction, racfGroup,
          jobStatus: 'Q', jesJobID: '', submittedDate: '', completedDate: '', jobRC: -1, jobMessage: '', retryCount: 0,
        }))
        if (e.racfGroup) {
          for (const x of places.filter((p) => p.partStatus === 'A')) queue(x.playerID, 'M', e.racfGroup)
        }
        const openElsewhere = (playerID) => d.participants.some((x) => x.playerID === playerID && x.eventID !== e.eventID &&
          d.events.some((o) => o.eventID === x.eventID && o.eventStatus === 'P' && o.endTS > now()))
        for (const x of places) {
          const p = d.players.find((pl) => pl.playerID === x.playerID)
          if (p && ['A', 'R'].includes(p.playerStatus) && !openElsewhere(p.playerID)) queue(p.playerID, 'V')
        }
        e.eventStatus = 'C'
        touch(userid, e, {})
        return ok({ eventID: e.eventID, eventStatus: 'C' })
      })
    },

    // ---- Archiving (CTFM540) ----
    // POST: CLOSED to ARCHIVED; DELETE: back. Only the status changes.
    archiveEvent(userid, eventID, archive) {
      return run(() => {
        const e = eventOf(eventID)
        if (!e) refuse('04', '01', 'Event not found')
        const [from, to] = archive ? ['C', 'A'] : ['A', 'C']
        if (e.eventStatus !== from) {
          refuse('08', '53', archive ? 'Only a closed event can be archived' : 'Only an archived event can be restored')
        }
        e.eventStatus = to
        touch(userid, e, {})
        return ok({ eventID: e.eventID, eventStatus: to })
      })
    },

    settleJobs,

    // Find players by ID; name and userid from the start, regardless of case
    adminPlayers(query) {
      settleJobs()
      const name = text(query.displayName_filter).toUpperCase()
      const userid = upper(query.racfUserid_filter)
      const status = upper(query.playerStatus_filter)
      const eventID = int(query.eventID_filter)
      const since = int(query.playerID_since)
      const rows = d.players
        .filter((p) => p.playerID > since && p.displayName.toUpperCase().startsWith(name) && p.racfUserid.startsWith(userid))
        .filter((p) => (!status || p.playerStatus === status) &&
          (!eventID || d.participants.some((x) => x.playerID === p.playerID && x.eventID === eventID)))
        .sort((a, b) => a.playerID - b.playerID)
        .map(playerRow)
      return ok({ players: page(rows) })
    },
    adminPlayer(playerID) {
      return run(() => {
        settleJobs()
        const p = d.players.find((x) => x.playerID === int(playerID))
        if (!p) refuse('04', '01', 'Player not found')
        return ok(playerRow(p))
      })
    },
    resetPlayer: (userid, playerID) => playerJob(userid, playerID, 'P'),
    revokePlayer: (userid, playerID) => playerJob(userid, playerID, 'V'),
    resumePlayer: (userid, playerID) => playerJob(userid, playerID, 'U'),
    deletePlayer: (userid, playerID) => playerJob(userid, playerID, 'X'),

    // ---- Provisioning jobs (CTFM404, CTFM520) ----
    // Newest first: provJobID_since pages downwards
    adminJobs(query) {
      settleJobs()
      const since = int(query.provJobID_since)
      const status = upper(query.jobStatus_filter)
      const f = (k) => int(query[`${k}ID_filter`])
      const rows = d.provJobs
        .filter((j) => (!since || j.provJobID < since) && (!status || j.jobStatus === status))
        .filter((j) => (!f('event') || j.eventID === f('event')) && (!f('player') || j.playerID === f('player')))
        .sort((a, b) => b.provJobID - a.provJobID)
        .map((j) => pick(j, JOB_FIELDS))
      return ok({ provisioningJobs: page(rows) })
    },
    // A failed job goes back to N (to Q for a REMOVE, the batch's); CREATE and
    // RESET get a new claim token, and a CREATE puts the player back to P
    retryJob(userid, provJobID) {
      return run(() => {
        settleJobs()
        const j = d.provJobs.find((x) => x.provJobID === int(provJobID))
        if (!j) refuse('04', '01', 'Job not found')
        if (j.jobStatus !== 'F') refuse('08', '53', 'Only a failed job can be retried')
        if (d.provJobs.some((x) => x !== j && x.playerID === j.playerID && OPEN_JOB.includes(x.jobStatus))) {
          refuse('08', '53', 'Another job of this player is open')
        }
        const queued = j.provAction === 'M'
        touch(userid, j, {
          jobStatus: queued ? 'Q' : 'N', retryCount: j.retryCount + 1, jobRC: -1, jobMessage: '', completedDate: '',
          doneAt: queued ? '' : later(5000),
        })
        let claimToken = ''
        if (j.provAction === 'C' || j.provAction === 'P') {
          claimToken = newToken()
          const p = d.players.find((x) => x.playerID === j.playerID)
          p.claimToken = claimToken
          if (j.provAction === 'C') p.playerStatus = 'P'
        }
        return ok({ provJobID: j.provJobID, jobStatus: j.jobStatus, claimToken })
      })
    },

    // CTFM402: all events by EVENTID, drafts and closed ones too; status
    // filter. Without it, archived events are left out.
    adminEvents(query) {
      const status = upper(query.eventStatus_filter)
      const since = int(query.eventID_since)
      const rows = d.events
        .filter((e) => (status ? e.eventStatus === status : e.eventStatus !== 'A') && e.eventID > since)
        .sort((a, b) => a.eventID - b.eventID)
        .map(adminEventRow)
      return ok({ events: page(rows) })
    },
  }
}
