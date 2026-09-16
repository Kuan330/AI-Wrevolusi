# Iteration 2 — Realtime Task Match and Fuzzy Occupation Search

Delivery note for the two interaction-layer increments built on top of the
existing candidate-constrained AI endpoints. Intended for the PGP
`Iteration Build/iteration2/` folder together with the other Iteration 2
documents.

## 1. Automatic task match with a 5-word gate

### 1.1 Trigger rules

The task editor ("Add a task" / "Edit task") now runs the standard-task check
**automatically while the user types** — the previous "Find closest standard
task" button has been removed. The check calls the existing
`POST /api/v1/ai/task-match` endpoint; no other behaviour of that endpoint
changed.

A check only starts once the input contains **at least 5 meaningful words**.
The same counting rule is applied on both sides so the client and the server
can never disagree:

| Rule | Detail |
|------|--------|
| What is a word | A token of Unicode letters/digits (case-insensitive). |
| Stop words | Tokens in the shared stop-word list (`a`, `an`, `and`, `are`, … `with`) do not count. |
| Duplicates | Repeated words still count (the rule counts occurrences, not distinct words). |
| Scripts without spaces | A Chinese run without spaces counts as one word per run; mixed input is counted with the same rule. |
| Threshold | `MINIMUM_TASK_MATCH_WORDS = 5` (backend constant; mirrored in the client). |

Shared implementation:

- backend: `count_task_text_words_for_matching` in
  `backend/app/services/ai_matching.py` (reuses the matcher's tokeniser);
- frontend: `frontend/src/pages/WorkProfile/taskMatchWords.ts` (mirror of the
  same rule);
- both test suites assert the **same example table** so the two
  implementations cannot drift apart.

Examples (asserted in both suites): `""` → 0, `"the and of"` → 0,
`"shop supervisor"` → 2, `"Managing a small team of staff"` → 4,
`"Prepare weekly sales report data"` → 5 ✓, `"负责管理团队排班并跟进客户投诉处理"` → 1.

### 1.2 Interface behaviour changes

`TaskMatchResponse` gains one **additive** field:

| `status` value | Meaning |
|----------------|---------|
| `needs_more_input` | The task text is below the word gate. Returned **without running the matcher**; `candidate_id` is empty, `confidence` is 0, and a clarifying question explains the gate. |
| `matched` | One of the supplied candidates was selected. |
| `no_match` | The matcher ran but no reliable candidate exists (previous behaviour). |

All existing fields keep their meaning; the four `/ai/*` endpoints still never
return a non-200 response and never invent identifiers. Requests below the
gate are answered in under a millisecond (measured) because they short-circuit
before the matcher and the AI provider.

### 1.3 Frontend interaction

- **Debounce** 500 ms after the last keystroke; rapid typing sends a single
  request.
- **AbortController** cancels in-flight requests when the input changes, so a
  slow response can never overwrite newer typing.
- **Loading** shows a light "Checking…" hint while the request is pending.
- **Below the gate**: the request is never sent; the panel shows
  "Keep typing — matching starts after 5 words." and clears any stale result.
- **Failure**: the previous suggestion stays visible and a small "Retry"
  action re-runs the check (the endpoint's deterministic fallback semantics
  are unchanged).
- **Consistency**: the manual button is gone everywhere; matching is purely
  automatic (plus the failure retry).

## 2. Fuzzy occupation title search

### 2.1 What changed

`GET /api/v1/reference/occupations?q=...` previously performed a SQL `ILIKE`
substring match only, so small wording differences (plurals, word order,
typos) returned nothing. The endpoint now keeps its parameters and direct
hits and **adds a token-level fuzzy recall layer**:

- tokenisation and stop-word handling are reused from `ai_matching.py` (the
  same normalisation the AI endpoints use);
- matching is per token, so word order does not matter;
- typo tolerance: at most **2 edits** (Levenshtein) for words of 5+ characters,
  1 edit for 4-character words, exact match below that;
- Chinese / mixed input: words that cannot match the English reference text
  cannot produce hits by themselves. When a query containing such words finds
  nothing and the AI gateway is available, an optional keyword normaliser asks
  the model for English search keywords and re-runs the deterministic search
  with them (the normaliser can only steer the search; every returned row is
  still a `ref_occupations` row). Without a provider the result is an empty
  list — nothing is guessed.

### 2.2 Response additions (additive)

Each search result row keeps its existing fields and gains:

| Field | Content |
|-------|---------|
| `confidence` | Relevance of the row for this query (0–1). |
| `evidence` | The terms that produced the match, e.g. `title close to "supervisor" (edit distance 1)` or `English search keywords from your description: store, shop, …`. |
| `match_type` | `direct` (SQL substring hit, always preserved) or `fuzzy` (token recall). |

Rows are sorted by relevance (direct hits win ties). When nothing is
reliable the endpoint returns an empty list and the UI keeps its "No matching
occupations found" guidance; the `occupation-suggestions` endpoint is
unchanged and remains the next layer for future UI entries.

### 2.3 Frontend interaction

- Debounce raised to 400 ms; superseded requests are aborted (in addition to
  the existing request-id race guard).
- Empty query keeps the previous default behaviour (no search).
- Results display the ranked list plus a small line with the match confidence
  and up to two evidence entries.

### 2.4 Measured performance (live backend, real database)

| Operation | Observed |
|-----------|----------|
| Fuzzy search request | 0.12–0.24 s (well under the 1 s budget) |
| Chinese query with keyword normalisation | ~7 s (one LLM round-trip; only on this fallback path) |
| Below-gate task check | < 1 ms |
| Task match via the free relay | ~9 s (unchanged behaviour) |

## 3. Verification

- Backend: `pytest -q` → **116 passed** (baseline 101 + 4 gate tests + 11
  fuzzy tests), fully offline.
  - New: `tests/test_reference_fuzzy.py` (plurals, word order, typos ≤2 edits,
    mixed-script queries, normaliser path + failure containment, empty results
    for unrelated queries, schema guards, 1000-row latency budget).
  - `tests/test_ai_task_match.py` / `tests/test_ai_api_contract.py` extended
    for the word gate and the `status` field; `tests/test_reference.py` passes
    unchanged.
- Frontend: `npm run build` passes; `node --test` suites pass including the
  new `tests/taskMatchWords.test.mjs` (the pre-existing
  `taskOverview.test.mjs` failures are unrelated and tracked separately).
- Live smoke (real backend + real database): gate → `needs_more_input` in
  0 ms; 5+ word task matched with confidence 0.95; `shoop superviser` →
  "Shop Supervisors" first; `SOFTWARE` → direct hits; unrelated queries →
  empty; `商店主管` → keyword normalisation recalled "Shop Supervisors".
