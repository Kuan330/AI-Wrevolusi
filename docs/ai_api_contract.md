# AI API contract

Status: implementation contract for the candidate-constrained endpoints and the one-shot Task Assist endpoint under `/api/v1/ai`.

## Shared candidate-matching rules

- The request `candidates` list is the complete allowlist. The service must not
  discover, synthesize, or return an identifier/code/skill outside that list.
- Responses are JSON objects matching the documented response model. Provider
  text is untrusted input and must be validated before serialization.
- If no candidate is a reliable fit, return an empty result plus a clarifying
  question (or `status: "clarifying"` for occupation endpoints). Do not force a
  selection.
- Do not predict job loss, unemployment, replacement, dates/timelines, or a
  personal skill gap. These endpoints support exploration and matching only.
- Candidate identifiers are opaque values. Preserve them exactly; do not trim,
  case-fold, coerce, or generate them.
- Provider/database failures must produce a safe schema-valid fallback, never an
  invented candidate. The integration suite uses caller-supplied fixtures and
  does not assert external database availability.
- Provider unavailability (missing key, timeout, 429/5xx, malformed or
  schema-invalid output, local rate limit) never changes the HTTP status: the
  endpoint returns its deterministic result in the same response shape.
- Every response carries `needs_user_confirmation: true`. Results are
  suggestions for the user to review and are never persisted automatically.

## Endpoints

All endpoints are `POST` and accept/return `application/json`.

### `POST /api/v1/ai/task-match`

Request:

```json
{
  "occupation_code": "5222",
  "user_task": "prepare weekly sales report",
  "candidates": [
    {"id": "task-1", "text": "prepare weekly sales reports"}
  ]
}
```

Response shape:

```json
{
  "candidate_id": "task-1",
  "confidence": 0.91,
  "matched_concepts": ["prepare", "sales", "report"],
  "unmatched_concepts": [],
  "reason": "...",
  "clarifying_question": null
}
```

`candidate_id` is `""` when no reliable candidate is selected. Concept arrays
are bounded at 50 items each.

### `POST /api/v1/ai/occupation-suggestions`

Use this for matching a free-text work description to caller-supplied MASCO
occupation candidates.

Request fields: `user_description`, optional `extracted` signals (`actions`,
`objects`, `scope`, `industry`), and `candidates` (`code`, `title`, optional
`description`).

Response:

```json
{
  "status": "suggestions",
  "candidates": [
    {
      "occupation_code": "2512",
      "title": "Software developers",
      "confidence": 0.75,
      "evidence": ["..."],
      "difference": "..."
    }
  ],
  "clarifying_questions": []
}
```

`status` is `"clarifying"` with an empty `candidates` array when no supplied
occupation reaches the reliable-fit threshold. At most 5 results are returned.

### `POST /api/v1/ai/occupation-recommendations`

Use this for exploration around a selected occupation. The request contains a
`selected_occupation`, optional `user_context`, and caller-supplied candidates
(`code`, `title`, optional `why_similar`). The response uses the same result item
shape and 5-result maximum as occupation suggestions.

Recommendations are not hiring, employment, wage, job-loss, or timeline
predictions; they only compare the supplied candidate occupations.

### `POST /api/v1/ai/skill-match`

Request fields: `task_text` and caller-supplied skill candidates (`id`, `skill`).
The response is:

```json
{
  "skills": [
    {
      "wef_skill_id": 10,
      "confidence": 0.80,
      "evidence_phrases": ["customer service"]
    }
  ]
}
```

Only supplied skill IDs may be returned; at most 2 skills are returned. Every
`evidence_phrases` value must be an exact substring of the request's `task_text`.
No reliable match returns `{"skills": []}`.

### Permanent single-use Task Assist

All Task Assist routes are authenticated and account-scoped.

`POST /api/v1/ai/task-assist/details` synchronizes up to 50 Task Details before use. Each item contains `profile_task_id`, `task_text`, and optional `notes`. `profile_task_id` is only an account-scoped import key: the server creates or reuses a real `tasks` row and returns its server-generated UUID as `task_id`. The client cannot submit a `user_id` or choose that UUID. Re-registering an already-completed server task does not replace its original context or saved exchange.

`GET /api/v1/ai/task-assist/{task_id}` returns only that user's registered state and saved exchange. Missing or other-user records return `404`.

`POST /api/v1/ai/task-assist` consumes the only question for that Detail. It accepts only:

```json
{
  "task_id": "server-generated-task-uuid",
  "user_message": "How can AI assist me in completing this task?"
}
```

Task text and notes cannot be resubmitted on the answer request; the model receives the registered server-side snapshot. The default frontend question remains exactly `How can AI assist me in completing this task?`.

A completed response is persisted and returned as:

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

PostgreSQL enforces `UNIQUE (user_id, task_id)`, and `(user_id, task_id)` is a composite ownership foreign key to the authenticated user's server-owned task. The atomic pending claim stores the exact submitted question before generation, so concurrent submissions invoke the provider at most once and crash recovery cannot replace an edited question with the default text. Pending rows are never reclaimed for a second provider call; authenticated GET polling converts a stale claim to persisted deterministic fallback. A repeat after completion returns the stored first exchange and does not call the provider. There is no follow-up message, conversation/thread/history field, or endpoint.

Every model input is untrusted data and cannot override the system boundary. Provider output is schema-validated, limited to 1200 characters, checked for high-risk or internal/credential-like disclosure and returned as plain text. Any provider, timeout, malformed-output or safety-validation failure returns deterministic guidance with `generated_by_model: false`; that visible fallback is persisted as the one completed exchange. Both gateway and provider response caches remain disabled so workplace context is stored only in the account-owned Task Assist table, not the shared AI cache. See `docs/backend_Ruiduo/handover/task-assist.md` for the state machine, migration and frontend terminal-state rules.

## Validation and fallback expectations

- Unknown request fields should be rejected where the endpoint schema declares a
  strict request model; malformed bodies return JSON `422` validation errors.
- Empty or unrelated candidate sets must not cause a fabricated result.
- A provider exception or malformed provider payload must be contained at the
  endpoint boundary and converted to a safe empty/clarifying response.
- Contract tests for the four candidate-matching endpoints live in `backend/tests/test_ai_api_contract.py`; they verify route registration, OpenAPI request/response schemas, allowlists, limits, evidence substrings, no-fit behavior, malformed-body behavior, and provider fallback without connecting to an external database.
- Task Assist authentication, registered-context isolation, permanent per-user/per-Detail uniqueness, concurrent claim behavior, repeat-request idempotency, no-cache privacy, provider success/failure, safety rejection and transparent fallback are covered by `backend/tests/test_task_assist.py` and `backend/tests/test_task_assist_persistence.py`; the per-request timeout/retry/cache overrides are covered in `backend/tests/test_ai_provider.py`.
