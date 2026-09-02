# Epic 2 task exposure model card

## Model identity

- Version: `epic2-tfidf-ridge-v1`
- Model type: scikit-learn TF-IDF text features with Ridge regression
- Serving artifact: `backend/app/model_artifacts/epic2_task_exposure_tfidf_ridge_v1.joblib`
- Training script: `backend/ml/train_epic2_task_exposure_model.py`

## Intended use

The model predicts an ILO-compatible `score_2025` for user-added or edited English task descriptions. The product converts the score into the E2 states `human_led`, `ai_assisted`, `partly_automated`, or `reshaped`. A separate similarity threshold produces `insufficient_data` when no reliable pilot task evidence is available.

Unchanged ILO tasks bypass the model and retain their official task score. User context is applied afterward as a transparent product rule; the context weights are not learned model parameters.

## Training data

- Dataset: `data/raw/ilo_task_score_raw.csv`
- Label: `score_2025`
- Rows: 3,265
- ISCO groups: 427
- Dataset SHA-256: `46940a80d525ff4635389e9480c8fcdcd53180a9548434ac398dd806a73f6f72`
- Sensitive attributes: none used as model features

## Evaluation design

Five-fold `GroupKFold` cross-validation groups rows by `isco_08`. This prevents task descriptions from the same occupation appearing in both training and validation folds.

| Metric | Trained model | Mean-score baseline |
|---|---:|---:|
| Mean absolute error | 0.0692 | 0.1395 |
| Root mean squared error | 0.0926 | 0.1659 |
| R-squared | 0.6882 | - |
| Macro-F1 after product-state mapping | 0.5385 | - |

Promotion gates require the trained model to beat the mean-score MAE baseline and achieve grouped macro-F1 of at least 0.45.

## Robustness and bias probes

Three representative task descriptions were tested with formatting changes and with otherwise identical `woman` and `man` prefixes.

| Probe | Maximum absolute score difference |
|---|---:|
| Case and punctuation formatting | 0.0000 |
| Gender wording | 0.0000 |

These are regression probes, not a complete fairness audit. The model must still be reviewed across occupations, writing styles, spelling errors, short descriptions, and Malaysian workplace contexts.

## Human-centric safeguards

- Every prediction includes model version, evidence, uncertainty, and limitations.
- Low-similarity tasks produce `insufficient_data` instead of a forced result.
- The UI describes possible task transformation, not job replacement or personal readiness.
- Users can change task wording and context and receive a refreshed assessment.

## Known limitations

- Training text and product labels are English-first.
- Product-state thresholds are product rules, not learned class boundaries.
- Context adjustments remain transparent expert rules until labelled context examples exist.
- Macro-F1 shows that state-boundary errors remain; individual scores must not be treated as precise forecasts.
- The current product pilot covers three retail occupation codes even though the training dataset is broader.

## Reproduction and rollback

Train and regenerate the versioned artifact with:

```bash
backend/.venv/bin/python backend/ml/train_epic2_task_exposure_model.py
```

Rollback by restoring the previous backend artifact and service commit. Exact ILO tasks and `insufficient_data` remain safe fallbacks if trained-model inference is unavailable.
