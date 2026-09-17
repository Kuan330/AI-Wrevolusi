# Permanent single-use Task Assist handover

Status: implemented on `iteration-2-zhangxu`; migration generated and verified offline, but not applied to a shared database in this work session.

## Product rule

Task Assist is not a reopenable one-shot dialog. It is one permanent exchange per authenticated user and per Task Detail:

1. A Detail is synchronized into the authenticated user's server-owned `tasks` row. The browser's `ProfileTask.id` is only an idempotent import key; the permanent boundary uses the server-generated task UUID.
2. The user may submit one question. The default remains exactly:

```text
How can AI assist me in completing this task?
```

3. The first model or explicit deterministic fallback reply is persisted permanently.
4. Repeated POSTs, refreshes, sign-outs/sign-ins and other devices read the stored first question and answer. They do not call the model again.
5. A completed Detail renders the saved exchange read-only. The `Chat with AI` entry, textarea and send button are not rendered.
6. There is no conversation/thread/messages table and no follow-up endpoint.

The uniqueness boundary is enforced by PostgreSQL, not by React state:

```text
UNIQUE (user_id, task_id)
```

## Data model and migration

Migration: `backend/alembic/versions/0003_add_task_assist_interactions.py`

Table: `task_assist_interactions`

Important fields:

- account ownership: `user_id`
- stable Detail identity: `task_id`
- registered context snapshot: `task_text`, `notes`
- state machine: `available → pending → completed`
- one persisted exchange: `question`, `reply`
- provenance: `generated_by_model`, `needs_user_confirmation`
- atomic claim: `claim_token`, `claimed_at`
- audit timestamps: `created_at`, `updated_at`, `completed_at`

Database constraints require a claim token/timestamp while pending and a complete question/reply/provenance/timestamp payload while completed. User deletion cascades to that user's records.

`tasks.profile_task_id` stores the account-scoped browser import key under `UNIQUE(user_id, profile_task_id)`. Registration creates or reuses a real server-owned `tasks.id`; `task_assist_interactions.task_id` is a UUID foreign key to that row. Answer and read routes accept only the server UUID and also filter by authenticated `user_id`. Once completed, re-registration preserves the original saved context and exchange.

## API

All endpoints require `get_current_user` authentication.

### Register/read Detail states

```http
POST /api/v1/ai/task-assist/details
```

```json
{
  "details": [
    {
      "profile_task_id": "stable-profile-import-key",
      "task_text": "Prepare the weekly performance report.",
      "notes": "Use the approved internal template."
    }
  ]
}
```

The response contains one state per Detail and its server-generated UUID, for example `task_id: "5b8d..."`. Registration updates task context only before an answer is completed. The frontend must use this returned UUID for GET and answer POST calls; it must not reuse `profile_task_id` as the security identity.

```http
GET /api/v1/ai/task-assist/{task_id}
```

Returns only the current user's record. An unknown or another user's Detail returns `404`.

### Consume the one question

```http
POST /api/v1/ai/task-assist
```

```json
{
  "task_id": "server-generated-task-uuid",
  "user_message": "How can AI assist me in completing this task?"
}
```

The answer request intentionally cannot submit `task_text`, `notes`, `user_id`, history or messages. The service loads the registered account-owned context snapshot.

Completed response:

```json
{
  "task_id": "server-generated-task-uuid",
  "status": "completed",
  "question": "How can AI assist me in completing this task?",
  "reply": "...",
  "generated_by_model": true,
  "needs_user_confirmation": true,
  "completed_at": "2026-09-17T00:00:00Z"
}
```

A repeated POST returns that same stored record without calling the AI gateway. A concurrent request that sees an active claim returns `409`; an unregistered Detail returns `404`.

## Concurrency and failure behavior

`claim_interaction()` performs one conditional `UPDATE ... RETURNING`:

- only `available` can be claimed for a provider call;
- the winning request stores a unique claim token and the exact submitted question before invoking the provider;
- concurrent losers do not invoke the provider;
- completion is accepted only from the current claim token;
- `pending` is never reclaimed for another provider call;
- if generation raises unexpectedly, the same winning request saves deterministic fallback guidance;
- if a process disappears after claiming, authenticated GET polling converts a stale pending row to completed deterministic fallback without calling a provider;
- a model-unavailable deterministic fallback is a visible answer and therefore counts as the one completed exchange.

## AI and privacy boundary

Task Assist still uses `backend/app/services/ai_gateway.py` with:

- configured provider → OpenCode Zen fallback → deterministic guidance;
- per-provider timeout `20s`;
- zero provider retries;
- `request_cache_enabled=False`, disabling both gateway and provider caches for workplace text;
- strict output schema and maximum 1200-character reply;
- prompt/context isolation and output checks for prompt, credential and internal-configuration leakage;
- explicit `generated_by_model` provenance and `needs_user_confirmation=true`.

Persistence is limited to the account-owned Task Assist table. It is not the shared in-process AI cache.

## Frontend terminal states

`TaskDetailsDrawer.tsx` registers the selected Detail and waits for the backend state before exposing any AI action, avoiding a flash of a second-use button.

- `available`: render `Chat with AI`.
- `pending`: the dialog publishes pending to its parent before POST so closing cannot resurrect the entry; the drawer then polls the authenticated GET endpoint and renders status only, with no input or send action. Stale rows finish as persisted deterministic fallback without a second provider call.
- `completed`: render `Saved AI guidance` with the first question and answer inside the drawer's scroll region; render no `Chat with AI` button or dialog entry.
- signed-out visitors do not mount or call the authenticated Task Assist feature.

Immediately after the first successful response, `TaskAssistDialog.tsx` shows the saved exchange but no longer renders the form, textarea or send button. Closing it leaves only the read-only saved section in the Detail.

## Verification

Automated coverage:

- Task Assist backend persistence/security suite: `21 passed`.
- Complete backend suite in a clean worktree: `200 passed, 3 known unrelated failures` (skill-match contract/fallback baseline).
- Task Assist frontend: `7/7 passed`; complete frontend tests in a clean worktree total `36 passed, 3 known unrelated taskOverview failures`; production build and lint pass (existing warnings only).

- `backend/tests/test_task_assist.py`
  - authenticated registration;
  - server snapshot usage;
  - first reply persistence;
  - repeated POST does not call the provider;
  - account isolation;
  - concurrent requests invoke the provider at most once;
  - strict request fields, no-cache privacy, safety filtering and fallback provenance.
- `backend/tests/test_task_assist_persistence.py`
  - unique/check constraints and migration chain.
- `frontend/tests/taskAssist.test.mjs`
  - exact default question;
  - status gating;
  - completed-state saved guidance;
  - no second-turn textarea/send controls;
  - task ID-only answer payload;
  - cancellation/stale-response/accessibility guards.

The Alembic upgrade and targeted downgrade were generated in offline PostgreSQL SQL mode and reviewed. A read-only live check found the shared database at revision `0002_catalogue_tables`, with `tasks` present and both `tasks.profile_task_id` and `task_assist_interactions` absent. Applying `0003_task_assist_once` remains a separately controlled database change and was not performed automatically.

## Relevant files

- `backend/app/models/task_assist.py`
- `backend/app/services/task_assist_records.py`
- `backend/app/services/task_assist.py`
- `backend/app/schemas/task_assist.py`
- `backend/app/routers/ai.py`
- `backend/alembic/versions/0003_add_task_assist_interactions.py`
- `backend/tests/test_task_assist.py`
- `backend/tests/test_task_assist_persistence.py`
- `frontend/src/pages/Analysis/components/TaskDetailsDrawer.tsx`
- `frontend/src/pages/Analysis/components/TaskAssistDialog.tsx`
- `frontend/src/pages/AIExposure/lib/taskAssistState.ts`
- `frontend/src/services/aiService.ts`
- `frontend/tests/taskAssist.test.mjs`
