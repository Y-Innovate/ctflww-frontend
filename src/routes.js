// The app's routes (PLAN.md, "Routes and LWW folders"). IDs go in the query
// string: LWW serves index.html from a folder per route, so paths are fixed.

export const PATHS = {
  events: '/',
  leaderboard: '/leaderboard',
  register: '/register',
  login: '/login',
  my: '/my',
  board: '/board',
  challenge: '/challenge',
  team: '/team',
  announcements: '/announcements',
}

// Router paths are relative to the basename /ctf
export function linkTo(path, params = {}) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.append(k, String(v))
  const s = qs.toString()
  return s ? `${path}?${s}` : path
}

// The pages of one event a player plays in, in the event bar
export const EVENT_PAGES = [
  { path: PATHS.board, title: 'Challenges', icon: 'ti-flag' },
  { path: PATHS.team, title: 'Team', icon: 'ti-users' },
  { path: PATHS.announcements, title: 'Announcements', icon: 'ti-speakerphone' },
]

// The organizers' pages (PLAN-ADMIN.md); each is a folder under /ctf/admin
export const ADMIN_PATHS = {
  events: '/admin',
  event: '/admin/event',
  library: '/admin/library',
  challenge: '/admin/challenge',
  settings: '/admin/settings',
  players: '/admin/players',
  player: '/admin/player',
  jobs: '/admin/jobs',
}

// The admin navigation; `also` are pages that belong to an entry
export const ADMIN_NAV = [
  { path: ADMIN_PATHS.events, title: 'Events', icon: 'ti-calendar-event', also: [ADMIN_PATHS.event] },
  { path: ADMIN_PATHS.library, title: 'Library', icon: 'ti-books', also: [ADMIN_PATHS.challenge] },
  { path: ADMIN_PATHS.players, title: 'Players', icon: 'ti-user-search', also: [ADMIN_PATHS.player] },
  { path: ADMIN_PATHS.jobs, title: 'Jobs', icon: 'ti-list-check', also: [] },
  { path: ADMIN_PATHS.settings, title: 'Settings', icon: 'ti-settings', also: [] },
]
