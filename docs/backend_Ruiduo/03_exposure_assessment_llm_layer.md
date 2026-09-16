# 03 — Exposure Assessment: LLM Judge Layer and Score Context

**Sources:** `backend/app/services/ai_task_judge.py`, `backend/app/services/exposure.py`,
`backend/app/schemas/exposure.py`, `backend/app/routers/exposure.py`
**Tests:** `backend/tests/test_exposure_llm_judge.py`, `test_exposure.py`

## 1. Background and scope

The task-level exposure assessment compares a user's confirmed task wording
against ILO reference tasks for their occupation (Gmyrek et al. 2025, ILO
Working Paper 140) and returns a 0–1 task exposure index. The retrieval and
scoring engine (TF-IDF vectors + cosine similarity) pre-dates this work; **this
work adds two layers on top of it**:

1. An **optional LLM judge** that can resolve borderline matches the
   deterministic similarity cannot decide — without ever being able to invent
   an identifier or block a request.
2. **Score context** on the API response (`score_band`, `score_scale`,
   `score_explanation`) plus wording that makes the number impossible to
   misread as a prediction.

Endpoint: `POST /api/v1/exposure/assessments` (batch, up to 50 confirmed tasks).

## 2. Match pipeline and the four match layers

```
task text ──► 1. exact       (ilo_task_id + identical wording)          → layer "exact"
          ──► 2. nlp         (TF-IDF cosine)
          │      ≥ 0.50  → accept                                    → layer "nlp"
          │      0.18–0.50 (borderline) → try LLM judge ──┐
          ──► 3.                                    judge ↓
          │      judge confirms a supplied candidate               → layer "llm"
          │      judge unavailable/declines → gap
          ──► 4. below 0.18 (or gap) → evidence gap                  → layer "insufficient_data"
```

Constants in `exposure.py`:

| Constant | Value | Meaning |
|----------|-------|---------|
| `MINIMUM_RELIABLE_TASK_TEXT_SIMILARITY` | `0.18` | Below this the deterministic match is not considered reliable |
| `LLM_JUDGE_BORDERLINE_SIMILARITY_UPPER` | `0.5` | Upper bound of the borderline band where the judge is consulted automatically |

The judge is consulted when the similarity lands **in the borderline band**,
or when the caller explicitly sets `prefer_llm_match: true` (an escape hatch
for the UI / power users). A similarity below 0.18 is treated as an *evidence
gap* by default — the system prefers "we don't have reliable evidence" over
stretching a weak match.

## 3. The LLM judge (`ai_task_judge.py`)

- `LLMTaskMatchJudge` wraps the shared `AIGateway`; `TaskMatchJudge` is the
  narrow protocol the exposure service depends on (so tests can inject a fake
  without any provider).
- `available` is `False` whenever no provider chain is configured — in that
  case the exposure flow behaves exactly as before (deterministic only).
- The judge receives the **already supplied** ILO reference candidates for the
  occupation and can only return one of their `ilo_task_id`s. Its output then
  goes through `enforce_task_match_contract` like every other provider result.
- **Every failure mode returns `None`** (no provider, timeout, malformed JSON,
  unknown identifier, low confidence) and the deterministic assessment is kept
  — the judge can never break or delay a response beyond its timeout, and it
  can never block the endpoint.
- On success the assessment records `match_layer: "llm"` with the judge's
  confidence, and the UI presents it as **"LLM-reviewed task match"**, i.e.
  explicitly flagged as AI-assisted rather than authoritative.

## 4. Score context fields

The 0.64/1.0 ambiguity (out of what? compared to what? adjusted how?) is
resolved with three fields added to `ConfirmedTaskExposureAssessment`:

| Field | Content |
|-------|---------|
| `score_band` | `low` (< 0.25), `moderate` (0.25–0.55), `high` (≥ 0.55) |
| `score_scale` | Fixed text: *"Task-level exposure index from 0 (little task change indicated) to 1 (task strongly reshaped in the ILO study), before any job-level interpretation."* |
| `score_explanation` | Sentence template built by `build_exposure_score_explanation`, e.g. *"How to read this value: 0.64/1.0 is a task-level exposure index (band: high). It starts from the matched ILO task score 0.64 with no optional workplace context applied. It describes possible task-level change, not a date or a job outcome."* |

The **same adjustment chain is stated in the `reasoning` text**, e.g.
*"The baseline score 0.64 was adjusted to 0.64 (no optional workplace context
was provided)."* — so the numeric chain never has to be inferred.

### 4.1 Workplace-context adjustments

All adjustments are small, fixed, and derived only from the optional context
fields the user chose to provide
(`routine_processing_level`, `information_use_level`, `human_interaction_level`,
`judgement_level`, `responsibility_level`); each level scales the weight via
`{low: 0.25, medium: 0.6, high: 1.0}`:

| Factor | Maximum adjustment |
|--------|--------------------|
| Routine processing | **+0.06** |
| Information use | **+0.04** |
| Human interaction | **−0.05** |
| Judgement | **−0.07** |
| Responsibility | individual `0` / shared `−0.02` / lead `−0.04` |

If any context field is missing, the response carries
`missing_data_status: "partial_context"`; the full set of statuses is
`complete`, `partial_context`, `no_reliable_match`, `missing_reference_tasks`.

### 4.2 From score to suggested state

`map_adjusted_exposure_score_to_suggested_state` keeps the state machine
consistent with the bands: `< 0.25 → human_led`, `< 0.4 → ai_assisted`,
`< 0.55 → partly_automated`, otherwise `reshaped`. Insufficient-data results
use the dedicated `insufficient_data` state with no score.

## 5. Worked examples (real output, September 2026)

**LLM-reviewed match** — occupation `5222` (Shop Supervisors), user task
*"Deciding shift timetables for employees and allocating each person their
tasks"*: the deterministic similarity was borderline, the judge reviewed the
supplied ILO candidates and selected *"Planning and preparing work schedules
and assigning staff to specific duties;"* → `match_layer: "llm"`, confidence
0.96, matched ILO score 0.53. The drawer shows
`Evidence method: LLM-reviewed task match`.

**Evidence gap** — task *"Map out the future development path."* produced no
reliable match: `match_layer: "insufficient_data"`, empty selection, plus the
text *"The confirmed task wording was not sufficiently similar to the available
ILO task evidence."* and *"This result is an evidence gap, not a prediction
about job replacement or the value of the user's work."* — a first-class
outcome rather than an error.

## 6. Ethics and safety guarantees

- **No timelines, no job outcomes.** Every score block carries the line *"It
  describes possible task-level change, not a date or a job outcome."*; the
  judge's system prompt forbids predicting job loss or replacement.
- **No invented scores.** Scores always come from the published ILO data via
  the matched reference task; the LLM only *selects among supplied tasks*.
- **Uncertainty is surfaced, not hidden.** Each assessment states its
  uncertainty level, its limitations, and the evidence method that produced it
  (`Exact ILO task evidence` / `NLP task-text match` / `LLM-reviewed task
  match` / `No reliable evidence match`).
- **Silent degradation.** Without a provider (or on any judge failure) the
  endpoint returns the same deterministic assessment with unchanged schema —
  the API contract never depends on the LLM being available.
