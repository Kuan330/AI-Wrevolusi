# Iteration 2 — AI API Documentation

Status: implementation delivered on branch `ruiduo` (Iteration 2 AI backend).
Base paths: `/api/v1/ai` (matching endpoints) and `/api/v1/exposure` (assessment extension).

All endpoints are `POST`, accept and return `application/json`.

---

## 1. Shared rules

1. **Candidate-constrained.** The `candidates` list in the request is the complete
   allowlist. The service (and any LLM provider behind it) may only select
   identifiers from that list. Unknown, edited, or invented identifiers are
   removed before the response is serialized. Identifiers are preserved exactly
   (no trimming, case-folding, or fuzzy matching).
2. **Deterministic fallback.** When no LLM provider is configured (`AI_API_KEY`
   empty) or the provider fails (timeout, HTTP 429/5xx, malformed output,
   schema-invalid output, local rate limit), the endpoint returns its
   deterministic result in the same JSON shape. **Provider problems never
   produce a 5xx response and never block the user flow.**
3. **User confirmation.** Every response carries `needs_user_confirmation: true`.
   Results are suggestions for the user to review, edit, or reject; they are not
   persisted automatically.
4. **No prohibited predictions.** Responses never predict job loss,
   unemployment, replacement dates, or personal skill gaps. The word-level
   guard also strips such claims if a provider returns them.
5. **Validation errors.** Malformed request bodies return JSON `422` errors with
   a `detail` field.

---

## 2. `POST /api/v1/ai/task-match`

Match a user-described task against caller-supplied ILO task candidates.

Request:

```json
{
  "occupation_code": "5222",
  "user_task": "prepare weekly sales report",
  "candidates": [
    {"id": "task-1", "text": "prepare weekly sales reports"},
    {"id": "task-2", "text": "stock shelves and receive deliveries"}
  ]
}
```

Matched response:

```json
{
  "candidate_id": "task-1",
  "confidence": 0.91,
  "matched_concepts": ["prepare", "weekly", "sales", "report"],
  "unmatched_concepts": [],
  "reason": "The selected candidate shares the strongest task concepts with the user description.",
  "clarifying_question": null,
  "needs_user_confirmation": true
}
```

No reliable fit (below the 0.50 confidence floor):

```json
{
  "candidate_id": "",
  "confidence": 0.31,
  "matched_concepts": ["satellites"],
  "unmatched_concepts": ["deep", "space"],
  "reason": "No supplied candidate matched the task with at least 0.50 confidence.",
  "clarifying_question": "Could you describe the main steps of the task or choose the closest supplied candidate?",
  "needs_user_confirmation": true
}
```

Notes:

- `candidate_id` is `""` when nothing reaches the confidence floor; a
  `clarifying_question` is then always present.
- Concept arrays are bounded at 50 items each.

---

## 3. `POST /api/v1/ai/occupation-suggestions`

Suggest unit occupations (4-digit MASCO codes) for a free-text work
description. Run the existing SQL search first; call this endpoint when the
search is low-confidence, passing the retrieved candidates.

Request:

```json
{
  "user_description": "I design and build software applications and debug code.",
  "extracted": {
    "actions": ["design", "build", "debug"],
    "objects": ["software applications", "code"],
    "scope": ["product team"],
    "industry": ["technology"]
  },
  "candidates": [
    {"code": "2512", "title": "Software developers", "description": "Design, build, test, and maintain software applications."},
    {"code": "2221", "title": "Nursing professionals", "description": "Provide patient care and support clinical treatment."}
  ]
}
```

Response:

```json
{
  "status": "suggestions",
  "candidates": [
    {
      "occupation_code": "2512",
      "title": "Software developers",
      "confidence": 0.75,
      "evidence": ["Shared supplied terms: applications, build, design, software."],
      "difference": "The user description includes terms not present in the supplied candidate details: code, debug."
    }
  ],
  "clarifying_questions": [],
  "needs_user_confirmation": true
}
```

No reliable fit:

```json
{
  "status": "clarifying",
  "candidates": [],
  "clarifying_questions": ["What are the main activities you perform?"],
  "needs_user_confirmation": true
}
```

Notes:

- At most 5 results are returned.
- `title` always comes from the supplied candidate, never from the provider.
- `extracted` is optional; supplying it improves the deterministic ranking.

---

## 4. `POST /api/v1/ai/occupation-recommendations`

Exploratory comparison around a selected occupation. Not hiring advice, not an
employment or wage prediction — only a comparison of supplied candidates.

Request:

```json
{
  "selected_occupation": {"occupation_code": "2512", "title": "Software developers"},
  "user_context": {"interests": ["analysis", "technology"]},
  "candidates": [
    {"code": "2511", "title": "Computer systems analysts", "why_similar": "Analyse software systems and technology requirements."},
    {"code": "2221", "title": "Nursing professionals", "why_similar": "Works directly with patients in clinical settings."}
  ]
}
```

Response uses the same item shape and 5-result maximum as occupation
suggestions; every item includes the constant evidence line
`"Exploration only; this is not hiring advice."`.

---

## 5. `POST /api/v1/ai/skill-match`

Match a task to supplied WEF skill candidates.

Request:

```json
{
  "task_text": "Provide customer service and explain the warranty.",
  "candidates": [
    {"id": 10, "skill": "Service orientation and customer service"},
    {"id": 7, "skill": "Empathy and active listening"}
  ]
}
```

Response:

```json
{
  "skills": [
    {"wef_skill_id": 10, "confidence": 0.9, "evidence_phrases": ["customer service"]}
  ],
  "needs_user_confirmation": true
}
```

Notes:

- At most 2 skills are returned; no reliable match returns `{"skills": [], "needs_user_confirmation": true}`.
- Every `evidence_phrases` value must be an exact substring of `task_text`;
  provider-invented evidence is dropped.
- Only supplied skill IDs may be returned.

---

## 6. Degradation states (all four endpoints)

| Situation | What the API returns |
|---|---|
| No `AI_API_KEY` configured | Deterministic result (identical JSON shape), no network call |
| Provider timeout / transport error | Deterministic result (task-match / occupation endpoints) or safe empty result (skill-match empty array) |
| Provider HTTP 429 / 5xx (after 2 retries) | Same as above; retries use exponential backoff |
| Provider returns malformed/unparseable JSON | Treated as a provider failure; deterministic result |
| Provider output fails schema validation | Treated as a provider failure; deterministic result |
| Provider selects an unknown candidate ID | ID is removed; endpoint answers with the safe fallback/clarifying result |
| Local RPM budget exhausted | Request is not sent; deterministic result |
| Malformed request body | HTTP 422 JSON validation error |

The behavior above is covered by
`backend/tests/test_ai_api_contract.py`, `backend/tests/test_ai_gateway.py`,
`backend/tests/test_ai_provider.py`, `backend/tests/test_ai_task_match.py`,
`backend/tests/test_occupation_ai.py`, and `backend/tests/test_skill_match.py`.

---

## 7. Exposure assessment extension (`POST /api/v1/exposure/assessments`)

The confirmed-task exposure assessment now exposes the score context and can
optionally use an AI task-match judge:

1. `match_layer` gains the value `"llm"`:
   - `exact` — the confirmed task text equals the ILO reference text.
   - `nlp` — deterministic TF-IDF/cosine similarity match.
   - `llm` — the supplied ILO candidates were reviewed by a language model
     (borderline similarity band `0.18 ≤ similarity < 0.5`, or when the caller
     opts in), and the model's selection was kept only after allowlist
     validation. Official scores still come from the database rows.
   - `insufficient_data` — no reliable evidence.
2. New response fields:
   - `score_band`: `"low"` (<0.25) / `"moderate"` (0.25–0.55) / `"high"` (≥0.55).
   - `score_scale`: plain-language description of the 0–1 value.
   - `score_explanation`: source + calculation + band + explicit statement that
     the value is not a date or a job outcome.
3. New request field `prefer_llm_match` (default `false`): ask for an
   AI-assisted match even below the deterministic similarity floor. Without a
   configured provider this flag changes nothing.

Example request:

```json
{
  "occupation_code": "5222",
  "prefer_llm_match": true,
  "confirmed_tasks": [
    {"task_id": "task-1", "task_text": "Prepare staff work schedules and assign duties", "ilo_task_id": "1", "context": {}}
  ]
}
```

Everything in the section 6 degradation table applies here too: if the judge is
unavailable or fails, the deterministic `exact`/`nlp`/`insufficient_data`
result is returned unchanged.
