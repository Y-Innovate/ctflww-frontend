# CLAUDE.md

## This app
- Web UI of the Y-Innovate CTF (Capture the Flag) application. Product spec:
  SPEC.md (read before planning features). Build plan: PLAN.md.
- Base path `/ctf` (the app never runs in `/`), API path `/ctf/API/v1`.
- Backend: CICS/COBOL/DB2 REST API behind the LWW gateway, repo `ctflww`.
  Its use cases, data model and API guide are in `ctflww/docs/01..04`; the
  spec `ctflww/openapi/ctf_1.0.0.yaml` is copied into `openapi/` without the
  LWW processing steps. Contract changes start in the backend repo.
- Hosted by LWW itself, not by a BFF: the build goes into `ctflww/LWWAdmin/`
  and is uploaded with `ctflww/python/uploadLWW.py`.
- Three audiences: visitors (no session), players (RACF userid + passphrase,
  LWW login page) and admins (Entra through LWW's SSO redirect, mapped to a RACF
  userid). The backend decides who may do what; the UI only hides what can't be
  used.

## Stack rules
@docs/stack-react-lww.md
