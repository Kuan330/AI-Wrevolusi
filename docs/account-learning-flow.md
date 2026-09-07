# Account and learning flow

## Setup

The username flow uses the existing Argon2 password hashing, signed tokens and HttpOnly cookies. No email is requested or verified. The legacy email API remains compatible; username identities live in `app_accounts` and reference `app_users`. An internal random email is used only to satisfy the legacy app user schema; it is not a contact or recovery address.

From `backend`, run:

```sh
.venv/bin/python -m scripts.setup_accounts
```

This creates missing account dependencies (`occupations`, `app_users`, `refresh_tokens`, `app_accounts`) without altering or deleting existing tables. It has been run for the current configured development database. Restart the backend when not using reload mode. Keep the existing frontend `/api` proxy to the backend.

## Navigation and entry states

- Guest users can explore their profile, tasks, AI exposure and skills without registering.
- Learning Resources, My Plan and Possibilities show an introduction until login.
- Occupation selection shows Work Profile only. Tasks shows Work Profile and Tasks.
- Signed-in users with confirmed analysis see AI Exposure, Skills, Learning Resources, My Plan and Possibilities. Work profile, task editing, occupation changes and logout are in the account popover.
- Learning Resources has no default demo data. A saved learning theme from Skills is required for actual resources.
- My Plan shows an introduction when both the resource shortlist and activities are empty. Existing plans remain available after task changes.
- Possibilities first asks for a direction. Its saved next-step guidance is not a job-matching assessment. The previous illustrative role interface remains available through an explicit example link.
- Development resource and planner examples require `?demo=1`; they never replace normal personal content.

## Storage and session behavior

`/account/register`, `/account/login`, `/account/me` and `/account/workspace` implement the username flow. Passwords require 8–128 characters; usernames are case-insensitive, 3–32 letters, digits or underscores. There is currently no self-service password recovery.

The workspace stores work profile/analysis, selected learning themes, resource shortlist, planner activities and possibility choices. Each write verifies the authenticated owner and expected revision. Account-specific browser caches preserve unsynced changes. Failed saves show a retry notice; a conflict can be resolved by exporting the local copy and reloading the server copy. Logout waits for pending saves. Guest data remains separate. Registration offers to import it; login can retain guest-selected learning themes without replacing the account's work profile.

## Verification

- `npm run build` and `npm run lint` in frontend (existing unrelated lint and bundle-size warnings remain).
- `node --test frontend/tests/*.test.mjs`: 14 tests including account separation and rejected sync preservation.
- `python -m pytest tests/test_accounts.py tests/test_auth.py -q` in backend.
- Real database checks: registration, duplicate username, password failure, case-insensitive login, cookies/logout, workspace persistence, revision conflicts and account isolation.
- Browser checks at desktop and mobile widths: registration/import, conditional navigation, intro states, adding resources, scheduling an activity, save/reload, logout/login and saved direction.

## Temporary learning theme templates

Learning theme analysis defaults to local templates, requiring no LLM key or request. Each chosen skill/direction gets two starter themes with stable IDs and `source: "template"`. The Skills and Learning Resources pages identify them as templates. Selections, resource matching and account saving use the existing theme contract.

To enable the existing backend later, configure `SKILL_LLM_API_KEY` on the backend and `VITE_SKILL_ANALYSIS_MODE=backend` in the frontend environment, then restart/rebuild the frontend. Backend errors remain visible in backend mode; they are not silently presented as model results.
