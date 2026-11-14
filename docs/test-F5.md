# Test F5 on t01: running an event

After `npm run build` here and `python python/uploadLWW.py` in ctflww.
You need: the organizer sign-in, and two test players in different teams of a
running event, in a second browser profile or a private window. Closing needs
an event that has ended and that you are willing to offboard (its players are
removed from its RACF group, and revoked unless they play elsewhere).

## Monitor (step 20)
- [ ] The live leaderboard; during a freeze the note "Without the freeze", and
      scores above the public board's for teams that scored after the freeze.
- [ ] Attempts newest first with team, challenge and the submitted text; the
      filters team, challenge and "Right or wrong" (also in the URL).
- [ ] A player submits a flag: within 30 seconds it shows in attempts and solves.
- [ ] Reverse a solve with a reason: the solve goes, the score drops, the
      attempt shows "Reversed" with the reason; the player can solve it again.

## Teams (step 21)
- [ ] Teams by rank with size, captain, net awards and score.
- [ ] Give a penalty: the score drops here and on the player's team page, with
      the reason; delete it again.

## Announcements (step 22)
- [ ] Publish one: a player sees it within a minute with the unread badge.
- [ ] Correct it ("Corrected ... by"); delete it.
- [ ] Publish one on a draft event.

## Closing (step 23)
- [ ] A running event: "It can be closed after its end".
- [ ] An ended event: Close event, confirm; the page says it is closed and
      read-only; the jobs are in the provisioning jobs table (REMOVE, REVOKE,
      status Q), and the batch carries them out.
- [ ] After closing: no Save, no awards, no announcements; the public
      leaderboard still shows the event.
