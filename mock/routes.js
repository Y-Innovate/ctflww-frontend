// The API routes of the mock backend, shared by the Vite mocks
// (api.mock.js) and the page tests (src/test/backend.js).
// Each route: [method, path pattern under /ctf/API/v1, access, handler].
// access: false (public), true (a session), or ADMIN (an organizer, as the
// admin wrappers check with CTFADMP: others get 08 50).
// handler(db, { user, id, query, body }) returns { status, body }.

export const ADMIN = 'admin'

export const ROUTES = [
  ['GET', '/me', true, (db, r) => db.me(r.user)],

  // Public
  ['GET', '/events/:id', false, (db, r) => db.getEvent(r.id)],
  ['GET', '/events', false, (db, r) => db.listEvents(r.query)],
  ['GET', '/leaderboard/:id', false, (db, r) => db.leaderboard(r.id, r.query)],
  ['GET', '/registrations/:id', false, (db, r) => db.registrationStatus(r.id)],
  ['POST', '/registrations', false, (db, r) => db.register(r.body)],
  ['POST', '/activations/:id', false, (db, r) => db.activate(r.id, r.body)],

  // Player
  ['PUT', '/myPassphrase', true, (db, r) => db.changePassphrase(r.user, r.body)],
  ['GET', '/myEvents', true, (db, r) => db.myEvents(r.user, r.query)],
  ['POST', '/participants', true, (db, r) => db.join(r.user, r.body)],
  ['GET', '/challenges/:id', true, (db, r) => db.challenge(r.user, r.id, r.query)],
  ['GET', '/challenges', true, (db, r) => db.board(r.user, r.query)],
  ['GET', '/challengeLinks', true, (db, r) => db.challengeLinks(r.user, r.query)],
  ['GET', '/prerequisites', true, (db, r) => db.prerequisites(r.user, r.query)],
  ['GET', '/hints', true, (db, r) => db.hints(r.user, r.query)],
  ['POST', '/hintUnlocks', true, (db, r) => db.unlockHint(r.user, r.body)],
  ['POST', '/submissions', true, (db, r) => db.submit(r.user, r.body)],
  ['GET', '/progress/:id', true, (db, r) => db.progress(r.user, r.id)],
  ['GET', '/progressSolves', true, (db, r) => db.progressSolves(r.user, r.query)],
  ['GET', '/progressAwards', true, (db, r) => db.progressAwards(r.user, r.query)],
  ['GET', '/announcements', true, (db, r) => db.announcements(r.user, r.query)],
  ['POST', '/teams', true, (db, r) => db.createTeam(r.user, r.body)],
  ['DELETE', '/teamMembers/:id', true, (db, r) => db.removeMember(r.user, r.id, r.query)],
  ['GET', '/teamMembers', true, (db, r) => db.teamMembers(r.user, r.query)],
  ['POST', '/teamMembers', true, (db, r) => db.joinTeam(r.user, r.body)],
  ['PUT', '/teamCaptains/:id', true, (db, r) => db.handOver(r.user, r.id, r.body)],

  // Admin (PLAN-ADMIN.md)
  ['POST', '/admin/eventClosures/:id', ADMIN, (db, r) => db.closeEvent(r.user, r.id)],
  ['GET', '/admin/events/:id', ADMIN, (db, r) => db.adminEvent(r.id)],
  ['GET', '/admin/events', ADMIN, (db, r) => db.adminEvents(r.query)],
  ['POST', '/admin/events', ADMIN, (db, r) => db.createEvent(r.user, r.body)],
  ['PUT', '/admin/events/:id', ADMIN, (db, r) => db.updateEvent(r.user, r.id, r.body)],
  ['DELETE', '/admin/events/:id', ADMIN, (db, r) => db.deleteEvent(r.id)],
  ['GET', '/admin/challenges/:id', ADMIN, (db, r) => db.adminChallenge(r.id)],
  ['GET', '/admin/challenges', ADMIN, (db, r) => db.adminChallenges(r.query)],
  ['POST', '/admin/challenges', ADMIN, (db, r) => db.createChallenge(r.user, r.body)],
  ['PUT', '/admin/challenges/:id', ADMIN, (db, r) => db.updateChallenge(r.user, r.id, r.body)],
  ['DELETE', '/admin/challenges/:id', ADMIN, (db, r) => db.deleteChallenge(r.id)],
  ['GET', '/admin/flags', ADMIN, (db, r) => db.adminFlags(r.query)],
  ['POST', '/admin/flags', ADMIN, (db, r) => db.createFlag(r.user, r.body)],
  ['PUT', '/admin/flags/:id', ADMIN, (db, r) => db.updateFlag(r.user, r.id, r.body)],
  ['DELETE', '/admin/flags/:id', ADMIN, (db, r) => db.deleteFlag(r.id)],
  ['GET', '/admin/hints', ADMIN, (db, r) => db.adminHints(r.query)],
  ['POST', '/admin/hints', ADMIN, (db, r) => db.createHint(r.user, r.body)],
  ['PUT', '/admin/hints/:id', ADMIN, (db, r) => db.updateHint(r.user, r.id, r.body)],
  ['DELETE', '/admin/hints/:id', ADMIN, (db, r) => db.deleteHint(r.id)],
  ['GET', '/admin/links', ADMIN, (db, r) => db.adminLinks(r.query)],
  ['POST', '/admin/links', ADMIN, (db, r) => db.createLink(r.user, r.body)],
  ['PUT', '/admin/links/:id', ADMIN, (db, r) => db.updateLink(r.user, r.id, r.body)],
  ['DELETE', '/admin/links/:id', ADMIN, (db, r) => db.deleteLink(r.id)],
  ['GET', '/admin/eventChallenges', ADMIN, (db, r) => db.adminEventChallenges(r.query)],
  ['POST', '/admin/eventChallenges', ADMIN, (db, r) => db.createEventChallenge(r.user, r.body)],
  ['PUT', '/admin/eventChallenges/:id', ADMIN, (db, r) => db.updateEventChallenge(r.user, r.id, r.query.eventID, r.body)],
  ['DELETE', '/admin/eventChallenges/:id', ADMIN, (db, r) => db.deleteEventChallenge(r.id, r.query.eventID)],
  ['GET', '/admin/prerequisites', ADMIN, (db, r) => db.adminPrerequisites(r.query)],
  ['POST', '/admin/prerequisites', ADMIN, (db, r) => db.createPrerequisite(r.user, r.body)],
  ['DELETE', '/admin/prerequisites/:id', ADMIN, (db, r) => db.deletePrerequisite(r.id, r.query)],
  ['GET', '/admin/leaderboard/:id', ADMIN, (db, r) => db.adminLeaderboard(r.id, r.query)],
  ['GET', '/admin/teams', ADMIN, (db, r) => db.adminTeams(r.query)],
  ['GET', '/admin/submissions', ADMIN, (db, r) => db.adminSubmissions(r.query)],
  ['GET', '/admin/solves', ADMIN, (db, r) => db.adminSolves(r.query)],
  ['POST', '/admin/solveReversals', ADMIN, (db, r) => db.reverseSolve(r.user, r.body)],
  ['GET', '/admin/awards', ADMIN, (db, r) => db.adminAwards(r.query)],
  ['POST', '/admin/awards', ADMIN, (db, r) => db.createAward(r.user, r.body)],
  ['DELETE', '/admin/awards/:id', ADMIN, (db, r) => db.deleteAward(r.id)],
  ['GET', '/admin/announcements', ADMIN, (db, r) => db.adminAnnouncements(r.query)],
  ['POST', '/admin/announcements', ADMIN, (db, r) => db.createAnnouncement(r.user, r.body)],
  ['PUT', '/admin/announcements/:id', ADMIN, (db, r) => db.updateAnnouncement(r.user, r.id, r.body)],
  ['DELETE', '/admin/announcements/:id', ADMIN, (db, r) => db.deleteAnnouncement(r.id)],
  ['GET', '/admin/players/:id', ADMIN, (db, r) => db.adminPlayer(r.id)],
  ['GET', '/admin/players', ADMIN, (db, r) => db.adminPlayers(r.query)],
  ['DELETE', '/admin/players/:id', ADMIN, (db, r) => db.deletePlayer(r.user, r.id)],
  ['POST', '/admin/playerResets/:id', ADMIN, (db, r) => db.resetPlayer(r.user, r.id)],
  ['POST', '/admin/playerRevocations/:id', ADMIN, (db, r) => db.revokePlayer(r.user, r.id)],
  ['POST', '/admin/playerResumptions/:id', ADMIN, (db, r) => db.resumePlayer(r.user, r.id)],
  ['GET', '/admin/provisioningJobs', ADMIN, (db, r) => db.adminJobs(r.query)],
  ['POST', '/admin/jobRetries/:id', ADMIN, (db, r) => db.retryJob(r.user, r.id)],
  ['GET', '/admin/refTables', ADMIN, (db, r) => db.adminRefTables(r.query)],
  ['POST', '/admin/refTables', ADMIN, (db, r) => db.createRefTable(r.user, r.body)],
  ['PUT', '/admin/refTables/:id', ADMIN, (db, r) => db.updateRefTable(r.user, r.id, r.query.tabKey, r.body)],
  ['DELETE', '/admin/refTables/:id', ADMIN, (db, r) => db.deleteRefTable(r.id, r.query.tabKey)],
]

// Without a session LWW answers 404 on a non-public path, as seen on t01 for
// GET /me (2026-11-11), without the backend's envelope
export const NO_SESSION = { status: 404, body: '' }
const NOT_ADMIN = {
  status: 403, body: { retCode: '08', reasonCode: '50', infoMessage: 'You are not an organizer' },
}
const UNKNOWN = { status: 404, body: { retCode: '08', reasonCode: '99', infoMessage: 'Unknown path' } }

// Answers one call; path is relative to /ctf/API/v1
export function dispatch(db, { method, path, user, query = {}, body = {} }) {
  for (const [m, pattern, access, handler] of ROUTES) {
    if (m !== method) continue
    const re = new RegExp(`^${pattern.replace(':id', '([^/]+)')}$`)
    const match = re.exec(path)
    if (!match) continue
    if (access && !user) return NO_SESSION
    if (access === ADMIN && !db.isAdmin(user)) return NOT_ADMIN
    return handler(db, { user, id: match[1] && decodeURIComponent(match[1]), query, body: body ?? {} })
  }
  return UNKNOWN
}
