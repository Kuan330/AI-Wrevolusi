# E2 task-matching reliability evaluation — Phase 1

| Metadata | Value |
| --- | --- |
| Primary evaluation contributor | Li Yuanqing |
| Label reviewer | Pending |
| Scope | Offline E2 matching reliability evaluation |
| Baseline commit | `6b70ce75b2e187655f0f955bf46aeeff2222480d` |
| Result status | **PROVISIONAL — NOT FINAL MODEL PERFORMANCE** |

## 1. Purpose

This small pilot evaluates when the existing E2 deterministic task-text matcher should and should not be trusted across the three current pilot occupations. It adds benchmark design, quantitative error analysis and threshold-validation methodology. It does not alter product behaviour. This report describes the **deterministic E2 matching baseline**, not full production AI pipeline performance.

## 2. Existing E2 baseline and ownership boundary

The existing E2 architecture predates this evaluation work. It already provides exact ILO matching, TF-IDF/cosine retrieval, a `0.18` deterministic reliable-match floor, an optional constrained LLM judge in the `0.18 <= similarity < 0.5` band, `prefer_llm_match`, match layers, API/UI exposure explanations and provider fallback behaviour. None of these components are implemented or claimed by this evaluation contribution.

The runner uses the existing `rank_ilo_reference_tasks_by_semantic_similarity` and normalisation functions. It reproduces exact-match handling only where a benchmark case deliberately supplies the linked ILO ID; its injected threshold affects evaluation acceptance only. It never changes `MINIMUM_RELIABLE_TASK_TEXT_SIMILARITY`, `LLM_JUDGE_BORDERLINE_SIMILARITY_UPPER`, routing, the API, frontend, database or deployment configuration.

## 3. Why evaluation is needed

`backend/app/services/exposure.py` labels the `0.18` floor as pilot-calibrated and calls for labelled-user calibration before expansion. Existing unit tests verify examples, contracts and safe failure paths; they do not provide a labelled performance benchmark, calibration/holdout separation, false-acceptance analysis or empirical threshold trade-off.

## 4. Benchmark design and label status

`backend/tests/fixtures/e2_task_matching_benchmark.json` contains 60 proposed labels: 20 each for `5221` Shopkeepers, `5222` Shop Supervisors and `5223` Shop Sales Assistants. Each occupation has four cases in each category:

- `exact_or_near_exact`
- `clear_paraphrase`
- `difficult_paraphrase`
- `related_but_wrong_task`
- `unrelated_no_match`

Positive cases cite a specific current ILO reference row. Negative cases are intended to have no reasonable candidate in that occupation's current candidate set. These are proposed labels based on the source task descriptions and rationale, not output from the matcher alone.

All 60 labels are `provisional`; every benchmark `reviewer` field is `null`. They are not human-reviewed, gold, approved or production-calibration labels. `docs/evaluation/e2_task_matching_label_review.csv` is the review worksheet; its human-decision, corrected-ID, reviewer and notes columns are deliberately blank.

## 5. Calibration/holdout methodology

The split is deterministic and balanced: for every occupation × case-type cell, the first two authored cases are calibration and the next two are holdout. This yields 30 calibration and 30 holdout cases, with each occupation and case type represented evenly. Only calibration cases appear in the threshold sweep. Holdout results are reported once for untouched provisional comparison; the full dataset is descriptive debugging only.

## 6. Metrics

- **positive_top1_accuracy:** accepted predictions with the expected ILO ID divided by all expected-match-positive cases. A positive abstention is incorrect.
- **accepted_match_precision:** correct accepted predictions divided by all accepted predictions. An accepted negative is incorrect.
- **false_acceptance_rate:** accepted predictions among expected-no-match cases, divided by expected-no-match cases.
- **coverage:** accepted predictions divided by all evaluated cases.
- **abstention_rate:** no reliable accepted prediction divided by all evaluated cases.

The output records raw counts and each metric overall, by occupation and by case type. Zero denominators are emitted as `null`, never as invented values. Similarity and confidence-like values are retrieval scores, **not calibrated probabilities**.

## 7. Offline safety and reproducibility

The evaluator does not construct an AI gateway or LLM judge. It uses a process-level socket guard, so any accidental connection attempt raises `RuntimeError`; this blocks configured providers, keyless relays and network fallbacks. Phase 1 therefore does not evaluate a real LLM provider.

Generated JSON/CSV outputs in `backend/evaluation/e2_task_matching/` are deterministic and intentionally versioned with this pilot so the report, regression tests and review worksheet refer to the same baseline run.

## 8. Current 0.18 baseline

**PROVISIONAL — NOT FINAL MODEL PERFORMANCE**

| Split | Positive Top-1 | Accepted precision | False acceptance | Coverage | Abstention | Accepted / false accepts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Calibration (30) | 0.833333 | 0.789474 | 0.166667 | 0.633333 | 0.366667 | 19 / 2 |
| Holdout (30) | 0.666667 | 0.705882 | 0.166667 | 0.566667 | 0.433333 | 17 / 2 |
| Full, descriptive only (60) | 0.750000 | 0.750000 | 0.166667 | 0.600000 | 0.400000 | 36 / 4 |

These figures are a diagnostic of provisional authored examples, not validated findings and not production calibration.

## 9. Calibration threshold sweep

The runner derives candidates from observed calibration cosine-score boundaries and always includes the current `0.18`. It produces `backend/evaluation/e2_task_matching/threshold_sweep_calibration.csv`; it does not choose a “best” threshold.

Selected calibration-only trade-offs:

| Threshold | Positive Top-1 | Precision | False acceptance | Coverage | Abstention | Accepted / false accepts |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0.18 (current) | 0.833333 | 0.789474 | 0.166667 | 0.633333 | 0.366667 | 19 / 2 |
| 0.21 | 0.833333 | 0.833333 | 0.083333 | 0.600000 | 0.400000 | 18 / 1 |
| 0.27 | 0.833333 | 0.882353 | 0.083333 | 0.566667 | 0.433333 | 17 / 1 |
| 0.32 | 0.722222 | 1.000000 | 0.000000 | 0.433333 | 0.566667 | 13 / 0 |

The table makes safety/coverage trade-offs visible. It is not a selection rule and does not justify changing the production `0.18` or `0.5` boundaries.

## 10. Error-analysis examples

- Calibration case `e2-5221-difficult-01` proposes product-mix/price task `1`, but deterministic retrieval accepts price/display task `4` at similarity `0.26`.
- Calibration case `e2-5223-related-02` (“Plan delivery routes for online orders”) is a proposed abstention but is accepted as task `1` at `0.21`.
- Holdout case `e2-5221-related-04` (“Install point-of-sale software”) is a proposed abstention but is accepted as task `4` at `0.31`.
- Holdout case `e2-5223-difficult-03` proposes cash-register sale task `3`, but retrieval accepts stacking/packing task `5` at the current floor.

These examples identify review priorities; they do not prove model defects until a human reviewer confirms or corrects the proposed label.

## 11. Limitations and next step

This is a small, three-occupation pilot and is not evidence of generalisation to all occupations. Authored paraphrases may not represent real user wording; there is no confidence calibration study, no live-provider LLM comparison, and no production-policy change. The current split has no literal or high lexical near-duplicate user-task wording across calibration and holdout, but it is not candidate-disjoint: proposed ILO task `5221/3` and `5223/3` each occur in both splits. Because Phase 1 tunes only a global threshold rather than model weights, this is a limited leakage risk rather than training leakage; however, a future larger benchmark should use target-disjoint holdout examples before making a generalisation or production-policy claim.

Next: an independent human reviewer should complete `e2_task_matching_label_review.csv`, explicitly approve/correct each expected decision and ILO ID, and record their name and notes. Only then rerun the unchanged evaluator, interpret holdout results as reviewed evidence, and discuss a separately approved production-policy proposal. No production threshold should change in Phase 1.

## Human Label Review Protocol

For every case, the reviewer should decide independently whether:

A. one specific available ILO reference task is the correct semantic match; or

B. none of the available ILO reference tasks is sufficiently equivalent and the system should abstain.

The review worksheet supplies the proposed label and the available candidate texts for reference, but it deliberately excludes the model's predicted task, similarity score, accepted/rejected outcome and threshold-sweep result. Before recording a decision, the reviewer should not inspect those model outputs. Only after the independent human decision, corrected ILO ID where applicable, reviewer name and notes are recorded should model output be compared. This separation reduces confirmation bias.
