# Iteration 2 — Backend Design & Architecture

This document describes how the Iteration 2 AI backend is structured, how a
request flows through the gateway, and which safety rules are enforced before
any AI output can reach an API response.

---

## 1. Components

| File | Responsibility |
|---|---|
| `backend/app/routers/ai.py` | The four `/api/v1/ai/*` endpoints; dependency seams for providers |
| `backend/app/routers/exposure.py` | Exposure assessment endpoint; optional LLM judge dependency |
| `backend/app/services/ai_gateway.py` | `AIGateway` (validation, fallback, candidate constraint) and `OpenAICompatibleProvider` (HTTP adapter: retries, cache, rate limit) |
| `backend/app/services/ai_matching.py` | Deterministic task matching + `enforce_task_match_contract` allowlist/confidence enforcement |
| `backend/app/services/occupation_ai.py` | Deterministic occupation suggestion/recommendation ranking |
| `backend/app/services/skill_matching.py` | Deterministic WEF skill matching with exact-substring evidence |
| `backend/app/services/ai_task_judge.py` | `LLMTaskMatchJudge`: optional, never-raising judge used by the exposure assessment |
| `backend/app/services/exposure.py` | Confirmed-task exposure assessment; borderline-band judge wiring; score context |
| `backend/app/schemas/*.py` | Pydantic contracts for requests/responses, including `needs_user_confirmation` |

---

## 2. Request flow

```
Client request
  │
  ▼
Router (fastapi) ──▶ AIGateway.run_structured / run_candidate_constrained
  │                        │
  │                        ├─ 1. cache lookup (validated responses)
  │                        ├─ 2. provider configured?  ── yes ──▶ OpenAICompatibleProvider.complete_json
  │                        │                                            │
  │                        │              (retries, backoff, LRU cache, RPM guard, JSON parse,
  │                        │               schema validation — all failures raise AIProviderError)
  │                        │                                            │
  │                        │◀──────────── success: raw JSON ────────────┘
  │                        ├─ 3. Pydantic validation of provider output
  │                        └─ 4. candidate constraint (allowlist + confidence floors + evidence rules)
  │
  ├─ provider absent or failed
  │      └─▶ deterministic local result (same JSON shape)  [fallback metadata recorded]
  ▼
Response (always HTTP 200 for handled cases; 422 only for malformed request bodies)
```

The exposure assessment adds one more path: `LLMTaskMatchJudge` may be
consulted for borderline deterministic similarities. The judge never raises —
any failure returns `None` and the deterministic result is kept.

---

## 3. Candidate-constraint enforcement

| Layer | Rule |
|---|---|
| Request schema | Candidate IDs must be non-blank and unique; lists are bounded (≤100/≤500) |
| Provider prompt | The system prompt states: only use supplied identifiers; never invent scores, links, or definitions; no job-loss/timeline predictions |
| Gateway constraint | Any returned ID outside the allowlist is removed (`candidate_id = ""`, unknown occupations/skills dropped) |
| Confidence floors | task-match ≥ 0.50; occupation suggestions ≥ 0.30; skill evidence must be an exact substring of the task text; below-floor results become empty/clarifying responses |
| Titles/definitions | Occupation titles always come from the request candidate, never from the provider |
| Response | Every response carries `needs_user_confirmation: true`; nothing is auto-persisted |

The deterministic path enforces the same rules, so degrading from LLM to local
never weakens the constraints.

---

## 4. Provider adapter (`OpenAICompatibleProvider`)

- OpenAI-compatible `POST {base_url}/chat/completions` with
  `response_format: {"type": "json_object"}`, `temperature: 0`.
- **Timeout** `AI_TIMEOUT_SECONDS` (default 20s).
- **Retries** `AI_MAX_RETRIES` (default 2) with exponential backoff
  (0.5s, 1s); retryable: transport errors, timeouts, HTTP 408/409/425/429/5xx.
  Non-retryable 4xx (e.g. 401/403/404) fail fast.
- **JSON handling**: markdown code fences are stripped; unparseable content is
  a failure. Output must validate against the endpoint's response model before
  it is returned or cached.
- **Cache**: bounded thread-safe LRU (`AI_CACHE_SIZE`, default 128) keyed by
  SHA-256 over model + operation + request payload. Invalid output is never
  cached.
- **Rate limit**: local requests-per-minute budget (`AI_RPM_LIMIT`, default 60).
  When exhausted the provider refuses to send (fast fail to deterministic
  result) instead of sleeping and blocking the worker thread.

Missing `AI_API_KEY` → the provider is not constructed at all; the process logs
one warning and every endpoint runs fully deterministic.

---

## 5. Degradation policy (never a 5xx, never a blocked flow)

| Failure | Handling |
|---|---|
| No key configured | Deterministic path only |
| Timeout / transport error | Retried; then deterministic result |
| HTTP 429 / 5xx | Retried; then deterministic result |
| Malformed / schema-invalid output | Treated as failure; deterministic result |
| Unknown ID from provider | Stripped by the gateway; safe clarifying/empty response |
| Local RPM exhausted | Request skipped; deterministic result |
| Judge failure (exposure) | Deterministic `nlp`/`insufficient_data` result kept |

All failure handling is contained at the gateway/judge boundary; routers never
propagate provider errors.

---

## 6. Ethics guardrails (mapped to the course requirements)

1. **LLM is an ordering/explanation layer only.** Scores, categories, and
   identifiers always come from reference data (ILO / MASCO / WEF rows) or the
   request allowlist.
2. **No predictions about people.** A word-level guard in `ai_matching.py`
   drops claims such as "job loss", "unemployment", "skill gap" from provider
   text; the exposure layer explicitly labels the score as task-level change,
   not a timeline or outcome.
3. **Human in the loop.** `needs_user_confirmation: true` on every AI
   response; exposure assessments are suggestions ("suggested_state").
4. **Auditability.** Provider output is validated by schema; the match layer
   (`exact` / `nlp` / `llm` / `insufficient_data`) is recorded per assessment so
   users can see how a result was produced.

---

## 7. Test coverage

Run with the backend virtual environment:

```bash
cd backend
.venv/Scripts/python.exe -m pytest -q
```

Current result: **88 passed** (0 failed), including:

- `test_ai_api_contract.py` — HTTP contract, allowlists, limits, no-fit and
  malformed-body behavior, `needs_user_confirmation` on every response.
- `test_ai_provider.py` — provider parsing, code-fence stripping, retries,
  exhaustion, cache, rate limit, settings build, gateway degradation.
- `test_exposure_llm_judge.py` — judge availability, allowlist enforcement,
  borderline-band wiring, opt-in rescue, failure isolation, score-context
  fields, endpoint integration.
- `test_ai_gateway.py`, `test_ai_task_match.py`, `test_occupation_ai.py`,
  `test_skill_match.py` — deterministic layers and gateway fallback paths.

Deprecation warnings remain for `fastapi.on_event` (pre-existing, non-blocking;
migration to lifespan handlers is tracked for a later iteration).
