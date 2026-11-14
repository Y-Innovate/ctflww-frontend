# ctflww-frontend

Web UI of the Y-Innovate CTF application: React + Vite, hosted by the LWW
gateway in CICS under `/ctf/`, next to the API of the
[ctflww](https://github.com/Y-Innovate/ctflww) backend. See SPEC.md for what it does and PLAN.md for
the build plan.

## Run locally

```
npm install
npm run dev        # http://localhost:5174/ctf/, API answered by mock/
npm test
npm run lint
```

## Mocks

In dev, `mock/` answers the API and imitates LWW's sign-in, with an in-memory
database seeded relative to the moment Vite starts (`mock/seed.js`), so there
is always a running, a frozen, an upcoming, an ended and a closed event.
Restart Vite to reset it.

| Userid | Who |
|---|---|
| `CTF0001` | Alice, captain of Root Access in Spring Team CTF |
| `CTF0002` | Bob, member of Root Access |
| `CTF0003` | Carol, without a team in two team events |
| `CTF0004` | Dave, in the frozen and the ended event |
| `CTF0005` | Erin, with a pending place |

Any passphrase works, except one that starts with `wrong`. The organizer
sign-in (`/ctf/redirect_to_sso_login.html`) signs you in as admin `ADMIN01`, and
"Sign out" (`/ctf/logout.html`) ends the mock session, to switch users. A registration
becomes ready 5 seconds after it is made; with "fail" in the display name it
fails. New passphrases must be 14 characters or more.

## Deploy

`npm run build` writes `index.html`, `assets/` and the contents of `public/`
(LWW's sign-in pages, the route folders and their `.name` files) into the
backend repo's `LWWAdmin/` (`../ctflww/LWWAdmin`, or `CTF_LWW_DIR`), after
removing the previous build there; the API placeholders stay. Then run
`python python/uploadLWW.py` in the backend repo, and commit `LWWAdmin/`
there (PLAN.md, "Deploying to t01").

`openapi/ctf.yaml` is the backend's `openapi/ctf_1.0.0.yaml` without the
`x-LWWProcessingSteps` references.
