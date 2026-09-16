# Possibilities — Safe Integration Handover

## Status

This document describes the contract preparation completed before a real Possibilities backend is approved.

Completed safely:

- audited the current page and its demo-only data;
- defined backend response/write schemas;
- implemented pure ID/state safety rules;
- added a typed frontend service boundary;
- added loading/error/needs-profile/unavailable state mapping;
- retained the existing demo page unchanged;
- made no migration and no production database write.

Not implemented yet:

- `/api/v1/possibilities` routes;
- occupation-direction selection logic;
- occupation-to-WEF-skill mapping;
- a production match formula;
- persistence for chosen direction or shortlist;
- switching the page from demo to live mode.

The frontend service is intentionally not imported by `Possibilities.tsx` yet. Calling it now would target routes that do not exist.

## Current demo behavior

Source files:

- `frontend/src/pages/Possibilities/Possibilities.tsx`
- `frontend/src/pages/Possibilities/possibilitiesData.ts`

The page currently contains:

- 3 hard-coded career directions;
- 6 hard-coded themes, including invalid live IDs `demo-communication` and `demo-project-planning`;
- generated example courses;
- an illustrative client-side match formula;
- session-only selection under `aiwrevolusi.possibilities.courseExploration.v1`.

None of these values may be written into live user data.

## Field ownership

| UI field | Intended owner/source | Current state |
|---|---|---|
| Current occupation code/title | confirmed user work profile + `ref_occupations` | existing data path, aggregation not built |
| Current work skills | confirmed task-to-WEF evidence | source needs final aggregation rule |
| Learning skills | `learning_progress` joined to verified catalogue | existing data, aggregation not built |
| Shortlisted skills | explicit user choice | persistence decision blocked |
| Career direction IDs/titles | server allowlist from `ref_occupations` | candidate-source rule blocked |
| Direction required skills | approved occupation-to-WEF relationship | no authoritative mapping exists |
| Coverage/match percentage | deterministic server calculation | formula not approved |
| Direction explanation | reference text or constrained AI wording | optional; must not own IDs/scores |

Project documentation explicitly states WEF skills do not join directly to occupations by four-digit code. Do not infer such a join.

## Prepared backend contracts

Files:

- `backend/app/schemas/possibilities.py`
- `backend/app/services/possibilities.py`
- `backend/tests/test_possibilities_safe_contract.py`

Prepared response shape:

```jsonc
{
  "contract_version": "1",
  "score_semantics": "direction_skill_coverage",
  "disclaimer": "Exploratory skill connections only; not job readiness or hiring probability.",
  "source": "live",
  "status": "ready",
  "current_role": {
    "occupation_code": "2512",
    "title": "Software developers"
  },
  "current_role_coverage_pct": 50,
  "skills": [
    {
      "skill_id": 1,
      "skill_slug": "analytical-thinking",
      "name": "Analytical thinking",
      "state": "have"
    }
  ],
  "directions": [
    {
      "occupation_code": "2511",
      "title": "Systems analysts",
      "area": "Technology",
      "description": "A verified or safely constrained description.",
      "coverage_pct": 60,
      "skills": []
    }
  ],
  "chosen_direction_code": null,
  "shortlisted_skill_ids": []
}
```

Explicit statuses:

| Status | Frontend state |
|---|---|
| `ready` | render live directions |
| `needs_profile` | ask the user to confirm a Work Profile |
| `unavailable` | show a retryable unavailable state |

Skill-state precedence is deterministic:

```text
have > learning > shortlisted > missing
```

Safety rules already implemented:

- demo slugs are rejected by live response schemas;
- shortlist IDs are deduplicated in stable order;
- unknown WEF IDs are rejected;
- shortlist size is bounded by the caller's approved limit;
- provider occupation output is filtered against a server allowlist;
- authoritative occupation title/description overwrite provider text;
- confidence is bounded to 0–1.

No match formula has been implemented.

## Proposed endpoints (not registered yet)

```http
GET /api/v1/possibilities
PUT /api/v1/possibilities/preference
PUT /api/v1/possibilities/shortlist
```

All three should require authentication. The user ID must come from the session cookie, never the body.

### Save chosen direction

```json
{
  "chosen_direction_code": "2511"
}
```

Use `null` to clear it. The server must verify the code against the approved candidate/reference set.

### Replace shortlist

```json
{
  "skill_ids": [1, 4, 6]
}
```

Replacement semantics are preferred because they are idempotent. The server must validate the complete list before writing anything.

## Prepared frontend boundary

Files:

- `frontend/src/pages/Possibilities/possibilitiesModel.ts`
- `frontend/src/services/possibilitiesService.ts`
- `frontend/tests/possibilitiesIntegration.test.mjs`

The service uses the shared `api` wrapper and cookie credentials:

```ts
possibilitiesService.getPossibilities(signal)
possibilitiesService.saveChosenDirection({ chosen_direction_code })
possibilitiesService.replaceShortlist({ skill_ids })
```

The generic API wrapper now supports `PUT` consistently with `GET`, `POST`, `PATCH`, and `DELETE`.

Do not import the service into the page until the backend read route exists and has passed real PostgreSQL tests.

Prepared view-state helper:

```text
loading
error
needs-profile
unavailable
ready
```

A request sequence helper is included so a stale response or a response after unmount can be ignored during later page integration.

## Error handling contract

| HTTP/status | Meaning | Frontend action |
|---|---|---|
| 401 | no valid signed-in session | use existing auth/session flow |
| 404 | approved occupation or skill no longer exists | refetch and remove stale choice only after server response |
| 409 | revision/concurrent-account conflict if workspace storage is chosen | reload authoritative state; do not overwrite blindly |
| 422 | invalid/unknown IDs or list too large | show validation feedback; do not retry unchanged payload |
| 500/503 | service/data source unavailable | retain current visible state and offer retry |
| `needs_profile` | no confirmed Work Profile | link to Work Profile |
| `unavailable` | server cannot safely build directions | show non-predictive empty state |

## Blocked decisions

Implementation must stop before route/database work until these are approved:

1. Which verified source defines alternative career directions?
2. Which verified source maps each direction to WEF skills?
3. Are choices stored in relational tables or existing account workspace JSON?
4. What deterministic formula, name, and disclaimer define `match_pct`?
5. Does the first release use deterministic ranking only, or constrained AI for reranking/explanation?

## AI boundary

Allowed:

- explain server-selected, verified directions;
- optionally rerank a server-supplied candidate list;
- improve wording subject to validation.

Forbidden:

- invent occupation codes;
- invent WEF skill IDs;
- calculate coverage or match percentages;
- decide what the user already has or is learning;
- return a direction outside the server allowlist;
- describe the score as hiring probability or job readiness.

## Verification commands

Backend safe-contract tests:

```bash
cd backend
.venv/Scripts/python.exe -m pytest tests/test_possibilities_safe_contract.py -q
```

Frontend safe-boundary tests:

```bash
cd frontend
node --test tests/possibilitiesIntegration.test.mjs
npm run build
```

Before future route work, record the existing full-suite baseline separately; unrelated AI contract failures existed before this feature preparation.
