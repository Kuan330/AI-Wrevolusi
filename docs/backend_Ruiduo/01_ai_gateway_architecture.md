# 01 — AI Gateway Architecture and Provider Layer

**Source:** `backend/app/services/ai_gateway.py` (867 lines), `backend/app/core/config.py`
**Related tests:** `backend/tests/test_ai_gateway.py`, `test_ai_provider.py`, `test_ai_provider_responses.py`, `test_ai_provider_fallback.py`

## 1. Why a gateway exists

The four AI endpoints accept structured input (tasks, skill candidates,
occupation candidates) and must return strictly validated structured output.
An external LLM can be slow, rate-limited, misconfigured, produce malformed
JSON, or invent identifiers. The gateway is the single place that contains all
of this risk:

- Routes never talk to an HTTP provider directly; they call `AIGateway`.
- Every provider response is parsed and validated against a Pydantic response
  model *before* it can reach a route.
- Every failure path terminates in safe logic (deterministic local result or a
  validated fallback response), so an AI problem can never turn into a 5xx.

The gateway is **credential-free by default**: without configuration it runs on
the deterministic engines only, and all endpoints behave identically to the
pre-LLM version.

## 2. Component map

| Component | Location | Role |
|-----------|----------|------|
| `AIGateway` | `ai_gateway.py` | Orchestration: cache, attempt loop, validation, fallback selection |
| `GatewayResult` / `GatewayMetadata` | `ai_gateway.py` | Value + diagnostics (provider, `used_fallback`, `cached`, `attempts`, `elapsed_ms`, `error`) |
| `AIGatewayProvider` (Protocol) | `ai_gateway.py` | The injectable provider seam — `complete_json(operation, payload, response_model)` |
| `OpenAICompatibleProvider` | `ai_gateway.py` | Concrete HTTP provider: any OpenAI-compatible endpoint, two wire modes, keyless support, retry, RPM limit, LRU cache |
| `FallbackProvider` | `ai_gateway.py` | Priority chain: configured provider first, OpenCode free relay as safety net |
| `build_provider_from_settings()` | `ai_gateway.py` | Builds the chain from environment settings; returns `None` for deterministic-only |
| `default_ai_gateway()` / `reset_default_ai_gateway()` | `ai_gateway.py` | Process-local singleton; reset used by tests and hot reload |
| `AIProviderError` | `ai_gateway.py` | Provider-level error carrying optional `status_code` |

FastAPI dependency seams keep this testable:
`backend/app/routers/ai.py` resolves the gateway through `get_ai_gateway()`,
so tests can inject fakes without touching the network.

## 3. Request lifecycle (`AIGateway.run_structured`)

1. **Cache lookup** — the gateway keeps a process-local dict cache keyed by
   `operation + payload`. A hit that still validates against the response model
   returns immediately with `cached=True`.
2. **Provider attempt** (if a provider is attached) — up to `max_attempts`
   calls; each result is validated against the response model. Invalid JSON or
   schema-invalid output counts as an attempt failure.
3. **Cached write** — a successful, validated value is stored so identical
   requests (same task text, same candidates) are served without another call.
   The frontend benefits twice: repeated drawer opens and retries are instant.
4. **Failure resolution** — depending on the route's
   `prefer_local_on_provider_failure` flag:
   - `True` (all four AI routes): run the deterministic local engine through
     the same validation; on success return it with `used_fallback=True`.
   - `False` or local failure: run the route's `fallback` callable (a
     hand-written "safe" response, e.g. an empty selection plus a clarifying
     question) through validation.
5. **Return** — `GatewayResult(value, metadata)`. The routes return
   `result.value`, so the HTTP layer only ever sees a model that passed
   `response_model` validation, or the validated fallback.

### 3.1 Candidate constraint (`run_candidate_constrained`)

The three matching routes that operate on candidate lists wrap
`run_structured` with `_constrain_result`, which enforces the contract on the
*merged* result regardless of whether it came from the LLM or the local engine:

- **Task match (`candidate_id` present)** — an id that is not in the supplied
  candidates is cleared to `''`; if nothing was selected and no clarifying
  question exists, a default one is added.
- **Skill match (`skills` present)** — items whose `wef_skill_id` is not in the
  supplied candidates are dropped.
- **Occupation endpoints (`candidates` present)** — items whose
  `occupation_code` is not supplied are dropped; the `title` is re-sourced from
  the *request candidate* (provider titles are never trusted); if the list
  becomes empty and the status was `suggestions`, it is downgraded to
  `clarifying` with a default question.

This is defence in depth: the system prompt already forbids invented
identifiers, the local engines only emit supplied ids, and the gateway
re-checks anyway.

## 4. The HTTP provider (`OpenAICompatibleProvider`)

### 4.1 Two wire modes

| Mode | `AI_API_MODE` | Endpoint | Body shape |
|------|---------------|----------|------------|
| Chat Completions (default) | `chat_completions` | `POST {base_url}/chat/completions` | `messages[]` + `response_format: {"type": "json_object"}` + `temperature: 0` |
| Responses API | `responses` | `POST {base_url}/responses` | `instructions` (system prompt) + one `input` string; no temperature (reasoning models may reject `0`) |

Both modes send the same logical request: a fixed system prompt
(`_SYSTEM_PROMPT_TEMPLATE`) that states the four behavioural rules (JSON only;
never invent identifiers; never predict job loss; return a clarifying
question instead of forcing a match) plus the JSON Schema of the expected
`response_model`; and a user payload of `{"operation": ..., "request": ...}`.

Parsing is mode-specific: Chat Completions reads
`choices[0].message.content`; Responses aggregates `output[].content[]` parts
of type `output_text`/`text` (falling back to a top-level `output_text`).
Both tolerate markdown code fences around the JSON (`_load_message_json`).

The Responses mode exists because some relays serve models *only* on that wire
— the OpenCode Zen relay used as the free fallback returns 503 for
`muse-spark-1.3-contributor-free` on `/chat/completions`.

### 4.2 Keyless relays

Some free relays are anonymous by design. With `AI_KEYLESS=true` (or when
building the built-in fallback), the provider sends an **explicitly empty
`Authorization` header** (`Authorization: ''`), which is what keyless relays
expect; extra headers (e.g. `x-opencode-session`) are supplied through
`AI_EXTRA_HEADERS`, a leniently parsed JSON object — invalid JSON is logged and
ignored so a typo in `.env` can never prevent the provider from starting.

### 4.3 Resilience mechanics (inside `complete_json`)

| Mechanism | Behaviour |
|-----------|-----------|
| Retries | `max_retries + 1` attempts with exponential backoff `0.5s, 1s, 2s, ...` (`backoff_base_s * 2^(attempt-1)`) |
| Retryable statuses | `408, 409, 425, 429, 500, 502, 503, 504` — retried |
| Non-retryable errors | Other `>= 400` statuses raise `AIProviderError(status_code=...)` immediately (no pointless retries on 401/403/404) |
| Transport errors | Timeouts and `httpx` transport failures are retried |
| Unusable content | Parse failures and schema-invalid output are retried, then raise |
| Response cache | Per-provider `_BoundedLruCache` (default 128 entries, `AI_CACHE_SIZE`) — identical operation+payload pairs are served from memory |
| Rate limiting | `_consume_rate_limit_slot()` keeps request starts under `AI_RPM_LIMIT` requests/minute (sliding window) before every attempt |
| Thread safety | Mutex around the rate-limit deque and cache; the provider is safe to share across FastAPI's threadpool |

## 5. Provider selection and the fallback chain

`build_provider_from_settings()` assembles the chain at first use:

```
AI_API_KEY present (or AI_KEYLESS=true)  ──►  primary = OpenAICompatibleProvider
                                              (AI_BASE_URL / AI_MODEL / AI_API_MODE / AI_EXTRA_HEADERS)
AI_FALLBACK_ENABLED=true (default)       ──►  fallback = OpenCode free relay
                                              (https://opencode.ai/zen/v1,
                                               muse-spark-1.3-contributor-free,
                                               keyless, responses wire,
                                               x-opencode-session header)
primary + fallback                       ──►  FallbackProvider(primary, fallback)
```

- The fallback is skipped when it would duplicate the primary (same base URL
  and model).
- If neither can be built (no key, fallback disabled), the function returns
  `None`, the gateway runs deterministic-only, and a warning is logged once:
  *"AI provider is not configured … AI endpoints run on deterministic logic only."*

### 5.1 `FallbackProvider` semantics

- The **primary (configured key) is tried first** on every call — a valid
  configured provider is always preferred over the free relay.
- Any failure (rejected credential, outage, timeout, unusable output) routes
  **that call** to the fallback, which is logged:
  `primary AI provider failed (status 401); using the OpenCode fallback for this call`.
- After an **authentication failure** (401/403) the primary is disabled for the
  rest of the process, so a dead key cannot slow every request down. Fixing the
  key requires a backend restart (or a hot reload) to re-enable it.
- Non-auth failures do not disable the primary — the next call tries it again,
  so a transient provider outage automatically self-heals.

This gives the requested priority order: **configured key first → built-in
OpenCode free relay → deterministic engine**, with zero configuration needed
for teammates to benefit from the LLM layer.

## 6. Configuration reference

All settings live in `backend/app/core/config.py` and are read from
`backend/.env`. Values are optional; the safe default is "no LLM".

| Variable | Default | Meaning |
|----------|---------|---------|
| `AI_API_KEY` | *(empty)* | Key for any OpenAI-compatible provider. Empty ⇒ primary skipped |
| `AI_BASE_URL` | `https://api.openai.com/v1` | Provider base URL |
| `AI_MODEL` | `gpt-4o-mini` | Model name |
| `AI_API_MODE` | `chat_completions` | `chat_completions` or `responses` |
| `AI_KEYLESS` | `false` | Send an empty bearer instead of a key |
| `AI_EXTRA_HEADERS` | `''` | JSON object of extra request headers |
| `AI_TIMEOUT_SECONDS` | `20` | Per-request timeout (1–180) |
| `AI_MAX_RETRIES` | `2` | Retries inside the provider (0–5) |
| `AI_RPM_LIMIT` | `60` | Requests-per-minute ceiling |
| `AI_CACHE_SIZE` | `128` | Provider-level LRU entries (0 disables) |
| `AI_FALLBACK_ENABLED` | `true` | Enable the built-in OpenCode free relay as fallback |
| `AI_FALLBACK_BASE_URL` | `https://opencode.ai/zen/v1` | Fallback base URL |
| `AI_FALLBACK_MODEL` | `muse-spark-1.3-contributor-free` | Fallback model |

**Operational tip:** the built-in fallback has no uptime guarantee (it is a
third-party free service). When it is unavailable, endpoints degrade silently
to the deterministic engines; configuring `AI_API_KEY` restores the LLM layer
without touching any code.

## 7. Degradation matrix

| Situation | What the caller sees |
|-----------|----------------------|
| No key, fallback disabled | Deterministic result, normal 200 |
| No key, fallback enabled | Free relay result (slower first call), normal 200 |
| Configured key works | Configured provider result, normal 200 |
| Configured key rejected (401/403) | Fallback result for all calls; primary disabled until restart |
| Provider timeout / 5xx / rate limit | Retried with backoff, then falls back; still 200 |
| Provider returns malformed or schema-invalid JSON | Same as above; local engine result with `used_fallback=True` |
| Everything fails | Validated static fallback (empty selection + clarifying question), still 200 |
| Cache hit | Instant response, `cached=True` |

The routes receive `GatewayResult.value` only; the metadata travels alongside
for tests and diagnostics.
