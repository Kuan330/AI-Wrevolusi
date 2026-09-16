# AI-Wrevolusi Backend & Frontend Handover

**Audience:** frontend developers and agents continuing the project.
**Scope:** current backend contracts, data architecture, authentication, frontend integration rules, Possibilities, Learning, Task Assist, and known verification status.
**Last verified:** 2026-09-17.

> This is an integration handover, not a replacement for the detailed feature documents linked below. Values marked `illustrative` are examples only; do not copy them into production data.

---

## 1. Current status

### Implemented and available

- Cookie-based account authentication and refresh flow.
- Per-user account workspace with optimistic revision checks.
- Reference occupation and WEF skill APIs.
- Work Profile occupations and user tasks.
- Real WEF learning catalogue: 26 skills, 156 courses, 947 chapters.
- Learning progress, check-in, calendar, summary and daily brief APIs.
- AI task matching, occupation suggestions/recommendations, and Task Assist APIs.
- Possibilities live page and `GET /api/v1/possibilities`.
- Possibilities recommendations based on real occupation tasks and existing `task → skill` matching rules.
- Possibilities chosen direction and shortlist stored in workspace.

### Not completed or not verified

- No Possibilities database migration is required or approved.
- No Possibilities manual write has been made to the production database.
- Real PostgreSQL HTTP end-to-end verification for Possibilities remains to be run.
- Full project tests contain unrelated existing failures; see [Verification](#12-verification-status).
- The frontend production TypeScript build can be blocked by unrelated changes in `Plan.tsx`.

### Important branch state

- Branch: `iteration-2-zhangxu`
- Possibilities implementation commit: `d6f73d8 feat: integrate possibilities with real skill data`
- `.hermes/` ignore-rule commit: `4ad2e0b chore: ignore local Hermes files`
- At the latest push check, local and `origin/iteration-2-zhangxu` pointed to `4ad2e0b` and the worktree was clean.

---

## 2. System architecture

```text
React + TypeScript frontend
        |
        | shared api.ts, credentials: include
        v
FastAPI application (/api)
        |
        +-- /api/v1/account       account, workspace, auth-adjacent operations
        +-- /api/v1/auth          register/login/refresh/logout
        +-- /api/v1/users         current user profile
        +-- /api/v1/occupations   user occupation records
        +-- /api/v1/tasks         user task CRUD
        +-- /api/v1/reference     public occupation/WEF references
        +-- /api/v1/learning      verified catalogue and learner progress
        +-- /api/v1/possibilities career exploration
        +-- /api/v1/ai            constrained AI features
        +-- /api/v1/exposure      occupation/task exposure assessment
        +-- /api/v1/capabilities   capability records and inference
        +-- /api/v1/preparation    preparation records
        +-- /api/v1/schedule       learning schedule
        +-- /api/v1/skill-directions skill learning suggestions
        |
        v
PostgreSQL / SQLAlchemy async ORM and parameterised SQL
```

### Frontend rules

- Use the shared wrapper in `frontend/src/services/api.ts`.
- Do not use raw `fetch` in feature services.
- Cookies are sent by the shared wrapper; do not put access tokens in local storage or request bodies.
- API paths passed to `api.*` are relative to the configured API base and normally begin with `/...`, not `/api/v1`.
- Use `accountStorage` for persistent user workspace fields. It automatically reads the authenticated workspace and batches PATCH updates.
- Do not use `sessionStorage` for data that must survive devices or sessions.
- Treat server-derived IDs, names, scores, totals and statuses as authoritative.
- Never create fallback IDs such as `demo-*`, `c1`, or `c2` in live flows.

### Backend rules

- The authenticated user comes from the signed session cookie (`get_current_user`). Never accept a user ID as a trusted request selector.
- User-owned queries must filter by the authenticated user ID.
- Reference and catalogue data are server-owned and read-only from the frontend.
- Use parameterised SQL or SQLAlchemy expressions.
- Keep AI outputs constrained to server-supplied candidates; AI cannot create official IDs or scores.

---

## 3. Authentication and session flow

### Recommended startup flow

```text
GET /account/me
  └─ if 401: POST /auth/refresh (or existing authService.refresh)
              then retry /account/me
GET /account/workspace
```

The existing `AccountProvider` performs this flow and activates `accountStorage` with the returned `{ owner_id, data, revision }`.

### Auth endpoints

| Method | Frontend path | Purpose | Auth |
|---|---|---|---|
| POST | `/auth/register` | Register a user and issue session cookies | public |
| POST | `/auth/login` | Log in and issue session cookies | public |
| POST | `/auth/refresh` | Refresh the session | refresh cookie |
| POST | `/auth/logout` | Revoke/logout current session | session |
| POST | `/account/register` | Existing account registration flow | public |
| POST | `/account/login` | Existing account login flow | public |
| GET | `/account/me` | Current account identity | session |

There are two historical auth route families in the application. New frontend work should follow the already-used service for the relevant screen and avoid inventing another login flow.

### Common auth responses

- `401`: no valid session or session expired. Use the existing refresh/re-auth flow.
- Never show or log cookies, passwords, tokens, database URLs, or API keys.

---

## 4. Workspace contract

### Read

```http
GET /api/v1/account/workspace
```

Response:

```json
{
  "owner_id": "<authenticated-user-uuid>",
  "data": {
    "aiwrevolusi.confirmedAnalysis": "<JSON string>"
  },
  "revision": 3
}
```

### Replace/save

```http
PATCH /api/v1/account/workspace
Content-Type: application/json
```

```json
{
  "owner_id": "<current-account-id>",
  "data": {
    "aiwrevolusi.possibilities.chosenDirection": "{\"occupation_code\":\"2511\",\"title\":\"Systems analysts\"}",
    "aiwrevolusi.possibilities.shortlist": "[1,4,6]"
  },
  "revision": 3
}
```

The workspace update is a complete data snapshot, not a single-key patch. `accountStorage` handles this; feature pages should normally call `accountStorage.setItem()` and not call the endpoint directly.

### Allowed keys currently relevant to frontend work

```text
aiwrevolusi.userProfile
aiwrevolusi.confirmedAnalysis
aiwrevolusi.learningCentre
aiwrevolusi.learningResourceSelections.v1
aiwrevolusi.courseLibrary.v1
aiwrevolusi.learningSkills.v1
aiwrevolusi.planner.v1
aiwrevolusi.possibilities.chosenDirection
aiwrevolusi.possibilities.shortlist
```

Legacy `aiwrevolusi.possibilities.saved` and `aiwrevolusi.possibilities.intent` are not part of the current approved Possibilities contract. Do not create new data under them.

### Workspace safety

- `owner_id` must equal the signed-in account.
- `revision` must equal the server revision.
- Concurrent changes return `409`; reload authoritative workspace before retrying.
- The backend validates that every value is valid JSON and bounds total size.
- A local browser cache may contain unsynced changes. Do not let stale local values override a successful server response unless an explicit unsynced-change policy is implemented.

---

## 5. Reference APIs

### Occupations

```http
GET /api/v1/reference/occupations
GET /api/v1/reference/occupations/{code}
GET /api/v1/reference/occupations/{code}/tasks
```

Typical query parameters for the list endpoint include search and hierarchy filters used by the Work Profile page. The response occupation identity is the string `occupation_code`; do not confuse it with a UUID user-occupation record.

`/occupations/{code}/tasks` returns the reference ILO tasks for that occupation. These are the tasks used by the Possibilities backend to derive required skills.

### WEF skills

```http
GET /api/v1/reference/wef-skills
```

The canonical backend identity is the integer `wef_skill_id`. Frontend learning catalogue APIs may expose a stable slug for catalogue lookup; do not join records by display name.

Current verified reference count: **26 WEF skills**.

---

## 6. Work Profile and task APIs

```http
GET    /api/v1/users/me
PATCH  /api/v1/users/me
GET    /api/v1/occupations
POST   /api/v1/occupations
GET    /api/v1/tasks
POST   /api/v1/tasks
PATCH  /api/v1/tasks/{task_id}
DELETE /api/v1/tasks/{task_id}
```

The Work Profile frontend stores the confirmed analysis in workspace and creates/updates user tasks through the task APIs. For skill evidence:

```text
only confirmed user tasks
→ existing task-to-skill matcher
→ deduplicated WEF skill IDs
```

Tasks needing review or optional context are not evidence of an owned skill for Possibilities.

The current backend task status values are:

```text
confirmed
needs_review
optional_context_missing
```

---

## 7. Learning and catalogue APIs

Detailed guide: `learning-progress-and-daily-brief.md`.

### Catalogue

```http
GET /api/v1/learning/catalogue
GET /api/v1/learning/courses
```

The verified catalogue currently contains:

```text
26 skills
156 courses
947 chapters
```

The server owns course/chapter totals and scope. The frontend must not recreate courses from static arrays.

### Progress and learner activity

```http
POST /api/v1/learning/progress
POST /api/v1/learning/checkin
GET  /api/v1/learning/calendar
POST /api/v1/learning/summary
POST /api/v1/learning/daily-brief
```

Important rules:

- `local_date` is a browser-local `YYYY-MM-DD`, not `toISOString()`.
- `chapter_index` is zero-based in the API.
- Progress values are cumulative 0–10 and cannot move backwards.
- Skill/course/chapter scope is checked against the verified catalogue.
- Check-in requires learning activity for that day.
- All learner records are user-scoped by the session user.

The existing Learning Centre uses real catalogue data. My Plan still has unrelated legacy work to finish around full progress/check-in/calendar integration.

---

## 8. Possibilities feature

Detailed feature guide: `possibilities.md` (update it when the contract changes).

### Live endpoint

```http
GET /api/v1/possibilities
```

Frontend service:

```ts
import { possibilitiesService } from "@/services/possibilitiesService";
const response = await possibilitiesService.getPossibilities(signal);
```

### Data flow

```text
ref_occupations + ref_ilo_tasks
    → each occupation's reference task text
    → existing allowlisted match_skills(task_text, ref_wef_skills)
    → occupation required WEF skill set

current user's confirmed tasks
    → existing match_skills(task_text, ref_wef_skills)
    → user's owned WEF skill set

owned skill set ∩ occupation required skill set
    → coverage percentage
    → descending score, database input order for ties
    → top 3 directions
```

Occupations without a valid task→skill result are excluded. There is no free-form AI occupation generation and no occupation-code similarity guessing.

### Response shape

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
  "current_role_coverage_pct": null,
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
      "area": null,
      "description": "Database-owned description.",
      "coverage_pct": 50,
      "skills": []
    }
  ],
  "chosen_direction_code": null,
  "chosen_direction_coverage_pct": null,
  "shortlisted_skill_ids": []
}
```

### Possibilities statuses

| Status | Meaning | Frontend action |
|---|---|---|
| `ready` | confirmed skills exist and directions can be calculated | render live directions |
| `needs_profile` | user has no owned skill evidence | ask user to complete Work Profile |
| `unavailable` | safe calculation cannot be produced | show retryable unavailable state |

### Scores

Normal direction score:

```text
owned required skills / all required skills × 100
```

It excludes learning and shortlist.

Chosen direction score:

```text
owned skill = 1.0
shortlist-only skill = 0.5
missing skill = 0
```

A skill that is both owned and shortlisted receives only the owned contribution once. The result is a percentage and may contain `.5` values. It is an exploratory skill coverage metric, never an employment, hiring, readiness, salary or vacancy prediction.

### Workspace persistence

```text
aiwrevolusi.possibilities.chosenDirection
  JSON string: { "occupation_code": "2511", "title": "Systems analysts" }

aiwrevolusi.possibilities.shortlist
  JSON string: [1, 4, 6]
```

Use `accountStorage`:

```ts
accountStorage.setItem(
  "aiwrevolusi.possibilities.chosenDirection",
  JSON.stringify({ occupation_code, title }),
);
accountStorage.setItem(
  "aiwrevolusi.possibilities.shortlist",
  JSON.stringify(skillIds),
);
```

The server response is authoritative after loading. Filter stale shortlist IDs against the returned live skill IDs and accept a chosen direction only when it is one of the returned directions.

### Frontend behavior

- No owned skills: show `Complete your Work Profile`; do not show a fabricated `0%` recommendation.
- Show at most the three server-returned directions.
- Do not recalculate coverage in React.
- Show the backend disclaimer.
- Use real `skill_id`/slug values when linking to Learning Resources.
- Keep demo data only in an explicitly isolated development preview; never persist demo IDs.
- Abort requests on unmount and ignore stale responses.

---

## 9. AI APIs

All AI APIs are constrained and may have deterministic fallback behavior. AI output is not a source of official occupation or WEF IDs.

```http
POST /api/v1/ai/task-match
POST /api/v1/ai/occupation-suggestions
POST /api/v1/ai/occupation-recommendations
POST /api/v1/ai/task-assist
POST /api/v1/ai/task-assist/details
GET  /api/v1/ai/task-assist/{task_id}
POST /api/v1/ai/skill-match
```

### Frontend safety rules

- Send candidate lists from verified backend/reference data.
- Treat returned candidates as valid only after server allowlist validation.
- Do not display provider names, raw provider errors, or secrets.
- Do not let AI calculate Possibilities scores.
- Do not use `/capabilities/infer` for Possibilities: it writes inferred capability records and is not a read-only skill calculator.
- Do not use `/skill-directions/analyse` as a career-direction API: it has a different learning-theme contract and generated IDs.

Detailed Task Assist guide: `task-assist.md`.

---

## 10. Other current APIs

These routes exist in the backend OpenAPI and should be reused rather than duplicated:

### Exposure

```http
POST /api/v1/exposure/assessments
GET  /api/v1/exposure/tasks/{task_id}
```

### Capabilities

```http
GET  /api/v1/capabilities
POST /api/v1/capabilities/infer
```

`infer` is a write path; do not call it merely to display Possibilities data.

### Preparation

```http
GET   /api/v1/preparation
POST  /api/v1/preparation
PATCH /api/v1/preparation/{preparation_id}
```

### Schedule

```http
GET   /api/v1/schedule
POST  /api/v1/schedule
PATCH /api/v1/schedule/{schedule_id}
```

### Skill directions

```http
POST /api/v1/skill-directions/analyse
POST /api/v1/skill-directions/learning-goal
```

### System

```http
GET /api/healthz
```

Use the generated OpenAPI document at `/docs` or `/openapi.json` for exact request fields and validation constraints. Do not infer a request schema from a UI label.

---

## 11. Error handling

| Status | Meaning | Frontend behavior |
|---|---|---|
| `400` | malformed business request | show actionable message; do not blindly retry |
| `401` | missing/expired session | use existing refresh/auth flow |
| `404` | record/reference no longer exists | refetch and remove stale local selection |
| `409` | revision conflict or business conflict | reload authoritative state; do not overwrite blindly |
| `422` | validation, unknown scope, invalid date or ID | fix request; do not retry unchanged payload |
| `500` | server failure | preserve visible state and offer retry |
| `503` | unavailable dependency/data source | show unavailable state and retry option |

The shared API wrapper normalizes failures into `ApiError`. Check status and message through that wrapper rather than parsing arbitrary HTML or provider responses.

---

## 12. Verification status

### Focused verified commands

```bash
cd backend
.venv/Scripts/python.exe -m pytest tests/test_possibilities_safe_contract.py -q
# 10 passed

.venv/Scripts/python.exe -m compileall -q app
# passed

cd ../frontend
node --test tests/possibilitiesIntegration.test.mjs
# 5 passed
```

`git diff --check` passed for the implemented changes.

### Known full-suite failures

These existed outside the Possibilities focused scope and must be tracked separately:

- Backend: 3 existing AI skill-match contract failures related to max result count and fallback expectations.
- Frontend: 3 existing `taskOverview` test failures.
- Frontend TypeScript may fail on unrelated `frontend/src/pages/Plan/Plan.tsx` unused `Chapter` import.

Do not describe the full project as green until these are resolved or explicitly accepted by the team.

### Remaining Possibilities verification

Before release, add/run:

1. Authenticated HTTP tests against a test database.
2. `needs_profile` test with no confirmed tasks.
3. Top-three and equal-score ordering test.
4. Real `ref_occupations` + `ref_ilo_tasks` query test.
5. Chosen score precision test (`62.5` must remain `62.5`).
6. Workspace stale chosen direction and shortlist reconciliation tests.
7. Cross-user isolation test.
8. A scoped test-account create/read/save/delete flow with cleanup read-back.

No production database migration or manual production write is part of this verification.

---

## 13. File map

### Backend

```text
backend/app/main.py
backend/app/routers/accounts.py
backend/app/routers/possibilities.py
backend/app/routers/reference.py
backend/app/routers/learning.py
backend/app/routers/ai.py
backend/app/services/possibilities.py
backend/app/services/skill_matching.py
backend/app/services/catalogue.py
backend/app/models/account.py
backend/app/models/occupation.py
backend/app/models/task.py
backend/app/models/catalogue.py
backend/app/models/learning.py
backend/app/schemas/possibilities.py
```

### Frontend

```text
frontend/src/pages/Possibilities/Possibilities.tsx
frontend/src/pages/Possibilities/possibilitiesModel.ts
frontend/src/pages/Possibilities/possibilitiesData.ts  # demo-only source; not live data
frontend/src/services/possibilitiesService.ts
frontend/src/services/accountStorage.ts
frontend/src/services/api.ts
frontend/src/services/catalogueService.ts
frontend/src/services/referenceService.ts
frontend/src/pages/Analysis/lib/matchSkills.ts
frontend/src/pages/Skills/lib/skillProfile.ts
frontend/src/pages/LearningCentre/LearningCentre.tsx
frontend/src/components/account/AccountProvider.tsx
```

### Detailed handover documents

```text
docs/backend_Ruiduo/handover/possibilities.md
docs/backend_Ruiduo/handover/learning-progress-and-daily-brief.md
docs/backend_Ruiduo/handover/task-assist.md
```

---

## 14. Safe continuation checklist

Before changing backend or frontend code:

- [ ] Read `git status --short` and identify parallel changes.
- [ ] Read the target file from disk immediately before editing.
- [ ] Write a failing focused test for new behavior.
- [ ] Do not modify migrations or production data without explicit approval.
- [ ] Keep user IDs session-derived.
- [ ] Keep reference IDs server-authoritative.
- [ ] Keep AI behind a verified candidate allowlist.
- [ ] Preserve `null` for unknown metrics; never substitute `0`.
- [ ] Run focused tests, then full tests and build.
- [ ] Use `git diff --check`.
- [ ] Stage only files owned by the current task.
- [ ] Run an independent review before commit/push.

## 15. Recommended next work

1. Add the missing authenticated Possibilities HTTP tests.
2. Run the scoped real test-database end-to-end flow and verify cleanup.
3. Verify the Learning Resources link filters by the intended real skill identifier rather than only a display title.
4. Resolve the unrelated Plan/taskOverview/AI test failures in separate commits.
5. Run browser smoke tests on the live page.
6. Update this document whenever an endpoint or workspace contract changes.
