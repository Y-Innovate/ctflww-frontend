# PLAN.md: CTF web UI build plan

## Decisions

Agreed 2026-11-10:
- **Own repo** `ctflww-frontend`. The build output is
  committed in the backend repo, under `ctflww/LWWAdmin/`.
- **Hosting:** LWW serves the built app under `/ctf/`; no BFF, no OpenShift.
  Runs locally with `npm run dev` against mocks.
- **Sign-in:** LWW sessions. Players use an LWW login form (RACF userid and
  passphrase), admins LWW's Entra redirect. The browser only has LWW's cookie.
- **Order:** public and player screens first (iterations F1 to F3), admin
  screens after that, in a plan of their own: PLAN-ADMIN.md (F4 to F6).
- **Tooling:** React + React Router, Vite, Tailwind,
  vite-plugin-mock-dev-server, ESLint, Vitest + Testing Library, Tabler icons via
  CDN. Without Express, msal-node, Redis, Docker and k8s.

Agreed 2026-11-10, after the first draft:
- **Routes without IDs in the path.** LWW has no SPA fallback. Deep links work
  with a folder per route whose default page is index.html; that only works
  for fixed paths. So IDs go in the query string:
  `/ctf/board?eventID=3`, `/ctf/challenge?eventID=3&challengeID=7`. A folder per
  route also lets LWW require a session on the player routes only.
- **Login page in React.** `/ctf/login` renders a plain HTML form that posts to
  `process_login.html` (pre-exec `LWWADPLI`), so it looks like the rest of the
  app, and the mocks can imitate it in dev. The LWW-side pages
  (`redirect_to_login.html`, `process_login.html`, `redirect_to_sso_login.html`,
  `auth`) are plain HTML files in `public/`.
- **Organizer sign-in** is a button on the login page that starts LWW's Entra
  redirect.
- **Sign-out** is done by LWW: deleting the cookie in the browser isn't enough,
  because the session stays valid on LWW. Since 2026-11-14 LWW can end a
  session: the pre-exec program `LWWADPLO` on the page `logout.html`. The top
  bar's "Sign out" button goes there (`SIGN_OUT_URL` in `src/api/auth.js`);
  the page says the user is signed out and links back to `/ctf/login`.
- **No rate limit for registration codes.** LWW can't limit per client address.
  Codes must be long enough not to be guessed; passphrase guessing is covered
  by RACF revoking a userid after too many wrong attempts.

## Routes and LWW folders

| Route | Screen | Session | LWW folder login redirect |
|---|---|---|---|
| `/ctf/` | Events, event detail (`?eventID=`) | None | No |
| `/ctf/leaderboard?eventID=` | Leaderboard | None | No |
| `/ctf/register?eventID=` or `?registrationID=` | Register, wait, activate | None | No |
| `/ctf/login` | Sign-in form, organizer button | None | No |
| `/ctf/my` | My events, join, account | Player | Yes |
| `/ctf/board?eventID=` | Challenge board | Player | Yes |
| `/ctf/challenge?eventID=&challengeID=` | Challenge, hints, submit | Player | Yes |
| `/ctf/team?eventID=` | Team and own progress | Player | Yes |
| `/ctf/announcements?eventID=` | Announcements | Player | Yes |

Each route except `/ctf/` is a folder in `LWWAdmin/` with a `.name` file:
`defaultWebpageId` = index.html's fixed ID, and for player routes
`loginRedirectWebpageId` = `redirect_to_login.html`. These names must not clash
with `API`, `assets` or the LWW pages.

## Iteration F1: foundation
- [x] 1. Scaffold: git init, Vite/React, Tailwind, ESLint, Vitest, base
  `/ctf/`, `openapi/ctf.yaml` (backend spec without processing steps).
- [x] 2. Build into `../ctflww/LWWAdmin/` without wiping it (the API
  placeholders and `.name` files live there): `emptyOutDir: false`, plus a
  script that first removes the previous `index.html` and `assets/`.
- [x] 3. API client (`ApiError`, string trimming, `null` as `""`,
  401 to the login redirect), `usePagedList` for `*_since` paging,
  `src/lib/codes.js` and timestamp formatting (+ unit tests).
- [x] 4. Mocks: seed data with events in every phase (one frozen, one closed, one
  individual, one team event), players and teams, and handlers for all public
  and player operations with the backend's reason codes. A mock session: the
  login form post sets a cookie, `GET /me` reads it; dev users for a player
  with and without a team, a captain, and an admin.
- [x] 5. Shell: layout, top bar with the user from `GET /me` and a sign-in
  link (sign-out added 2026-11-14), the event navigation (board, team, announcements)
  with the unread badge, dark mode.
- [x] 6. Sign-in: the `/ctf/login` page; the LWW pages in `LWWAdmin/` with fixed
  file IDs; the folder `.name` files; return to the requested page.

## Iteration F2: public screens
- [x] 7. Events list and event detail (V1).
- [x] 8. Leaderboard with paging, frozen banner and refresh (V2).
- [x] 9. Registration in three steps: register, wait with polling and the claim
  token shown once, choose passphrase and show the userid (R1 to R3).

## Iteration F3: player screens
- [x] 10. My events, join another event (P2), change passphrase (P3).
- [x] 11. Challenge board (P4).
- [x] 12. Challenge: description, links, prerequisites, hints with unlock
  confirmation, flag submission with all outcomes (P5 to P7).
- [x] 13. Team: create or join, members, captain actions, leave (T1 to T4), and
  own progress (P8).
- [x] 14. Announcements with polling and unread marks (P9).

## Deploying to t01 (after each iteration)
1. `npm run build` here; it writes into `ctflww/LWWAdmin/`.
2. In ctflww: `python python/uploadLWW.py`.
3. Walk through the iteration's screens in a browser against t01, with a test
   player of event 1 and the admin. A checklist per iteration goes in
   `docs/test-Fn.md`.

## Changes in the backend repo
- `LWWAdmin/`: the build output, the LWW pages and the route folders.
- `.gitattributes`: `/LWWAdmin/** zos-working-tree-encoding=UTF-8`, in case
  the repo is uploaded from a z/OS checkout (done in step 2).
- `docs/01-actors.md`, `02-use-cases.md`, `04-api.md`: the BFF is gone. LWW holds
  the session (P1, R3, "How identity reaches the backend", the logging rule),
  and the rate limits that R1 and P1 gave to the BFF are replaced by long codes
  and RACF's revoke count.
- Proposal: a minimum length for the registration code in `CTFM002` (`08 0x`),
  for example 12 characters, so "long enough" is enforced, not just advised.

## LWW files of the app (step 6)
The LWW pages and `.name` files the app needs are in `public/`, so they are
versioned with the app; Vite copies them into `LWWAdmin/` on build, and the
mocks serve them in dev with `&NEXTPAGE;` filled in. The API placeholders stay
in the backend repo.

| File | ID | Pre-exec | What it does |
|---|---|---|---|
| `index.html` (built) | CT000001 | | The app; default page of `/ctf` and every route folder |
| `process_login.html` | CT000002 | LWWADPLI | Target of the login form; to the requested page, or `/ctf/my` |
| `redirect_to_login.html` | CT000003 | LWWADPLR | Login redirect of the player folders, to `/ctf/login?requestedURL=` |
| `redirect_to_sso_login.html` | CT000004 | LWWADPL1 | Organizer sign-in: to Entra |
| `auth` | CT000005 | LWWADPL2 | Entra's redirect URI; to the requested page, or `/ctf/` |
| `logout.html` | CT000006 | LWWADPLO | Sign-out: ends the session, says so, links to `/ctf/login` |

The requested page travels in sessionStorage (`requestedURL`, only a path
under `/ctf/`). `uploadLWW.py` sets CT000001 as the default page
of `/ctf` after the upload (the folder is created by the script, not by a
`.name` file). There is no `changePassword.html`: player passphrases don't
expire (`NOINTERVAL`), and a reset goes through R3.

Found on t01 (2026-11-10):
- Transactions: LWW runs only the four sign-in pages under its own `LWBL`.
  `index.html`, `assets/` and the route folders use `CTFP`, the public
  transaction, which the CICS default userid may run (the folder `/ctf`
  itself defaults to CTFU, which it may not).
- A wrong passphrase gets LWW's own page ("the combination of userid and
  password is wrong"); the user goes back to the sign-in page. The requested
  page stays in sessionStorage until a sign-in succeeds, so it survives that.
  The `failed` branch of `process_login.html` stays as a fallback.
- LWWADPLR's login redirect is for non-public pages: a fresh load of a player
  route without a session. Public pages never need it: their "Sign in" link
  and `PlayerRoute` send the user to `/ctf/login?returnTo=` themselves.
- Organizers reach Entra with the "Organizer sign-in" button of `/ctf/login`.

Found on t01 (2026-11-11):
- The login redirect of the player folders works, and LWWADPLR's
  `?requestedURL=` brings the user back to the requested page.
- `redirect_to_sso_login.html` only LINKs `LWWADPLS` (with `LWWADPLR` in front
  the Entra redirect didn't work). Organizer sign-in works with the app
  registered in Entra.
- LWW refuses paths that end in `/`. Full page loads go to `/ctf`, not
  `/ctf/`; a requested URL ending in `/` is trimmed (`safeReturn`, and the
  scripts of `process_login.html` and `auth`). React Router's links to the
  root are `/ctf` already. Only `<base href="/ctf/">` keeps its slash.
- `uploadLWW.py` has `CTF_PUBLIC_TRAN` (CTFP) for the `/ctf` folder.
- Register, choose a passphrase, change it, sign in: work on t01.
- Without a session LWW answers `GET /me` with 404, without the backend's
  envelope. The client counts a 401, or a 404 without `retCode`, as "no
  session" (`ApiError.isNoSession`). On such a 404 from another call it asks
  `/me` first, so a missing placeholder isn't mistaken for an expired session.
  The mock answers the same way.

## Can't be tested from here
- LWW's login pages, the session cookie and the Entra redirect for the `/ctf`
  folder: only on t01.
- Whether LWW serves a folder's default page with a query string
  (`/ctf/board?eventID=3`), and whether the public folders and API paths work
  without a session while others have a login redirect.
- What a CTFU API call answers without a session: answered on t01, see below.
