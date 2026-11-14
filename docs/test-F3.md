# Test F3 on t01: player screens

After `npm run build` here and `python python/uploadLWW.py` in ctflww.
You need: two test players in a running team event, in different teams (A and
B); one player C without a team in an upcoming team event with registration
open; a second browser profile or a private window for the second player.
Items 1 to 4 of steps 11 and 12 were checked on 2026-11-11.

## My events (step 10)
- [ ] `/ctf/my` lists every event joined, with phase and team; links to
      Challenges, Team and Leaderboard.
- [ ] Join another open event with its code; a wrong code is refused in words.
- [ ] Change the passphrase; sign in with the new one.

## Challenge board (step 11)
- [x] Grouping by category, values and solve counts match the backend.
- [x] Fresh load of `/ctf/board?eventID=` without a session: login redirect and back.
- [x] A frozen event: banner, own late solves marked, counts at the freeze.
- [x] The board refreshes itself within a minute.
- [ ] Live change: A keeps the board open, B solves a challenge; within a
      minute A sees the extra solve (and a lower value for a dynamic challenge).
- [ ] C creates a team in the upcoming event (see Team), then opens its board:
      "The event starts at ...".

## Challenge (step 12)
- [ ] Description, value, solves, attempts; links open in a new tab.
- [ ] A locked challenge shows its prerequisites, marked solved or not.
- [ ] Unlock a hint: the confirmation names the cost; the text shows after;
      Team shows one more hint unlocked and the cost off the score.
- [ ] Wrong flag (attempts left when limited), correct flag, and a flag that
      ignores case typed in another case.
- [ ] A and a teammate open the same challenge; the second to submit sees
      "A teammate was quicker".

## Team and progress (step 13)
- [ ] C creates a team in the upcoming event; the join code shows with Copy.
- [ ] A second player joins it with the code typed in lower case.
- [ ] C hands over captaincy, then leaves; the other removes nobody (alone) and
      leaves as last member: the team is gone.
- [ ] In the running event: score, solves (who, when, value) and awards match
      the admin leaderboard; no Leave or Remove buttons after the start.

## Announcements (step 14)
- [ ] Announcements newest first; all new on the first visit; the badge in the
      event bar clears after opening the page.
- [ ] Post an announcement as organizer (testIteration5.py or the admin API):
      within a minute the badge shows 1 on another page, and the page shows it
      as new.
- [ ] A player without a team can read them too.
