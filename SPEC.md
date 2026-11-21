# SPEC.md: CTF web UI

What the UI does, per screen. The use cases behind it (V, R, P, T, A) are in
`ctflww/docs/02-use-cases.md`; the API in `ctflww/docs/04-api.md`. This spec
covers visitors, registrants and players, and (in "Admin screens") the
organizers. The build order is in PLAN.md (F1 to F3) and PLAN-ADMIN.md (F4 to F6).

## Audiences and sign-in

| Who | Session | Sees |
|---|---|---|
| Visitor | None | Events, leaderboards, registration |
| Player | LWW session from the login page (RACF userid + passphrase) | Also: own events, challenges, team, progress, announcements |
| Admin | LWW session from the Entra redirect | Admin screens; the public screens too |

- `GET /me` says who is signed in: `role` P for a player, A for an admin
  (who has no player record, so `playerID` 0), or nobody (401). The top bar shows the display name or the
  userid, and a sign-in link, or a "Sign out" button when signed in. Sign-out
  goes to LWW's page `logout.html`, which ends the session and says so, with
  a link back to the sign-in page.
- Signing in starts from a "Sign in" link: the player form, with a separate
  "Organizer sign-in" button for the Entra redirect. After sign-in, the user
  returns to the page they came from.
- A player page opened without a session goes to the sign-in page (LWW's login
  redirect), and back afterwards.

## Screens

### Events (V1), public, start page
- Published and closed events, newest first, 20 at a time with "more".
  An "Archive" toggle (`?archive=1`) lists the archived events instead (A10).
- Per event: name, dates, phase (Upcoming, Running, Frozen, Ended, Closed,
  Archived), play mode (individual or teams) and whether registration is open.
- Opening one shows the description too, with links to the leaderboard, and to
  register (if registration is open) or, for a signed-in player, to join.

### Leaderboard (V2), public
- Rank, team or player name, score and solves, 20 rows at a time.
- During a freeze a banner says the board is frozen since the freeze time.
- Refreshes itself every 30 seconds while the event is running or frozen.

### Register (R1 to R3), public
One page with three steps; the registration ID is in the URL, so a reload or a
second visit continues at step 2.
1. **Register:** event (from the event page), registration code and display
   name. Errors: wrong code or closed (one message), event full, name taken.
2. **Wait:** the claim token is shown once, large, with a copy button and the
   warning that it is needed in step 3 and can't be shown again. The page polls
   `GET /registrations/{id}` every 5 seconds until READY or FAILED. FAILED: contact
   an organizer.
3. **Choose passphrase:** claim token (prefilled if still in memory; typed in
   after a reload), passphrase twice, with the RACF rules in a short hint. RACF's
   refusal is shown and the step can be retried. On success: the userid, large,
   with "sign in with this userid" and a link to sign in.
- The claim token and passphrase stay in React state only.

### My events (P2, P8), player, start page after sign-in
- The events the player joined, with phase, team (or "no team yet" in a team
  event) and "pending" for a place waiting for its RACF job.
- Join another event: pick an event with open registration, enter its code.
- Account: change passphrase (P3): current, new twice; RACF's refusal shown.

### Challenge board (P4), player, per event
- Visible challenges grouped by category, in the admin's order: title, current
  value, solves, and a mark for solved and for locked.
- During a freeze a banner explains that values and solve counts stop at the
  freeze time, but own solves still show.
- Before the start: "the event starts at ..."; without a team in a team event:
  a link to the team page.

### Challenge (P5 to P7), player
- Description, links (open in a new tab), current value, solves, attempts left.
- Locked: the required challenges, each marked solved or not, with a link.
- Hints: cost and order; unlocked ones show their text. Unlocking asks for
  confirmation with the cost ("this deducts N points from your team").
- Submit a flag: one field and a button. Outcomes: correct (points), wrong
  (attempts left), already solved by the team, attempts used up, event not
  running. Disabled once solved or after the end.

### Team (T1 to T4, P8), player, per event
- Without a team (team event): create one (name) or join one (join code).
- With a team: name, members (captain marked), score, solves, hints used.
- Captain: the join code with a copy button, remove a member (before the
  start), hand over captaincy.
- Leave the team (before the start); a captain with members must hand over first.
- Own progress: solves (who, when, value) and awards and penalties with their
  reasons.

### Announcements (P9), player, per event
- Newest first. A badge in the event's navigation counts the unread ones; the
  IDs seen are remembered in localStorage per event (nothing secret).
- Polled every 60 seconds while an event page is open.

## Admin screens

For organizers (`role` A) only; the API refuses others with `08 50`, and the UI
shows a player who opens one "This page is for organizers". Everything under
`/ctf/admin`, with an admin navigation: Events, Library, Settings, and from F6
Players and Jobs. Admin and challenge author are one role in v1.

### Admin events (A1), `/ctf/admin`
- All events, drafts included, newest first: name, status, phase, dates,
  players / cap. A "New event" button. Status filter: Current (all but
  archived), Drafts, Published, Closed, Archived.

### Event (A1, A3; A4, A7 to A9 in F5), `/ctf/admin/event?eventID=&tab=`
- Without `eventID`: the form for a new DRAFT.
- Tabs: **Settings**, **Challenges**; from F5 **Monitor**, **Teams**,
  **Announcements**.
- Settings: name, description, play mode and team size, start, freeze, end,
  registration code and window, cap, RACF group (from the allowlist). Play
  mode and RACF group are read-only once someone has joined. Publish (refused
  without a visible challenge), delete (a draft only, with its challenges, prerequisites and announcements), and in F5 Close. A closed event can be
  archived, and an archived one restored to closed (A10); both are read-only.
  Start < freeze < end is checked in the form too.
- Challenges: the event's challenges in order with scoring, attempts,
  visibility and prerequisites (the admin list has no solve counts; the
  monitor of F5 shows solves); add one from the library; edit scoring (fixed, or
  dynamic with initial, minimum, decay), attempt limit, order and visibility;
  prerequisites per challenge; take out (only without submissions or hint
  unlocks; otherwise hide).

### Library (A2), `/ctf/admin/library` and `/ctf/admin/challenge?challengeID=`
- The library: title, category, last change; filter by category; "New
  challenge". (The list API has no flag or hint counts.)
- A challenge: title, category, description; its flags (value, case
  sensitive), hints (order, cost, text) and links (name, URL). Delete is
  refused while an event uses the challenge.
- A warning above the form while a running event uses the challenge: changes
  apply there at once.

### Settings (A1, A2), `/ctf/admin/settings`
- The reference tables: categories, allowed RACF groups, settings. Add, edit,
  delete entries.

### Live event (A4, A7, A8, A9), tabs of the event, F5
- Monitor: the live leaderboard (no freeze), submissions newest first with
  filters (correct or not, team, challenge), solves with "Reverse" (a reason
  is required).
- Teams: teams by live rank with size, captain, net awards and score (the
  admin API has no member list per team); give an award or penalty (points
  not 0, reason required); delete one.
- Announcements: newest first; write, correct, delete. Allowed on a draft.
- Close (Settings tab, after the end): confirmation, then the offboarding is
  queued; changes after closing are refused.

### Players and jobs (A5, A6), F6
- `/ctf/admin/players`: find by display name or userid; status and events.
- `/ctf/admin/player?playerID=`: details; reset the passphrase (the new claim
  token is shown once, as in R2), revoke, resume, delete the userid of a
  revoked player.
- `/ctf/admin/jobs`: provisioning jobs by status, event or player: action, JES
  job ID, return code, message; retry a failed one (a CREATE or RESET shows a
  new claim token once).

## General rules
- The backend decides; the UI never relies on hiding a button for security.
- Error messages: the HTTP status in words plus the backend's `infoMessage`.
  Reason codes with a specific UI reaction (`08 54` already
  solved, `08 55` attempts used up, `08 51` registration refused, `08 52` full)
  get their own text.
- Timestamps come as `2026-01-01-00.00.00.000000` in the mainframe's local time
  and are shown as date and time without seconds; no time-zone conversion.
- `Y`/`N` and the one-letter codes are shown in words.
- Admin screens ask before anything that can't be undone (delete, reverse,
  revoke, close), in the page, as the player screens do.
- Claim tokens are shown once and never stored; flags and registration codes
  are shown to organizers only and never logged.
- English only in v1. Works on a phone: players often have the challenge open on
  one screen and their tools on another.
