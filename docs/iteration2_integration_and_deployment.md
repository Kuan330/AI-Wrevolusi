# Iteration 2 — Integration & Deployment Guide

How to configure, run, and verify the Iteration 2 AI backend locally and on
Vercel. All AI features are optional: **without configuration everything still
works on the deterministic path.**

---

## 1. Environment variables

Add these to `backend/.env` locally (never commit real keys):

| Variable | Default | Effect |
|---|---|---|
| `AI_API_KEY` | *(empty)* | Enables the OpenAI-compatible provider. **Empty without `AI_KEYLESS=true` = deterministic only.** |
| `AI_BASE_URL` | `https://api.openai.com/v1` | Any OpenAI-compatible endpoint (OpenAI, OpenRouter-style proxies, local gateways) |
| `AI_MODEL` | `gpt-4o-mini` | Model name sent to the provider |
| `AI_API_MODE` | `chat_completions` | Wire protocol: `chat_completions` or `responses` (some relays/models are served on one only) |
| `AI_KEYLESS` | `false` | `true` = call the endpoint without any credential (anonymous free relays) |
| `AI_EXTRA_HEADERS` | *(empty)* | Optional JSON object of extra request headers, e.g. `{"Authorization": "", "x-opencode-session": "my-app"}` |
| `AI_TIMEOUT_SECONDS` | `20` | Per-request timeout |
| `AI_MAX_RETRIES` | `2` | Retries after the first attempt (0 disables) |
| `AI_RPM_LIMIT` | `60` | Local requests-per-minute guard; bursts degrade to deterministic results |
| `AI_CACHE_SIZE` | `128` | Provider response LRU cache entries (0 disables) |

Notes:

- `AI_*` is separate from the existing `SKILL_LLM_*` variables used by the
  skill-directions feature; they can share the same key but are configured
  independently.
- The backend also reads the repository-root `.env`; put real values only in
  `backend/.env` (git-ignored).

---

## 2. Local run

```bash
# Terminal 1 — backend
cd backend
.venv/Scripts/python.exe -m uvicorn app.main:app --reload

# Terminal 2 — frontend
cd frontend
npm run dev
```

- Backend: http://127.0.0.1:8000 (docs at `/docs`)
- Frontend: http://127.0.0.1:5173 (proxies `/api` to the backend)

Windows note: use `start_project.local.bat` in the repository root to launch
both at once. The first backend start can take tens of seconds while Python
imports resolve (OneDrive-hosted working copy); the frontend may briefly show
`ECONNREFUSED` until port 8000 is listening.

---

## 3. Verification

### 3.1 Deterministic path (no key needed)

```bash
curl -s http://127.0.0.1:8000/api/healthz
# {"status":"ok"}

curl -s -X POST http://127.0.0.1:8000/api/v1/ai/task-match \
  -H "Content-Type: application/json" \
  -d '{"occupation_code":"5222","user_task":"prepare weekly sales report",
       "candidates":[{"id":"task-1","text":"prepare weekly sales reports"}]}'
# {"candidate_id":"task-1", ..., "needs_user_confirmation":true}

curl -s -X POST http://127.0.0.1:8000/api/v1/ai/skill-match \
  -H "Content-Type: application/json" \
  -d '{"task_text":"Provide customer service.","candidates":[{"id":10,"skill":"Service orientation and customer service"}]}'
# {"skills":[{"wef_skill_id":10, ...}], "needs_user_confirmation":true}
```

### 3.2 LLM path

1. Configure the provider in `backend/.env` and restart the backend. Two shapes
   are supported:
   - **Keyed endpoint** (OpenAI, proxies, ...): set `AI_API_KEY` (and optionally
     `AI_BASE_URL` / `AI_MODEL`).
   - **Keyless relay** (anonymous free tiers, e.g. the OpenCode Zen free
     models): set `AI_KEYLESS=true`, the matching `AI_API_MODE` (Muse Spark is
     served on `responses` only) and any required headers via
     `AI_EXTRA_HEADERS` — the free tier rejects non-empty bearers and needs the
     `x-opencode-session` session-affinity header.
2. Repeat the curl calls above — same JSON shape, now potentially ordered by
   the provider.
3. To confirm the fallback still works, temporarily set an invalid key or an
   unreachable `AI_BASE_URL`: responses stay HTTP 200 with deterministic
   results, and a warning appears in the backend log
   (`app.services.ai_gateway`).
4. Cost reminder: each unique request that misses the cache may call the
   provider; the LRU cache absorbs repeated identical requests.
5. Latency: reasoning models on free relays can take 5–30 seconds per uncached
   request; the frontend stays usable while a request is in flight and falls
   back silently if the provider does not answer within `AI_TIMEOUT_SECONDS`.

### 3.3 Test suites and build

```bash
cd backend && .venv/Scripts/python.exe -m pytest -q      # expect: 95 passed
# Local .env has a live provider? Keep the suite offline with:
# AI_KEYLESS=false AI_API_KEY= .venv/Scripts/python.exe -m pytest -q
cd frontend && npm run build                              # expect: build success
```

---

## 4. Vercel deployment

The repository deploys as one Vercel Services project (`/` frontend, `/api`
backend). For Iteration 2:

1. Add the `AI_*` variables from section 1 under **Preview and Production**
   environment variables (values are secrets; never commit them).
2. Leave `AI_API_KEY` unset in Preview if the team prefers deterministic
   previews; the endpoints degrade automatically.
3. After deploy, verify: `/api/healthz`, one `/api/v1/ai/task-match` call, and
   one exposure assessment (`/api/v1/exposure/assessments`) with the standard
   staging test account.
4. Rollback: removing the `AI_*` variables restores deterministic-only behavior
   with no code change.

---

## 5. Troubleshooting

| Symptom | Cause | Action |
|---|---|---|
| `ECONNREFUSED 127.0.0.1:8000` in frontend | Backend not running / still importing | Start backend, wait for "Uvicorn running" |
| AI responses look identical with/without key | Allowlist/confidence rules filtered provider output, or cache hit | Expected; try a different task text |
| Warning in logs: "AI provider is not configured" | `AI_API_KEY` empty and `AI_KEYLESS` false | Set the key (or `AI_KEYLESS=true`) in `backend/.env` and restart |
| Provider 401/403 in logs, responses still 200 | Key or base URL wrong | Fix `AI_*` values; endpoints keep working deterministically |
| Free-relay 400/500 errors in logs, responses still 200 | Relay gating (missing session header, non-empty bearer on a keyless tier, or a model served on a different wire) | Align `AI_EXTRA_HEADERS` / `AI_API_MODE` with the relay contract; deterministic fallback keeps the UI usable |
| Rate-limit warning | `AI_RPM_LIMIT` reached | Raise the limit or reduce traffic; bursts are safe by design |

---

## 6. Deliverable placement

For PGP, upload these documents under
`Iteration Build/iteration2/`:

- `docs/iteration2_ai_api_documentation.md`
- `docs/iteration2_backend_design.md`
- `docs/iteration2_integration_and_deployment.md`

with the API contract `docs/ai_api_contract.md` as the implementation
reference.
