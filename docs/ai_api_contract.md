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

### `POST /api/v1/ai/task-assist`

This authenticated endpoint provides one stateless answer about the current task. It accepts only `task_text`, `user_message`, and optional `notes`; conversation history and unknown fields are rejected. The default frontend question is `How can AI assist me in completing this task?`.

```json
{
  "reply": "...",
  "generated_by_model": true,
  "needs_user_confirmation": true
}
```

Every request field is untrusted, user-controlled data; the one `user_message` question cannot override the system boundary, and task context/notes are never system instructions. Provider output is schema-validated, limited to 1200 characters, checked for high-risk or internal/credential-like disclosure and returned as plain text. Any provider, timeout, malformed-output or safety-validation failure returns deterministic guidance with `generated_by_model: false`. The endpoint never persists a conversation or changes task data, and it disables both gateway and provider response caches so workplace context is not retained by the AI cache. See `docs/backend_Ruiduo/handover/task-assist.md` for the complete boundary and frontend lifecycle.

## Validation and fallback expectations

- Unknown request fields should be rejected where the endpoint schema declares a
  strict request model; malformed bodies return JSON `422` validation errors.
- Empty or unrelated candidate sets must not cause a fabricated result.
- A provider exception or malformed provider payload must be contained at the
  endpoint boundary and converted to a safe empty/clarifying response.
- Contract tests for the four candidate-matching endpoints live in `backend/tests/test_ai_api_contract.py`; they verify route registration, OpenAPI request/response schemas, allowlists, limits, evidence substrings, no-fit behavior, malformed-body behavior, and provider fallback without connecting to an external database.
- Task Assist authentication, strict single-turn input, all-field prompt isolation, no-cache privacy, provider success/failure, safety rejection and transparent fallback are covered by `backend/tests/test_task_assist.py`; the per-request timeout/retry/cache overrides are covered in `backend/tests/test_ai_provider.py`.
