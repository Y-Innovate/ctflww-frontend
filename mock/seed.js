// Seed data for the mocks, relative to `now`, so every phase is always there:
//   1 Spring Team CTF     teams, running, registration open, prerequisites
//   2 Frozen Night CTF    individual, frozen an hour ago, 28 players (paging)
//   3 Summer Team CTF     teams, upcoming, registration open
//   4 Autumn Solo CTF     individual, ended yesterday
//   5 Winter CTF 2025     closed
//   6 Draft CTF           draft, never shown
// Dev users (any passphrase that doesn't start with "wrong"):
//   CTF0001 Alice   captain of Root Access in 1, also in 4
//   CTF0002 Bob     member of Root Access in 1
//   CTF0003 Carol   in 1 without a team, in 3 without a team, in 2
//   CTF0004 Dave    in 2 and 4 only
//   CTF0005 Erin    pending place in 3 (waiting for a RACF job)
//   ADMIN01         organizer (Entra sign-in), no player record
import { at } from './clock.js'

const CATEGORIES = {
  ZOS: 'z/OS',
  WEB: 'Web',
  CRYPTO: 'Cryptography',
  FORENSIC: 'Forensics',
}

function library() {
  const c = (challengeID, challengeTitle, category, challengeDescription) =>
    ({ challengeID, challengeTitle, category, challengeDescription })
  return [
    c(1, 'Hello mainframe', 'ZOS', 'Sign on to TSO and find the flag in your HLQ.README data set.'),
    c(2, 'JCL detective', 'ZOS', 'A job ended with RC 12. The flag is in the SYSOUT of the step that failed.'),
    c(3, 'RACF riddle', 'ZOS', 'Which profile protects CTF.SECRET.DATA? The flag is its owner, as flag{OWNER}.'),
    c(4, 'Cookie jar', 'WEB', 'The web page remembers more than it should. Look closely at what it stores.'),
    c(5, 'Caesar salad', 'CRYPTO', 'Gur synt vf synt{ebgngr_zr}. Decode it.'),
    c(6, 'EBCDIC or bust', 'CRYPTO', 'C6D3C1C7C0C5C2C3C4C9C3D0: hex, but not ASCII.'),
    c(7, 'Lost in the logs', 'FORENSIC', 'Somebody signed on at 03:12. Find the userid in SYSLOG.'),
    c(8, 'The final boss', 'ZOS', 'Combine what you learned. Only open after the RACF riddle and the JCL detective.'),
  ]
}

// TBCTF008: per flag its challenge, the value and whether case matters
function flagsOf() {
  let flagID = 0
  const f = (challengeID, flagValue, caseSensitive = 'Y') => ({ flagID: ++flagID, challengeID, flagValue, caseSensitive })
  return [
    f(1, 'flag{hello_zos}'), f(2, 'flag{rc12}'), f(3, 'flag{SECADM}', 'N'), f(4, 'flag{om_nom}'),
    f(5, 'flag{rotate_me}', 'N'), f(6, 'flag{EBCDIC}'), f(7, 'flag{CTF0042}', 'N'), f(8, 'flag{boss}'),
  ]
}

function hintsOf() {
  let hintID = 0
  const h = (challengeID, sortOrder, cost, hintText) => ({ hintID: ++hintID, challengeID, sortOrder, cost, hintText })
  return [
    h(2, 1, 10, 'Look at the JESYSMSG of each step.'),
    h(2, 2, 25, 'The step name starts with STEP03.'),
    h(3, 1, 20, 'RLIST DATASET with GENERIC.'),
    h(5, 1, 5, 'Julius would know.'),
    h(8, 1, 50, 'There is no hint. Or is there?'),
  ]
}

function linksOf() {
  return [
    { linkID: 1, challengeID: 2, linkName: 'Job output (text)', linkUrl: 'https://example.com/ctf/jcl-detective.txt' },
    { linkID: 2, challengeID: 4, linkName: 'The web page', linkUrl: 'https://example.com/ctf/cookie-jar' },
    { linkID: 3, challengeID: 7, linkName: 'SYSLOG extract', linkUrl: 'https://example.com/ctf/syslog.txt' },
  ]
}

// TBCTF001 as SEEDDATA.sql fills it: categories, allowed RACF groups, and
// the settings of the provisioning jobs
function refTables(t) {
  const created = { createdBy: 'SEED', createdDate: t({ days: -90 }), updatedBy: 'SEED', updatedDate: t({ days: -90 }) }
  const r = (tableID, tabKey, tabValue) => ({ tableID, tabKey, tabValue, ...created })
  return [
    ...Object.entries(CATEGORIES).map(([k, v]) => r('CATEGORY', k, v)),
    r('CATEGORY', 'MISC', 'Miscellaneous'),
    r('RACFGRP', 'CTFPLAY', 'Players of the CTF events'),
    r('RACFGRP', 'CTFTEST', 'Test events'),
    r('SETTINGS', 'BATCHUSR', 'CTFBATCH'),
    r('SETTINGS', 'CLAIMHRS', '48'),
    r('SETTINGS', 'JOBCLASS', 'A'),
    r('SETTINGS', 'JOBMINS', '60'),
    r('SETTINGS', 'MSGCLASS', 'X'),
    r('SETTINGS', 'PLAYGRP', 'CTFPLAY'),
  ]
}

// TBCTF004: a failed CREATE (Fay), a failed REMOVE from the group of closed
// event 5, and a reset that is done. JOBRC -1 = no return code.
function provJobsOf(t, fay, extra) {
  const job = (provJobID, playerID, provAction, fields) => ({
    provJobID, playerID, eventID: 0, provAction, racfGroup: '', jobStatus: 'D', jesJobID: '', submittedDate: '',
    completedDate: '', jobRC: -1, jobMessage: '', retryCount: 0, createdBy: 'CTFBATCH', createdDate: t({ days: -3 }),
    updatedBy: 'CTFBATCH', updatedDate: t({ days: -3 }), ...fields,
  })
  return [
    job(1, extra[5].playerID, 'P', { jesJobID: 'JOB00101', submittedDate: t({ days: -38 }), completedDate: t({ days: -38 }), jobRC: 0, jobMessage: 'Done' }),
    job(2, extra[6].playerID, 'M', { eventID: 5, racfGroup: 'CTFPLAY', jobStatus: 'F', jesJobID: 'JOB00102', submittedDate: t({ days: -39 }), jobRC: 8, jobMessage: 'REMOVE CTFPLAY: ICH02005I USER NOT CONNECTED TO GROUP' }),
    job(3, fay.playerID, 'C', { jobStatus: 'F', jesJobID: 'JOB00103', submittedDate: t({ hours: -5 }), jobRC: 12, jobMessage: 'ADDUSER: ICH01024I USER PROFILE NOT DEFINED' }),
  ]
}

export function buildSeed(now = new Date()) {
  const t = (offset) => at(now, offset)

  const event = (eventID, eventName, fields) => ({
    eventID,
    eventName,
    eventDescription: '',
    eventStatus: 'P',
    playMode: 'T',
    maxTeamSize: 4,
    freezeTS: '',
    regCode: `CODE-${eventID}`,
    maxPlayers: 100,
    racfGroup: 'CTFPLAY',
    playerCount: 0,
    createdBy: 'ADMIN01',
    createdDate: t({ days: -60 }),
    updatedBy: 'ADMIN01',
    updatedDate: t({ days: -60 }),
    ...fields,
  })

  const events = [
    event(1, 'Spring Team CTF', {
      eventDescription: 'Teams of up to four. Mainframe, web and crypto challenges. Some challenges open only after others are solved.',
      startTS: t({ hours: -3 }), endTS: t({ days: 1 }),
      regCode: 'SPRING-TEAM-2026', regFromTS: t({ days: -7 }), regToTS: t({ hours: 20 }),
    }),
    event(2, 'Frozen Night CTF', {
      eventDescription: 'Individual. The scoreboard froze an hour ago: who wins is revealed at the closing ceremony.',
      playMode: 'I', maxTeamSize: 1,
      startTS: t({ hours: -6 }), endTS: t({ hours: 2 }), freezeTS: t({ hours: -1 }),
      regCode: 'FROZEN-NIGHT-2026', regFromTS: t({ days: -10 }), regToTS: t({ hours: -6 }),
    }),
    event(3, 'Summer Team CTF', {
      eventDescription: 'Starts in three days. Register now and form a team.',
      startTS: t({ days: 3 }), endTS: t({ days: 4 }),
      regCode: 'SUMMER-TEAM-2026', regFromTS: t({ days: -1 }), regToTS: t({ days: 3 }), maxPlayers: 8,
    }),
    event(4, 'Autumn Solo CTF', {
      eventDescription: 'Individual. Finished yesterday; the board stays readable.',
      playMode: 'I', maxTeamSize: 1,
      startTS: t({ days: -2 }), endTS: t({ days: -1 }),
      regCode: 'AUTUMN-SOLO-2026', regFromTS: t({ days: -9 }), regToTS: t({ days: -2 }),
    }),
    event(5, 'Winter CTF 2025', {
      eventDescription: 'Closed and offboarded. Thanks for playing!',
      eventStatus: 'C', playMode: 'I', maxTeamSize: 1,
      startTS: t({ days: -40 }), endTS: t({ days: -39 }),
      regCode: 'WINTER-2025', regFromTS: t({ days: -50 }), regToTS: t({ days: -40 }),
    }),
    event(6, 'Draft CTF', {
      eventStatus: 'D', startTS: t({ days: 30 }), endTS: t({ days: 31 }),
      regFromTS: t({ days: 20 }), regToTS: t({ days: 30 }),
    }),
    event(7, 'Spring CTF 2025', {
      eventDescription: 'Archived: only in the archive, but still readable.',
      eventStatus: 'A', playMode: 'I', maxTeamSize: 1,
      startTS: t({ days: -200 }), endTS: t({ days: -199 }),
      regCode: 'SPRING-2025', regFromTS: t({ days: -210 }), regToTS: t({ days: -200 }),
    }),
  ]

  const ec = (eventID, challengeID, sortOrder, fields = {}) => ({
    eventID, challengeID, sortOrder,
    scoreType: 'S', initPoints: 100, minPoints: 0, decaySolves: 0, isVisible: 'Y', maxAttempts: 0,
    ...fields,
  })
  const dynamic = { scoreType: 'D', initPoints: 500, minPoints: 100, decaySolves: 5 }
  const eventChallenges = [
    ec(1, 1, 1), ec(1, 2, 2, { initPoints: 200 }), ec(1, 3, 3, dynamic), ec(1, 4, 1, { initPoints: 150 }),
    ec(1, 5, 1, { maxAttempts: 3 }), ec(1, 6, 2, dynamic), ec(1, 8, 9, { initPoints: 1000 }),
    ec(1, 7, 1, { isVisible: 'N' }),
    ec(2, 1, 1), ec(2, 5, 1, dynamic), ec(2, 6, 2, { initPoints: 200 }), ec(2, 7, 1, { initPoints: 300 }),
    ec(3, 1, 1), ec(3, 2, 2), ec(3, 4, 1),
    ec(4, 1, 1), ec(4, 5, 1), ec(4, 7, 1, { initPoints: 300 }),
    ec(5, 1, 1), ec(5, 6, 1),
  ]
  const prereqs = [
    { eventID: 1, challengeID: 8, reqChallengeID: 3 },
    { eventID: 1, challengeID: 8, reqChallengeID: 2 },
  ]

  // Players: the dev users, then generated ones
  const players = []
  const player = (displayName, fields = {}) => {
    const playerID = players.length + 1
    const p = {
      playerID,
      racfUserid: `CTF${String(playerID).padStart(4, '0')}`,
      displayName,
      playerStatus: 'A',
      ...fields,
    }
    players.push(p)
    return p
  }
  const alice = player('Alice')
  const bob = player('Bob')
  const carol = player('Carol')
  const dave = player('Dave')
  const erin = player('Erin')
  const extra = ['Frank', 'Grace', 'Heidi', 'Ivan', 'Judy', 'Mallory', 'Niaj', 'Olivia', 'Peggy',
    'Rupert', 'Sybil', 'Trent', 'Uma', 'Victor', 'Walter', 'Xena', 'Yara', 'Zack', 'Ann', 'Ben',
    'Cleo', 'Dirk', 'Eve', 'Finn', 'Gus', 'Hank'].map((n) => player(n))
  // Fay: her CREATE job failed (status F); retrying it gives a new claim token
  const fay = player('Fay', { playerStatus: 'F' })

  const teams = []
  const participants = []
  const team = (eventID, teamName, members, joinCode) => {
    const teamID = teams.length + 1
    teams.push({
      teamID, eventID, teamName, joinCode: joinCode ?? `JOIN${String(teamID).padStart(8, '0')}`,
      captainID: members[0].playerID, memberCount: members.length,
    })
    for (const m of members) participants.push({ eventID, playerID: m.playerID, teamID, partStatus: 'A' })
    return teamID
  }
  const place = (eventID, p, partStatus = 'A') =>
    participants.push({ eventID, playerID: p.playerID, teamID: 0, partStatus })

  // Event 1: three teams and Carol without a team
  const rootAccess = team(1, 'Root Access', [alice, bob], 'ROOTACCESS01')
  const pirates = team(1, 'Packet Pirates', [extra[0], extra[1]])
  const nulls = team(1, 'Null Pointers', [extra[2]])
  place(1, carol)
  // Event 2: individual, Carol, Dave and the generated players: teams of one
  const solo2 = [carol, dave, ...extra].map((p) => [p, team(2, p.displayName, [p])])
  // Event 3: Carol without a team, Erin pending
  place(3, carol)
  place(3, erin, 'P')
  // Event 4: individual, ended
  const solo4 = [alice, dave, extra[3], extra[4]].map((p) => [p, team(4, p.displayName, [p])])
  // Event 5: closed
  const solo5 = [extra[5], extra[6]].map((p) => [p, team(5, p.displayName, [p])])

  for (const e of events) e.playerCount = participants.filter((x) => x.eventID === e.eventID).length

  // Submissions and solves; every solve has its correct submission
  const submissions = []
  const solves = []
  const attempt = (eventID, challengeID, teamID, p, text, isCorrect, offset) => {
    const submissionID = submissions.length + 1
    const createdDate = t(offset)
    submissions.push({ submissionID, eventID, challengeID, teamID, playerID: p.playerID, submittedText: text, isCorrect, createdDate })
    if (isCorrect === 'Y') solves.push({ eventID, challengeID, teamID, playerID: p.playerID, submissionID, createdDate })
  }
  attempt(1, 1, rootAccess, alice, 'flag{hello_zos}', 'Y', { hours: -2, minutes: -50 })
  attempt(1, 5, rootAccess, bob, 'flag{caesar}', 'N', { hours: -2, minutes: -30 })
  attempt(1, 5, rootAccess, bob, 'flag{rotate_me}', 'Y', { hours: -2, minutes: -20 })
  attempt(1, 3, rootAccess, alice, 'flag{SECADM}', 'Y', { hours: -1 })
  attempt(1, 1, pirates, extra[0], 'flag{hello_zos}', 'Y', { hours: -2, minutes: -40 })
  attempt(1, 3, pirates, extra[1], 'flag{SECADM}', 'Y', { minutes: -30 })
  attempt(1, 4, pirates, extra[0], 'flag{om_nom}', 'Y', { minutes: -20 })
  attempt(1, 1, nulls, extra[2], 'flag{hello_zos}', 'Y', { hours: -1, minutes: -10 })
  // Event 2: before and after the freeze (an hour ago)
  solo2.forEach(([p, teamID], i) => {
    attempt(2, 1, teamID, p, 'flag{hello_zos}', 'Y', { hours: -5, minutes: i })
    if (i % 2 === 0) attempt(2, 5, teamID, p, 'flag{rotate_me}', 'Y', { hours: -4, minutes: i })
    if (i % 3 === 0) attempt(2, 7, teamID, p, 'flag{CTF0042}', 'Y', { hours: -2, minutes: i })
  })
  attempt(2, 6, solo2[1][1], dave, 'flag{EBCDIC}', 'Y', { minutes: -20 }) // after the freeze
  attempt(2, 7, solo2[1][1], dave, 'flag{CTF0042}', 'Y', { minutes: -10 }) // after the freeze
  solo4.forEach(([p, teamID], i) => {
    attempt(4, 1, teamID, p, 'flag{hello_zos}', 'Y', { days: -2, hours: 1, minutes: i })
    if (i < 2) attempt(4, 7, teamID, p, 'flag{CTF0042}', 'Y', { days: -2, hours: 3, minutes: i })
  })
  solo5.forEach(([p, teamID], i) => attempt(5, 1, teamID, p, 'flag{hello_zos}', 'Y', { days: -40, hours: 2, minutes: i }))

  const hints = hintsOf()
  const hintUnlocks = [
    { eventID: 1, hintID: 1, teamID: rootAccess, playerID: bob.playerID, cost: 10, createdDate: t({ hours: -2 }) },
  ]
  const awards = [
    { awardID: 1, eventID: 1, teamID: rootAccess, points: 50, reason: 'Best write-up of the morning', createdDate: t({ hours: -1, minutes: -30 }) },
    { awardID: 2, eventID: 1, teamID: pirates, points: -25, reason: 'Scanning the scoreboard host', createdDate: t({ minutes: -45 }) },
  ]
  const announcements = [
    { announceID: 1, eventID: 1, announceTitle: 'Welcome!', announceBody: 'Good luck, have fun. The z/OS challenges use the TSO userid you signed in with.', createdDate: t({ hours: -3 }) },
    { announceID: 2, eventID: 1, announceTitle: 'Hint prices', announceBody: 'Hints cost points, also when nobody in your team reads them. Think before you click.', createdDate: t({ hours: -2 }) },
    { announceID: 3, eventID: 1, announceTitle: 'New challenge soon', announceBody: 'A forensics challenge opens at noon.', createdDate: t({ minutes: -15 }) },
    { announceID: 4, eventID: 2, announceTitle: 'Scoreboard frozen', announceBody: 'The scoreboard is frozen. Keep solving: it all still counts.', createdDate: t({ hours: -1 }) },
  ]

  return {
    refTables: refTables(t),
    // TBCTF0xx provisioning jobs: closing an event queues REMOVE (M) and REVOKE (V)
    provJobs: provJobsOf(t, fay, extra),
    events,
    library: library(),
    flags: flagsOf(),
    hints,
    links: linksOf(),
    eventChallenges,
    prereqs,
    players,
    teams,
    participants,
    submissions,
    solves,
    hintUnlocks,
    awards,
    announcements,
    admins: ['ADMIN01'],
  }
}
