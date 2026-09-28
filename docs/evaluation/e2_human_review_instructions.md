# E2 independent human review instructions

This review establishes evaluation ground truth. You are evaluating **semantic equivalence**, not whether the existing software behaved correctly.

Use [e2_task_matching_blind_review.csv](e2_task_matching_blind_review.csv). Save a
separate copy for your answers. Avoid the older label-review worksheet, benchmark
JSON and model results until you have completed your independent decisions.

For each row:

1. Read the occupation and user task.
2. Examine every available ILO reference task shown for that occupation.
3. Decide independently whether one candidate is sufficiently semantically equivalent.
4. If yes, enter `MATCH` in `human_decision` and enter that candidate's ID in `human_selected_ilo_task_id`.
5. If none is sufficiently equivalent, enter `ABSTAIN` and leave `human_selected_ilo_task_id` blank.
6. Do not try to infer what the software probably predicted.
7. Do not use TF-IDF scores, AI outputs, thresholds, or previous provisional labels.
8. Add a short note for an ambiguous case.
9. Enter your name in `reviewer` for every completed row.

Candidate order is independently shuffled for each case with fixed seed **5120**. The `case_type` value is the neutral protocol marker `blind_semantic_equivalence`; it deliberately does not disclose an authored benchmark category.

The original case IDs still contain category hints such as `exact`, `related`
and `unrelated`, so this worksheet is not fully blinded. Base your answers on the
task and candidate texts rather than these hints.

The current evaluator does not import review answers and accepts only provisional,
unreviewed benchmark labels. Keep your completed copy for a separate follow-up
that validates and applies the decisions; rerunning the evaluator alone does not
produce reviewed results.
