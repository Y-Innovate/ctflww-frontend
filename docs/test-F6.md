# Test F6 on t01: players and RACF jobs

After `npm run build` here and `python python/uploadLWW.py` in ctflww (run
`--dry-run` first: the new folders `admin/players`, `admin/player` and
`admin/jobs` are created). You need the organizer sign-in and a test player
you may reset and revoke; the jobs really run on RACF.

## Players (step 24)
- [ ] Players: the list without filters; find by the start of a display name,
      of a userid (any case), by status, and by event.
- [ ] The Monitor and Teams tabs show names, "Alice (CTF0001)", not "player 1".
- [ ] Reset the test player's passphrase: the claim token and the link show
      once; reload the page and they are gone. When the job is done the
      player is Ready; the player opens the link, enters the token and a new
      passphrase, and signs in with it.
- [ ] A second action while the job runs: "This player has an open job".
- [ ] Revoke: when the job is done the player is Revoked and can't sign in;
      Resume: Active again and can sign in.
- [ ] Delete userid (only offered for a revoked player): only on a test player
      you don't need any more.

## Jobs (step 25)
- [ ] Jobs: newest first with action, player, status, JES job ID, RC and
      message; filters status and event (in the URL).
- [ ] A failed job, if there is one: Retry. A REMOVE goes back to Queued for
      the batch; a CREATE or RESET shows a new claim token once, and the
      player can activate with it.
- [ ] The player page lists that player's jobs, with Retry there too.
- [ ] Open jobs refresh by themselves within 30 seconds.
