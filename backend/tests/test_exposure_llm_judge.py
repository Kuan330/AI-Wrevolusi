"""Tests for the optional LLM task-match judge and its exposure wiring.

Every test here runs offline: the gateway provider is a static fixture whose
``complete_json`` never touches the network.
"""

from __future__ import annotations

from typing import Any

from fastapi.testclient import TestClient

import app.services.exposure as exposure_service
from app.constants.exposure_types import ExposureType
from app.schemas.exposure import ConfirmedTaskExposureAssessmentRequestItem
from app.services.ai_gateway import AIGateway
from app.services.ai_task_judge import LLMTaskMatchJudge
from app.services.exposure import (
    IloTaskExposureReference,
    assess_confirmed_task_against_ilo_references,
    build_exposure_score_explanation,
    describe_adjusted_exposure_score_band,
)

REFERENCE_TASKS = [
    IloTaskExposureReference(
        ilo_task_id='1',
        task_text='Planning and preparing work schedules and assigning staff to specific duties;',
        score_2025=0.525,
        source_method='predicted',
        potential25='Exposed: Gradient 3',
    ),
    IloTaskExposureReference(
        ilo_task_id='2',
        task_text='Instructing staff on sales procedures and handling difficult cases;',
        score_2025=0.365,
        source_method='predicted',
        potential25='Minimal Exposure',
    ),
    IloTaskExposureReference(
        ilo_task_id='3',
        task_text='Ensuring that customers receive prompt service;',
        score_2025=0.515,
        source_method='predicted',
        potential25='Exposed: Gradient 3',
    ),
]

BORDERLINE_TASK_TEXT = 'Prepare staff work schedules and assign duties for each shift'
UNRELATED_TASK_TEXT = 'Tune guitars and perform songs at a wedding'


class StaticJSONProvider:
    """Provider fixture that returns a fixed JSON object and counts calls."""

    name = 'static-test-provider'

    def __init__(self, response: Any) -> None:
        self.response = response
        self.calls = 0

    def complete_json(self, **_kwargs: Any) -> Any:
        self.calls += 1
        return self.response


class BrokenProvider:
    name = 'broken-test-provider'

    def complete_json(self, **_kwargs: Any) -> Any:
        raise RuntimeError('provider unavailable')


def _build_judge(response: Any) -> tuple[LLMTaskMatchJudge, StaticJSONProvider]:
    provider = StaticJSONProvider(response)
    return LLMTaskMatchJudge(AIGateway(provider=provider)), provider


def _selecting_response(candidate_id: str, confidence: float) -> dict:
    return {
        'candidate_id': candidate_id,
        'confidence': confidence,
        'matched_concepts': ['schedules'],
        'unmatched_concepts': [],
        'reason': 'The supplied candidate shares the strongest task concepts.',
        'clarifying_question': None,
    }


# ---------------------------------------------------------------------------
# Judge behaviour
# ---------------------------------------------------------------------------


def test_judge_is_unavailable_without_a_configured_provider() -> None:
    judge = LLMTaskMatchJudge(AIGateway())

    assert judge.available is False
    assert judge.match_task('5222', 'do the work', []) is None


def test_judge_returns_a_contract_validated_selection() -> None:
    judge, provider = _build_judge(_selecting_response('2', 0.82))
    candidates = [
        exposure_service.TaskMatchCandidate(id=task.ilo_task_id, text=task.task_text)
        for task in REFERENCE_TASKS
    ]

    result = judge.match_task('5222', BORDERLINE_TASK_TEXT, candidates)

    assert result is not None
    assert result.candidate_id == '2'
    assert result.confidence == 0.82
    assert provider.calls == 1


def test_judge_rejects_an_unknown_identifier() -> None:
    judge, _provider = _build_judge(_selecting_response('provider-invented-id', 0.99))
    candidates = [
        exposure_service.TaskMatchCandidate(id=task.ilo_task_id, text=task.task_text)
        for task in REFERENCE_TASKS
    ]

    assert judge.match_task('5222', BORDERLINE_TASK_TEXT, candidates) is None


def test_judge_swallows_provider_errors() -> None:
    judge = LLMTaskMatchJudge(AIGateway(provider=BrokenProvider()))
    candidates = [
        exposure_service.TaskMatchCandidate(id=task.ilo_task_id, text=task.task_text)
        for task in REFERENCE_TASKS
    ]

    assert judge.match_task('5222', BORDERLINE_TASK_TEXT, candidates) is None


# ---------------------------------------------------------------------------
# Exposure wiring
# ---------------------------------------------------------------------------


def test_borderline_similarity_uses_the_llm_match_layer(monkeypatch) -> None:
    monkeypatch.setattr(exposure_service, 'LLM_JUDGE_BORDERLINE_SIMILARITY_UPPER', 100.0)
    judge, provider = _build_judge(_selecting_response('2', 0.82))

    assessment = assess_confirmed_task_against_ilo_references(
        ConfirmedTaskExposureAssessmentRequestItem(
            task_id='task-llm-1',
            task_text=BORDERLINE_TASK_TEXT,
        ),
        REFERENCE_TASKS,
        occupation_code='5222',
        llm_judge=judge,
    )

    assert provider.calls == 1
    assert assessment.match_layer == 'llm'
    assert assessment.confidence == 0.82
    assert assessment.matched_reference_tasks[0].ilo_task_id == '2'
    assert assessment.baseline_score == 0.365
    assert 'language-model review' in assessment.reasoning


def test_exact_match_never_consults_the_judge(monkeypatch) -> None:
    monkeypatch.setattr(exposure_service, 'LLM_JUDGE_BORDERLINE_SIMILARITY_UPPER', 100.0)
    judge, provider = _build_judge(_selecting_response('2', 0.82))

    assessment = assess_confirmed_task_against_ilo_references(
        ConfirmedTaskExposureAssessmentRequestItem(
            task_id='task-exact',
            task_text=REFERENCE_TASKS[0].task_text,
            ilo_task_id='1',
        ),
        REFERENCE_TASKS,
        occupation_code='5222',
        llm_judge=judge,
    )

    assert provider.calls == 0
    assert assessment.match_layer == 'exact'


def test_judge_failure_keeps_the_deterministic_nlp_result(monkeypatch) -> None:
    monkeypatch.setattr(exposure_service, 'LLM_JUDGE_BORDERLINE_SIMILARITY_UPPER', 100.0)
    judge = LLMTaskMatchJudge(AIGateway(provider=BrokenProvider()))

    assessment = assess_confirmed_task_against_ilo_references(
        ConfirmedTaskExposureAssessmentRequestItem(
            task_id='task-llm-fail',
            task_text=BORDERLINE_TASK_TEXT,
        ),
        REFERENCE_TASKS,
        occupation_code='5222',
        llm_judge=judge,
    )

    assert assessment.match_layer == 'nlp'
    assert assessment.confidence >= 0.18


def test_below_floor_stays_insufficient_without_explicit_opt_in() -> None:
    judge, provider = _build_judge(_selecting_response('3', 0.90))

    assessment = assess_confirmed_task_against_ilo_references(
        ConfirmedTaskExposureAssessmentRequestItem(
            task_id='task-no-optin',
            task_text=UNRELATED_TASK_TEXT,
        ),
        REFERENCE_TASKS,
        occupation_code='5222',
        llm_judge=judge,
    )

    assert provider.calls == 0
    assert assessment.suggested_state == ExposureType.insufficient_data
    assert assessment.match_layer == 'insufficient_data'


def test_explicit_opt_in_can_rescue_a_below_floor_match() -> None:
    judge, provider = _build_judge(_selecting_response('3', 0.90))

    assessment = assess_confirmed_task_against_ilo_references(
        ConfirmedTaskExposureAssessmentRequestItem(
            task_id='task-rescued',
            task_text=UNRELATED_TASK_TEXT,
        ),
        REFERENCE_TASKS,
        occupation_code='5222',
        llm_judge=judge,
        prefer_llm_match=True,
    )

    assert provider.calls == 1
    assert assessment.match_layer == 'llm'
    assert assessment.matched_reference_tasks[0].ilo_task_id == '3'
    assert assessment.baseline_score == 0.515


# ---------------------------------------------------------------------------
# Score context
# ---------------------------------------------------------------------------


def test_score_band_boundaries_are_stable() -> None:
    assert describe_adjusted_exposure_score_band(0.10) == 'low'
    assert describe_adjusted_exposure_score_band(0.30) == 'moderate'
    assert describe_adjusted_exposure_score_band(0.60) == 'high'


def test_score_explanation_states_source_calculation_and_non_prediction() -> None:
    explanation = build_exposure_score_explanation(
        0.43,
        0.38,
        'routine processing: high',
        has_context=True,
    )

    assert explanation.startswith('How to read this value')
    assert 'band: moderate' in explanation
    assert 'not a date or a job outcome' in explanation


def test_matched_assessment_exposes_the_score_context_fields() -> None:
    assessment = assess_confirmed_task_against_ilo_references(
        ConfirmedTaskExposureAssessmentRequestItem(
            task_id='task-score-context',
            task_text=REFERENCE_TASKS[0].task_text,
            ilo_task_id='1',
        ),
        REFERENCE_TASKS,
    )

    assert assessment.score_band in {'low', 'moderate', 'high'}
    assert assessment.score_scale
    assert assessment.score_explanation
    assert 'not a date or a job outcome' in assessment.score_explanation


def test_insufficient_assessment_has_no_score_context() -> None:
    assessment = assess_confirmed_task_against_ilo_references(
        ConfirmedTaskExposureAssessmentRequestItem(
            task_id='task-no-score',
            task_text=UNRELATED_TASK_TEXT,
        ),
        REFERENCE_TASKS,
    )

    assert assessment.score_band is None
    assert assessment.score_scale is None
    assert assessment.score_explanation is None


# ---------------------------------------------------------------------------
# Endpoint wiring
# ---------------------------------------------------------------------------


class FakeReferenceQueryResult:
    def mappings(self) -> 'FakeReferenceQueryResult':
        return self

    def all(self) -> list[dict]:
        return [
            {
                'task_id': task.ilo_task_id,
                'task_text': task.task_text,
                'score_2025': task.score_2025,
                'source': task.source_method,
                'potential25': task.potential25,
            }
            for task in REFERENCE_TASKS
        ]


class FakeDatabaseSession:
    async def execute(self, *_args, **_kwargs) -> FakeReferenceQueryResult:
        return FakeReferenceQueryResult()


def test_exposure_endpoint_applies_the_llm_judge_when_opted_in() -> None:
    from app.db.session import get_db
    from app.main import create_app
    from app.routers.exposure import get_exposure_llm_judge

    application = create_app('/api')

    async def provide_fake_database_session():
        yield FakeDatabaseSession()

    judge, provider = _build_judge(_selecting_response('2', 0.82))
    application.dependency_overrides[get_db] = provide_fake_database_session
    application.dependency_overrides[get_exposure_llm_judge] = lambda: judge
    try:
        with TestClient(application) as client:
            response = client.post(
                '/api/v1/exposure/assessments',
                json={
                    'occupation_code': '5222',
                    'prefer_llm_match': True,
                    'confirmed_tasks': [
                        {
                            'task_id': 'task-endpoint-1',
                            'task_text': BORDERLINE_TASK_TEXT,
                            'ilo_task_id': '1',
                            'context': {},
                        }
                    ],
                },
            )
    finally:
        application.dependency_overrides.clear()

    assert response.status_code == 200
    assessment = response.json()['assessments'][0]
    assert provider.calls == 1
    assert assessment['match_layer'] == 'llm'
    assert assessment['score_band'] in {'low', 'moderate', 'high'}
    assert assessment['score_explanation']
