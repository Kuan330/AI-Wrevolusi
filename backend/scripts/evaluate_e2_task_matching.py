"""Offline, provisional reliability evaluation for E2 task-text matching.

This tool deliberately bypasses the application gateway and never constructs an
LLM judge.  A process-wide socket guard prevents accidental network access,
including configured keyless or provider fallbacks.  It evaluates only the
existing deterministic exact/TF-IDF/cosine policy, with a threshold supplied
at evaluation time; production constants and application behaviour are not
modified.
"""

from __future__ import annotations

import argparse
import csv
import json
import socket
from collections import defaultdict
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Iterator

from app.services.exposure import (
    IloTaskExposureReference,
    MINIMUM_RELIABLE_TASK_TEXT_SIMILARITY,
    normalize_task_text_for_matching,
    rank_ilo_reference_tasks_by_semantic_similarity,
)


REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_BENCHMARK = REPO_ROOT / 'backend/tests/fixtures/e2_task_matching_benchmark.json'
DEFAULT_REFERENCE_DATA = REPO_ROOT / 'data/reference/ref_ilo_tasks.csv'
DEFAULT_OUTPUT_DIRECTORY = REPO_ROOT / 'backend/evaluation/e2_task_matching'
DEFAULT_REVIEW_WORKSHEET = REPO_ROOT / 'docs/evaluation/e2_task_matching_label_review.csv'
# Read, never mutate, the production floor so the baseline run cannot drift.
CURRENT_PRODUCTION_THRESHOLD = MINIMUM_RELIABLE_TASK_TEXT_SIMILARITY
OCCUPATION_TITLES = {
    '5221': 'Shopkeepers',
    '5222': 'Shop Supervisors',
    '5223': 'Shop Sales Assistants',
}
REQUIRED_FIELDS = {
    'case_id',
    'occupation_code',
    'user_task',
    'expected_match',
    'expected_ilo_task_id',
    'case_type',
    'difficulty',
    'split',
    'label_status',
    'label_rationale',
    'source_reference',
    'reviewer',
    'notes',
}


@contextmanager
def network_blocked() -> Iterator[None]:
    """Fail closed if future evaluator changes accidentally attempt networking."""

    original_connect = socket.socket.connect
    original_create_connection = socket.create_connection

    def deny_connect(*_args: Any, **_kwargs: Any) -> None:
        raise RuntimeError('Network access is disabled for offline E2 evaluation.')

    socket.socket.connect = deny_connect
    socket.create_connection = deny_connect
    try:
        yield
    finally:
        socket.socket.connect = original_connect
        socket.create_connection = original_create_connection


def load_benchmark(path: Path) -> list[dict[str, Any]]:
    cases = json.loads(path.read_text(encoding='utf-8'))
    if not isinstance(cases, list) or not cases:
        raise ValueError('Benchmark must be a non-empty JSON array.')
    case_ids: set[str] = set()
    for case in cases:
        if not isinstance(case, dict) or not REQUIRED_FIELDS.issubset(case):
            raise ValueError('Every benchmark case must contain the required schema fields.')
        if case['case_id'] in case_ids:
            raise ValueError(f"Duplicate case_id: {case['case_id']}")
        case_ids.add(case['case_id'])
        if case['label_status'] != 'provisional' or case['reviewer'] is not None:
            raise ValueError('Phase 1 benchmark labels must remain provisional and unreviewed.')
        if bool(case['expected_match']) != bool(case['expected_ilo_task_id']):
            raise ValueError(f"Expected-match and expected ILO ID disagree: {case['case_id']}")
    return cases


def load_references(path: Path) -> dict[str, list[IloTaskExposureReference]]:
    references: dict[str, list[IloTaskExposureReference]] = defaultdict(list)
    with path.open(encoding='utf-8', newline='') as source:
        for row in csv.DictReader(source):
            occupation_code = row['isco_08']
            if occupation_code not in {'5221', '5222', '5223'}:
                continue
            references[occupation_code].append(
                IloTaskExposureReference(
                    ilo_task_id=row['task_id'],
                    task_text=row['task_text'],
                    score_2025=float(row['score_2025']) if row['score_2025'] else None,
                    source_method=row.get('source'),
                    potential25=row.get('potential25'),
                )
            )
    if set(references) != {'5221', '5222', '5223'}:
        raise ValueError('Expected reference tasks for all three pilot occupations.')
    return dict(references)


def validate_cases_against_references(
    cases: list[dict[str, Any]],
    references_by_occupation: dict[str, list[IloTaskExposureReference]],
) -> None:
    """Ensure each proposed positive label points to a current in-scope ILO row."""

    for case in cases:
        reference_ids = {
            reference.ilo_task_id
            for reference in references_by_occupation[case['occupation_code']]
        }
        expected_id = case['expected_ilo_task_id']
        if case['expected_match'] and expected_id not in reference_ids:
            raise ValueError(f"Unknown expected ILO task ID for {case['case_id']}: {expected_id}")
        provided_id = case.get('provided_ilo_task_id')
        if provided_id and provided_id not in reference_ids:
            raise ValueError(f"Unknown provided ILO task ID for {case['case_id']}: {provided_id}")


def evaluate_case(
    case: dict[str, Any],
    references: list[IloTaskExposureReference],
    threshold: float,
) -> dict[str, Any]:
    """Apply the production-equivalent deterministic policy at an injected threshold."""

    reference_by_id = {reference.ilo_task_id: reference for reference in references}
    provided_id = case.get('provided_ilo_task_id')
    exact_reference = reference_by_id.get(provided_id or '')
    exact = bool(
        exact_reference
        and normalize_task_text_for_matching(case['user_task'])
        == normalize_task_text_for_matching(exact_reference.task_text)
    )
    ranked = rank_ilo_reference_tasks_by_semantic_similarity(case['user_task'], references)
    best_reference, top_similarity = ranked[0] if ranked else (None, 0.0)
    if exact:
        predicted_ilo_task_id = exact_reference.ilo_task_id
        top_similarity = 1.0
        accepted = True
        policy_layer = 'exact'
    else:
        accepted = best_reference is not None and top_similarity >= threshold
        predicted_ilo_task_id = best_reference.ilo_task_id if accepted and best_reference else None
        policy_layer = 'nlp' if accepted else 'insufficient_data'

    expected_match = bool(case['expected_match'])
    correct = bool(
        accepted
        and expected_match
        and predicted_ilo_task_id == case['expected_ilo_task_id']
    )
    decision_correct = correct or bool(not expected_match and not accepted)
    return {
        'case_id': case['case_id'],
        'occupation_code': case['occupation_code'],
        'case_type': case['case_type'],
        'split': case['split'],
        'expected_match': expected_match,
        'expected_ilo_task_id': case['expected_ilo_task_id'],
        'predicted_match': accepted,
        'predicted_ilo_task_id': predicted_ilo_task_id,
        'top_similarity': round(top_similarity, 6),
        'accepted': accepted,
        'correct': correct,
        'decision_correct': decision_correct,
        'false_acceptance': bool(accepted and not expected_match),
        'abstained': not accepted,
        'threshold': threshold,
        'policy_layer': policy_layer,
    }


def calculate_metrics(rows: list[dict[str, Any]]) -> dict[str, Any]:
    total = len(rows)
    positives = [row for row in rows if row['expected_match']]
    negatives = [row for row in rows if not row['expected_match']]
    accepted = [row for row in rows if row['accepted']]
    correct = [row for row in rows if row['correct']]
    false_acceptances = [row for row in rows if row['false_acceptance']]
    abstained = [row for row in rows if row['abstained']]

    def ratio(numerator: int, denominator: int) -> float | None:
        return round(numerator / denominator, 6) if denominator else None

    return {
        'case_count': total,
        'positive_case_count': len(positives),
        'negative_case_count': len(negatives),
        'accepted_count': len(accepted),
        'correct_accepted_count': len(correct),
        'false_acceptance_count': len(false_acceptances),
        'abstained_count': len(abstained),
        'positive_top1_accuracy': ratio(len(correct), len(positives)),
        'accepted_match_precision': ratio(len(correct), len(accepted)),
        'false_acceptance_rate': ratio(len(false_acceptances), len(negatives)),
        'coverage': ratio(len(accepted), total),
        'abstention_rate': ratio(len(abstained), total),
    }


def grouped_metrics(rows: list[dict[str, Any]], field: str) -> dict[str, dict[str, Any]]:
    grouped: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        grouped[str(row[field])].append(row)
    return {key: calculate_metrics(value) for key, value in sorted(grouped.items())}


def evaluate_cases(
    cases: list[dict[str, Any]],
    references_by_occupation: dict[str, list[IloTaskExposureReference]],
    threshold: float,
) -> list[dict[str, Any]]:
    return [
        evaluate_case(case, references_by_occupation[case['occupation_code']], threshold)
        for case in cases
    ]


def result_document(rows: list[dict[str, Any]], threshold: float, scope: str) -> dict[str, Any]:
    return {
        'status': 'PROVISIONAL — NOT FINAL MODEL PERFORMANCE',
        'scope': scope,
        'threshold': threshold,
        'network_access': 'blocked',
        'llm_provider_evaluated': False,
        'metrics': calculate_metrics(rows),
        'metrics_by_occupation': grouped_metrics(rows, 'occupation_code'),
        'metrics_by_case_type': grouped_metrics(rows, 'case_type'),
        'per_case': rows,
    }


def calibration_thresholds(rows_at_zero: list[dict[str, Any]]) -> list[float]:
    """Use deterministic observed score boundaries plus the current production floor."""

    return sorted({0.0, CURRENT_PRODUCTION_THRESHOLD, *(round(row['top_similarity'], 2) for row in rows_at_zero)})


def pareto_relevant(summary_rows: list[dict[str, Any]]) -> list[bool]:
    """Mark non-dominated precision/recall/safety trade-offs without choosing a winner."""

    def value(row: dict[str, Any], key: str) -> float:
        return float(row[key]) if row[key] is not None else -1.0

    flags: list[bool] = []
    for candidate in summary_rows:
        dominated = False
        for other in summary_rows:
            if other is candidate:
                continue
            at_least_as_good = (
                value(other, 'positive_top1_accuracy') >= value(candidate, 'positive_top1_accuracy')
                and value(other, 'accepted_match_precision') >= value(candidate, 'accepted_match_precision')
                and value(other, 'coverage') >= value(candidate, 'coverage')
                and value(other, 'false_acceptance_rate') <= value(candidate, 'false_acceptance_rate')
            )
            strictly_better = (
                value(other, 'positive_top1_accuracy') > value(candidate, 'positive_top1_accuracy')
                or value(other, 'accepted_match_precision') > value(candidate, 'accepted_match_precision')
                or value(other, 'coverage') > value(candidate, 'coverage')
                or value(other, 'false_acceptance_rate') < value(candidate, 'false_acceptance_rate')
            )
            if at_least_as_good and strictly_better:
                dominated = True
                break
        flags.append(not dominated)
    return flags


def write_label_review_worksheet(
    cases: list[dict[str, Any]],
    references_by_occupation: dict[str, list[IloTaskExposureReference]],
    path: Path,
) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    columns = [
        'case_id', 'occupation_code', 'occupation_title', 'case_type', 'user_task',
        'proposed_decision', 'proposed_expected_match', 'proposed_expected_ilo_task_id',
        'proposed_reference_task_text', 'other_available_ilo_tasks', 'label_rationale', 'human_decision',
        'human_corrected_ilo_task_id', 'reviewer', 'review_notes',
    ]
    with path.open('w', encoding='utf-8', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=columns)
        writer.writeheader()
        for case in cases:
            references = {item.ilo_task_id: item for item in references_by_occupation[case['occupation_code']]}
            reference = references.get(case['expected_ilo_task_id'] or '')
            other_candidates = [
                f'{item.ilo_task_id}: {item.task_text}'
                for item in references_by_occupation[case['occupation_code']]
                if item.ilo_task_id != (case['expected_ilo_task_id'] or '')
            ]
            writer.writerow({
                'case_id': case['case_id'],
                'occupation_code': case['occupation_code'],
                'occupation_title': OCCUPATION_TITLES[case['occupation_code']],
                'case_type': case['case_type'],
                'user_task': case['user_task'],
                'proposed_decision': 'MATCH' if case['expected_match'] else 'ABSTAIN',
                'proposed_expected_match': str(bool(case['expected_match'])).lower(),
                'proposed_expected_ilo_task_id': case['expected_ilo_task_id'] or '',
                'proposed_reference_task_text': reference.task_text if reference else '',
                'other_available_ilo_tasks': ' | '.join(other_candidates),
                'label_rationale': case['label_rationale'],
                'human_decision': '',
                'human_corrected_ilo_task_id': '',
                'reviewer': '',
                'review_notes': '',
            })


def write_outputs(
    cases: list[dict[str, Any]],
    references_by_occupation: dict[str, list[IloTaskExposureReference]],
    output_directory: Path,
    review_worksheet: Path,
) -> dict[str, Any]:
    output_directory.mkdir(parents=True, exist_ok=True)
    by_split = {
        split: [case for case in cases if case['split'] == split]
        for split in ('calibration', 'holdout')
    }
    zero_calibration = evaluate_cases(by_split['calibration'], references_by_occupation, 0.0)
    baseline = {
        split: evaluate_cases(split_cases, references_by_occupation, CURRENT_PRODUCTION_THRESHOLD)
        for split, split_cases in by_split.items()
    }
    full_rows = evaluate_cases(cases, references_by_occupation, CURRENT_PRODUCTION_THRESHOLD)
    documents = {
        'baseline_calibration.json': result_document(baseline['calibration'], CURRENT_PRODUCTION_THRESHOLD, 'calibration'),
        'baseline_holdout.json': result_document(baseline['holdout'], CURRENT_PRODUCTION_THRESHOLD, 'holdout'),
        'baseline_full.json': result_document(full_rows, CURRENT_PRODUCTION_THRESHOLD, 'full descriptive dataset'),
    }
    for filename, document in documents.items():
        (output_directory / filename).write_text(json.dumps(document, indent=2) + '\n', encoding='utf-8')

    sweep_rows: list[dict[str, Any]] = []
    for threshold in calibration_thresholds(zero_calibration):
        metrics = calculate_metrics(evaluate_cases(by_split['calibration'], references_by_occupation, threshold))
        sweep_rows.append({'threshold': threshold, **metrics})
    for row, relevant in zip(sweep_rows, pareto_relevant(sweep_rows)):
        row['pareto_relevant'] = relevant
    sweep_path = output_directory / 'threshold_sweep_calibration.csv'
    columns = [
        'threshold', 'positive_top1_accuracy', 'accepted_match_precision',
        'false_acceptance_rate', 'coverage', 'abstention_rate', 'accepted_count',
        'false_acceptance_count', 'pareto_relevant',
    ]
    with sweep_path.open('w', encoding='utf-8', newline='') as output:
        writer = csv.DictWriter(output, fieldnames=columns)
        writer.writeheader()
        writer.writerows([{key: row[key] for key in columns} for row in sweep_rows])
    write_label_review_worksheet(cases, references_by_occupation, review_worksheet)
    return {
        'baseline_calibration': documents['baseline_calibration.json'],
        'baseline_holdout': documents['baseline_holdout.json'],
        'baseline_full': documents['baseline_full.json'],
        'threshold_sweep': sweep_rows,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--benchmark', type=Path, default=DEFAULT_BENCHMARK)
    parser.add_argument('--reference-data', type=Path, default=DEFAULT_REFERENCE_DATA)
    parser.add_argument('--output-dir', type=Path, default=DEFAULT_OUTPUT_DIRECTORY)
    parser.add_argument('--review-worksheet', type=Path, default=DEFAULT_REVIEW_WORKSHEET)
    args = parser.parse_args()

    with network_blocked():
        cases = load_benchmark(args.benchmark)
        references = load_references(args.reference_data)
        validate_cases_against_references(cases, references)
        outputs = write_outputs(cases, references, args.output_dir, args.review_worksheet)
    print('PROVISIONAL — NOT FINAL MODEL PERFORMANCE')
    for split in ('baseline_calibration', 'baseline_holdout'):
        print(f"{split}: {outputs[split]['metrics']}")
    print(f"threshold_sweep_rows: {len(outputs['threshold_sweep'])}")


if __name__ == '__main__':
    main()
