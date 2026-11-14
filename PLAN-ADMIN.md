# PLAN-ADMIN.md: admin screens build plan

The organizers' screens (SPEC.md, "Admin screens"), after the public and player
screens of PLAN.md (F1 to F3). Same way of working: step by step, tests against
the mock, a build into `ctflww/LWWAdmin/` and a t01 checklist per iteration.

## Decisions

Agreed 2026-11-11:
- **Order:** F4 setting up an event (A1 to A3 and the reference tables), F5
  running it (A4, A7 to A9), F6 players and RACF jobs (A5, A6). After F4 an
  event can be prepared without SQL or scripts; F5 is tested on events made
  with F4.
- **Sign-in:** the admin folders get the same login redirect as the player
  folders (`redirect_to_login.html`, CT000003). An organizer without a session
  lands on `/ctf/login` and uses "Organizer sign-in"; that round trip already
  returns to the requested page.
- **Same app, own chunk:** one `index.html` and one router; the admin pages are
  loaded with `React.lazy`, so players never download them. They share the API
  client, hooks, components and the mock.
- **Access:** an `AdminRoute`, like `PlayerRoute`: no session goes to sign-in,
  a player gets "This page is for organizers". This is for the user only; the
  backend's admin check (`CTFADMP`, `08 50`) is what protects the data.

## Routes and LWW folders

| Route | Screen | Iteration |
|---|---|---|
| `/ctf/admin` | Events, drafts included; "New event" | F4 |
| `/ctf/admin/event?eventID=&tab=` | Event tabs; without `eventID` a new draft | F4, F5 |
| `/ctf/admin/library` | Challenge library | F4 |
| `/ctf/admin/challenge?challengeID=` | Challenge with flags, hints, links; without ID a new one | F4 |
| `/ctf/admin/settings` | Reference tables | F4 |
| `/ctf/admin/players`, `/ctf/admin/player?playerID=` | Players | F6 |
| `/ctf/admin/jobs` | Provisioning jobs | F6 |

- Tabs are in the query string (`tab=settings`, `challenges`, `monitor`,
  `teams`, `announcements`), so they need no folders of their own.
- `public/admin/` holds a folder per route, with the same `.name` contents as
  the player folders: `defaultWebpageId` CT000001, `loginRedirectWebpageId`
  CT000003, `defaultTran` CTFP. The API paths stay under `/ctf/API/v1/admin`
  with CTFA; the page folders only serve `index.html`.
- Check on t01: nested route folders (`/ctf/admin/event`), and that the build's
  clean step and `uploadLWW.py` handle them.

## Iteration F4: setting up an event
- [x] 15. Foundation: `AdminRoute`, admin layout and navigation, the lazy
  chunk, an "Admin" link in the top bar for organizers, the folders in
  `public/admin/`, `src/api/admin.js` and the admin lists, and the mock's
  admin side (a module next to `mock/db.js`, sharing its data, mirroring the
  COBOL rules and reason codes).
- [x] 16. Settings: the reference tables (categories, RACF groups, settings).
- [x] 17. Events: the list, a new draft, the settings form with its checks,
  publish and back to draft, delete a draft (CTFM002 deletes it with its
  challenges, prerequisites and announcements); play mode and RACF group
  read-only once someone has joined.
- [x] 18. Library: the list with the category filter, a challenge with its
  flags, hints and links; delete; the warning while a running event uses it.
  The backend can't list the events of a challenge, so the UI checks the
  `eventChallenges` of the running events (there are only a few).
- [x] 19. Event challenges: add from the library, scoring, attempts, order,
  visibility, prerequisites, remove or hide.
- t01 checkpoint: prepare an event from scratch in the UI, publish it, play it
  as a player. Checklist: `docs/test-F4.md`.

## Iteration F5: running an event
- [x] 20. Monitor: the live leaderboard (`GET /admin/leaderboard`, which ignores
  the freeze), submissions and solves with filters and paging, reversing a
  solve with a reason.
- [x] 21. Teams: teams (size, captain, live score; no member list in the admin
  API), awards and penalties (give, delete).
- [x] 22. Announcements: write, correct, delete; also on a draft.
- [x] 23. Close and offboard, with confirmation; what's refused after closing
  (`08 53`).

Checklist for t01: `docs/test-F5.md`.

## Iteration F6: players and RACF jobs
- [x] 24. Players: find, details, reset passphrase (claim token shown once),
  revoke, resume, delete the userid of a revoked player.
- [x] 25. Provisioning jobs: list with filters, retry a failed one (a CREATE or
  RESET shows a new claim token once).

## Rules for the admin screens
- Flags, registration codes and claim tokens are shown to organizers but never
  stored in the browser or logged. Claim tokens are shown once.
- Everything that can't be undone asks first (`ConfirmButton`).
- Forms check what the backend checks (lengths, start < freeze < end,
  initial >= minimum >= 0) for quick feedback; the backend's reason code still
  decides, and its `infoMessage` is shown.
- Lists use the backend's paging (20 rows, `*_since`); filters go in the query
  string, so a filtered view can be bookmarked.

Checklist for t01 of F6: `docs/test-F6.md`.
