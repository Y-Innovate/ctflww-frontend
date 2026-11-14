# Test F4 on t01: setting up an event

After `npm run build` here and `python python/uploadLWW.py` in ctflww.
You need: the organizer sign-in, and a test player in a second browser profile
or a private window. The whole walk-through prepares a fresh event in the UI
only, without SQL or scripts.

## Access (step 15)
- [x] `/ctf/admin/settings` without a session: login page, organizer sign-in,
      back to the page (checked 2026-11-11).
- [ ] A player opening `/ctf/admin` gets "This page is for organizers"; the top
      bar shows "Admin" for organizers only.

## Settings (step 16)
- [x] Add a category, change a setting, refusals for keys in use
      (checked 2026-11-11, with the CTFM001 change).

## A new event (step 17)
- [ ] "New event": empty form refused in the browser; then a name, Generate
      for the code, start, freeze, end and registration window (registration
      open now, start in about 15 minutes), RACF group from the list.
- [ ] Create draft: the event page opens; the draft is in the list under
      "Drafts" and not on the public `/ctf` list.
- [ ] Publish now: refused, "Publishing needs at least one visible challenge".

## Library (step 18)
- [ ] "New challenge" with a category; on its page add two flags (one case
      sensitive, one not), a hint with a cost, and a link.
- [ ] Edit the hint's cost; delete the link; delete a challenge that an event
      uses: refused.
- [ ] A challenge of a running event shows the yellow "Running now in ..." note.

## Challenges of the event (step 19)
- [ ] Tab Challenges of the new event: add the new challenge and one or two
      existing ones; they arrive hidden.
- [ ] Give one dynamic scoring, one an attempt limit, change the order; show
      them; make one require another.
- [ ] A prerequisite that would make a cycle is refused.
- [ ] Settings tab: Publish now works; the event shows on `/ctf`.

## Playing it (player, second browser)
- [ ] Register for the new event with its code (or join it from My events),
      create a team if it is a team event.
- [ ] At the start: the board shows the challenges in the organizer's order;
      the locked one shows its prerequisite.
- [ ] Solve the new challenge with a flag typed in another case (for the flag
      that ignores case); the dynamic value drops on the board within a minute.
- [ ] Back as organizer: changing the scoring shows the yellow note on the
      Challenges tab; taking out a challenge with submissions is refused.

## Carried over from F3 (`docs/test-F3.md`)
- [ ] The board's "The event starts at ..." before the start (the new event
      gives the chance).
- [ ] Live board refresh with two players; "A teammate was quicker".
