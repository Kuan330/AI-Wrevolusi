"""Regression checks for the provisional, offline E2 evaluation machinery.

These checks preserve observed Phase 1 behaviour at the existing 0.18 policy;
they do not certify the provisional labels as human-reviewed gold truth.
"""

from __future__ import annotations

import socket
import sys
from pathlib import Path

import pytest

from app.services.exposure import MINIMUM_RELIABLE_TASK_TEXT_SIMILARITY

BACKEND_DIRECTORY = Path(__file__).resolve().parents[1]
SCRIPTS_DIRECTORY = BACKEND_DIRECTORY / 'scripts'
if str(SCRIPTS_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIRECTORY))

from evaluate_e2_task_matching import (  # noqa: E402
    CURRENT_PRODUCTION_THRESHOLD,
    DEFAULT_BENCHMARK,
    DEFAULT_REFERENCE_DATA,
    evaluate_case,
    load_benchmark,
    load_references,
    network_blocked,
    validate_cases_against_references,
)


@pytest.fixture(scope='module')
def benchmark_cases():
    return {case['case_id']: case for case in load_benchmark(DEFAULT_BENCHMARK)}


@pytest.fixture(scope='module')
def references_by_occupation():
    return load_references(DEFAULT_REFERENCE_DATA)


def test_benchmark_has_balanced_provisional_split(benchmark_cases) -> None:
    cases = list(benchmark_cases.values())
    assert len(cases) == 60
    assert sum(case['split'] == 'calibration' for case in cases) == 30
    assert sum(case['split'] == 'holdout' for case in cases) == 30
    assert {case['occupation_code'] for case in cases} == {'5221', '5222', '5223'}
    assert {case['label_status'] for case in cases} == {'provisional'}
    assert all(case['reviewer'] is None for case in cases)


def test_evaluation_baseline_reads_the_production_threshold_without_mutating_it() -> None:
    assert CURRENT_PRODUCTION_THRESHOLD == MINIMUM_RELIABLE_TASK_TEXT_SIMILARITY == 0.18


def test_every_proposed_positive_label_references_the_current_ilo_fixture(
    benchmark_cases,
    references_by_occupation,
) -> None:
    validate_cases_against_references(list(benchmark_cases.values()), references_by_occupation)


@pytest.mark.parametrize(
    ('case_id', 'accepted', 'predicted_ilo_task_id'),
    [
        ('e2-5221-exact-01', True, '1'),
        ('e2-5221-clear-01', True, '2'),
        ('e2-5221-difficult-01', True, '4'),
        ('e2-5221-unrelated-01', False, None),
        ('e2-5222-exact-01', True, '1'),
        ('e2-5222-clear-01', True, '4'),
        ('e2-5222-unrelated-01', False, None),
        ('e2-5223-difficult-03', True, '5'),
        ('e2-5223-related-02', True, '1'),
        ('e2-5223-unrelated-01', False, None),
    ],
)
def test_current_deterministic_policy_is_reproducible(
    benchmark_cases,
    references_by_occupation,
    case_id: str,
    accepted: bool,
    predicted_ilo_task_id: str | None,
) -> None:
    case = benchmark_cases[case_id]
    result = evaluate_case(
        case,
        references_by_occupation[case['occupation_code']],
        CURRENT_PRODUCTION_THRESHOLD,
    )
    assert result['accepted'] is accepted
    assert result['predicted_ilo_task_id'] == predicted_ilo_task_id


def test_exact_linked_reference_remains_accepted_at_a_high_evaluation_threshold(
    benchmark_cases,
    references_by_occupation,
) -> None:
    case = benchmark_cases['e2-5222-exact-01']
    result = evaluate_case(case, references_by_occupation['5222'], threshold=0.99)
    assert result['accepted'] is True
    assert result['policy_layer'] == 'exact'
    assert result['top_similarity'] == 1.0


def test_offline_guard_rejects_socket_connections() -> None:
    with network_blocked(), pytest.raises(RuntimeError, match='Network access is disabled'):
        socket.create_connection(('example.com', 443))
