# 04 — Testing, Verification and Operations

**Runbook for the AI services layer.**
Sources: `backend/tests/`, `backend/app/services/ai_gateway.py`, `backend/app/core/config.py`

## 1. Test strategy

Design goals of the suite:

1. **Offline by contract.** `backend/tests/conftest.py` pins
   `AI_API_KEY=''`, `AI_KEYLESS='false'`, `AI_FALLBACK_ENABLED='false'` —
   environment variables win over `.env`, so no test can reach a provider or
   depend on a developer's local configuration, and the whole provider chain is
   disabled during the run.
2. **Prove the guardrails, not just the happy path.** The suites deliberately
   feed hostile provider output (invented ids, wrong titles, unsafe claims,
   401s, garbage JSON) and assert that the containment holds.
3. **Deterministic engines are tested as the floor.** Every endpoint's local
   engine has its own suite; the LLM layer is a thin, replaceable shell around
   it.

Current state: **101 passed** (`pytest -q`), no network required.

### 1.1 AI-related suites

| File | Tests | Focus |
|------|-------|-------|
| `test_ai_gateway.py` | 12 | Cache, attempt loop, validation, fallback selection, metadata |
| `test_ai_provider.py` | 10 | Chat Completions wire, retries/backoff, error mapping, RPM, cache |
| `test_ai_provider_responses.py` | 7 | Responses-API wire, keyless mode, extra headers, payload parsing |
| `test_ai_provider_fallback.py` | 6 | Priority chain: key first, fallback on failure, auth-failure disable, no-duplicate chain |
| `test_ai_api_contract.py` | 11 | Endpoint contract: allowlist, floors, `needs_user_confirmation`, never-5xx degradation |
| `test_ai_task_match.py` | 8 | Deterministic task matching: scoring blend, floor, concept bounds |
| `test_skill_match.py` | 5 | Rule table, candidate allowlist, verbatim evidence, cap of two |
| `test_occupation_ai.py` | 11 | Suggestion/recommendation scoring, floors, clarifying branches |
| `test_exposure_llm_judge.py` | 14 | Judge consultation rules, borderline band, `prefer_llm_match`, failure containment, deterministic fallback kept |

### 1.2 What the suites prove (selection)

- A provider that returns a candidate id not in the request → response id is
  cleared, clarifying question added (`test_ai_api_contract`, task-match).
- A provider that returns skill evidence not present in the task → item
  dropped (`_retain_task_evidence`).
- Provider 401/403 → that call uses the fallback **and** the primary is
  disabled for the process (`test_ai_provider_fallback`).
- Provider timeout / 500 / malformed JSON → local engine result, HTTP 200.
- Judge unavailable or failing → deterministic exposure assessment unchanged.
- Confidence floors: below them, the API returns an empty selection plus a
  clarifying question — never a forced match.

## 2. Running everything

```bash
cd backend
.venv/Scripts/python.exe -m pytest -q                 # full suite (Windows venv)
.venv/Scripts/python.exe -m pytest -q tests/test_ai_provider_fallback.py -v
```

Manual smoke against a live server (any key configuration):

```bash
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000

curl -s http://127.0.0.1:8000/api/healthz
curl -s -X POST http://127.0.0.1:8000/api/v1/ai/skill-match \
  -H 'Content-Type: application/json' \
  -d '{"task_text":"Managing a shop team and handling customer complaints",
       "candidates":[{"id":10,"skill":"Service orientation and customer service"},
                     {"id":16,"skill":"Instructing"}]}'
```

## 3. Observed runtime behaviour

| Aspect | Behaviour |
|--------|-----------|
| First LLM call on the free relay | 5–30 s (observed 10–27 s; one 14 s example in final smoke) |
| Cached repeat call | instant (gateway + provider caches) |
| Configured provider | typically single-digit seconds |
| Deterministic path | milliseconds |
| Endpoint availability | 100% — all failure paths return valid 200 responses |
| Rate limiting | enforced per provider (`AI_RPM_LIMIT`, default 60 rpm) |

### 3.1 How to tell which path served a request

- `backend` logs (logger `app.services.ai_gateway`):
  - `primary AI provider failed (status 401); using the OpenCode fallback for this call`
  - `primary AI provider disabled for this process after an authentication failure; fix the credentials and restart the backend to re-enable it`
  - `AI provider is not configured (no AI_API_KEY and the OpenCode fallback is disabled); AI endpoints run on deterministic logic only.`
  - `AI_EXTRA_HEADERS was not valid JSON and was ignored` (and similar config-safety warnings)
- Gateway metadata (`GatewayResult.metadata`: `provider`, `used_fallback`,
  `cached`, `attempts`, `elapsed_ms`, `error`) is available to tests and future
  diagnostics.
- In the UI, an exposure assessment that actually used the LLM shows
  `Evidence method: LLM-reviewed task match`.

## 4. Operations runbook

| Task | Action |
|------|--------|
| Disable the LLM layer entirely | Set `AI_FALLBACK_ENABLED=false` and clear `AI_API_KEY`; restart backend. Endpoints keep working deterministically |
| Enable a paid/company provider | Set `AI_API_KEY` (+ `AI_BASE_URL` / `AI_MODEL` / `AI_API_MODE` if non-OpenAI); restart |
| Rotate a broken key | Fix `.env`, restart the backend — a 401-disabled primary only re-arms on restart/hot reload |
| Use the free relay only | Leave `AI_API_KEY` empty; the fallback runs alone (no key, no account) |
| Tune latency | Lower `AI_TIMEOUT_SECONDS`; raise `AI_CACHE_SIZE`; keep `AI_MAX_RETRIES` small on slow relays |

### 4.1 Troubleshooting

| Symptom | Likely cause | Check / fix |
|---------|--------------|-------------|
| Endpoints answer fast, clearly deterministic, no LLM effect | No provider configured, or chain disabled | Look for the "not configured" warning; check `.env` still contains the AI block (a synced/overwritten `.env` is the classic cause) |
| First call very slow, later instant | Free relay + cache behaviour | Expected; configure a key for faster responses |
| `primary AI provider failed` repeats every call with 401 | Bad key | Fix `.env`, restart backend (process caches the disabled state) |
| Fallback errors `MissingSessionID` / model 503 | Wrong wire mode for the relay | The built-in fallback already pins `responses` + `x-opencode-session`; a custom relay may need `AI_API_MODE`/`AI_EXTRA_HEADERS` |
| Tests suddenly hit the network | `conftest.py` bypassed or env vars overridden | Run tests from `backend/`; keep the pinned env vars |

The chain is **default-on** (`AI_FALLBACK_ENABLED=true`) so that a missing or
overwritten configuration cannot silently disable the LLM layer while the API
keeps answering — the relay takes over, and configuring `AI_API_KEY` upgrades
the chain to the preferred provider with zero code changes.

## 5. Extending the layer

Adding another AI-shaped operation:

1. Define strict Pydantic request/response schemas (bounded lengths, enums,
   `needs_user_confirmation`).
2. Write the **deterministic local engine first** (offline, candidate-safe) —
   it is the floor every failure lands on.
3. Add the route calling `gateway.run_candidate_constrained(...)` with
   `local=`, `fallback=`, `candidate_key=`, and
   `prefer_local_on_provider_failure=True`; add a `post_validate` hook if the
   operation has extra invariants (e.g. verbatim evidence).
4. Extend the contract tests: hostile provider output, floors, degradation.

Provider changes never require touching routes: everything goes through
`AIGatewayProvider`, and `default_ai_gateway()` / `reset_default_ai_gateway()`
provide the seam for tests and hot reloads.

## 6. Verification checklist used for the Iteration 2 hand-off

- [x] `pytest -q` → **101 passed** (fully offline)
- [x] Live smoke: `/ai/skill-match` and `/ai/task-match` return 200 through
      the gateway on both the direct port and the Vite proxy
- [x] Chain fallback: invalid key → 401 → automatic fallback → successful
      response (logged)
- [x] Exposure integration: `match_layer` values observed in real output
      (`exact`, `nlp`, `llm`, `insufficient_data`)
- [x] Frontend build (`tsc + vite`) passes with the AI service integration
