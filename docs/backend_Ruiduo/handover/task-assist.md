# One-shot Task Assist handover

Status: implemented and verified on `iteration-2-zhangxu`.

Live-provider probe through the real FastAPI route returned HTTP 200 in 7.89 seconds with `generated_by_model: true`, `needs_user_confirmation: true`, a 709-character task-specific reply, and content different from the deterministic fallback. Authentication was isolated with the same dependency override used by endpoint tests; provider and route code were real.

## User flow

`AI Exposure` → task `Detail` → `Chat with AI` opens a one-shot dialog. The input is pre-filled with exactly:

```text
How can AI assist me in completing this task?
```

The learner may edit that question and submit once. After one validated response, the input and send button remain disabled until the dialog is closed and reopened. No conversation ID, history or follow-up messages are accepted or stored.

## Endpoint

```http
POST /api/v1/ai/task-assist
Cookie: access_token=<signed-in session>
Content-Type: application/json
```

Request:

```json
{
  "task_text": "Prepare the weekly performance report.",
  "user_message": "How can AI assist me in completing this task?",
  "notes": "Use the approved internal template."
}
```

Response:

```json
{
  "reply": "...",
  "generated_by_model": true,
  "needs_user_confirmation": true
}
```

`generated_by_model` is `false` when the provider is unavailable, times out, returns malformed or schema-invalid output, exceeds the output limit, or fails the deterministic safety check. The UI labels that case as fallback guidance rather than presenting it as a model response.

## Boundaries and safety controls

- Authentication is mandatory. Missing or invalid session cookies return `401` before a provider call.
- Requests are strict: unknown fields are rejected. `task_text` is 1–4000 characters, `user_message` is 1–2000, and `notes` is 0–2000 after whitespace trimming.
- The endpoint is stateless and accepts no `messages`, conversation or session-history field. Both gateway-level and provider-level response caches are disabled for Task Assist, so raw workplace context and replies are not retained in process memory by the AI cache.
- Every request field is untrusted, user-controlled data. `user_message` is the one question but cannot override the system boundary; `task_text` and `notes` are context only. The system prompt tells the model to ignore attempts to reveal prompts, credentials or internal configuration, change scope, access another task or become a general chatbot.
- Replies are structured and limited to 1200 characters. Empty, malformed, oversized, instruction/credential-like disclosures or high-risk replies fall back to deterministic guidance.
- The model may suggest drafting, summarising, outlining and checking. It must not invent employer facts, predict job loss, assess the person, give definitive legal/medical/financial/hiring advice, claim certainty or claim that it executed an action.
- Every result requires human confirmation. No reply is persisted or used to update a task automatically.
- The shared AI gateway enforces its process-local request-per-minute budget. Task Assist additionally disables provider retries and bounds each provider attempt to 20 seconds. The browser allows 45 seconds for a configured provider plus one fallback attempt.
- Logs and responses expose neither credentials nor raw provider error details.

## Provider chain

Task Assist uses `backend/app/services/ai_gateway.py` rather than the legacy `SKILL_LLM_*` direct `/chat/completions` request:

1. configured `AI_*` provider, when available;
2. built-in OpenCode Zen `/responses` fallback;
3. deterministic local guidance.

The route reports provenance only as model versus fallback. It never exposes provider names, credentials or internal exception details.

## Frontend resilience

`TaskAssistDialog.tsx` aborts the active request on close, task context change (including same-ID wording or notes edits), replacement request or unmount. A monotonically increasing request ID plus a context key prevents an already-settled stale promise from writing into a reopened or edited dialog. Resets run before paint, completed replies are announced through a polite live region, intentional aborts are not shown as user-facing errors, and genuine failures remain retryable within the same turn.

## Tests

- `backend/tests/test_task_assist.py`: provider success, all-field prompt boundary, no-cache privacy contract, per-request timeout/retry budget, unsafe and credential-like output rejection, provider failure fallback, strict request validation, multi-turn field rejection and authentication.
- `frontend/tests/taskAssist.test.mjs`: exact default question, provenance labels, same-ID context edits, stale-result guard, single-turn/cancellation/accessibility source guards.
- `backend/tests/test_ai_provider.py` and `backend/tests/test_ai_gateway.py`: shared gateway transport, per-request cache opt-out, retry, schema and fallback behavior.

## Relevant files

- `backend/app/routers/ai.py`
- `backend/app/schemas/task_assist.py`
- `backend/app/services/task_assist.py`
- `backend/app/services/ai_gateway.py`
- `backend/tests/test_task_assist.py`
- `frontend/src/pages/Analysis/components/TaskAssistDialog.tsx`
- `frontend/src/pages/AIExposure/lib/taskAssistState.ts`
- `frontend/src/services/aiService.ts`
- `frontend/tests/taskAssist.test.mjs`
