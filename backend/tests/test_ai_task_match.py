from fastapi.testclient import TestClient

from app.main import create_app
from app.routers.ai import get_task_match_provider
from app.schemas.ai_matching import TaskMatchResponse
from app.services.ai_matching import (
    MINIMUM_TASK_MATCH_WORDS,
    TaskMatchProviderResult,
    count_task_text_words_for_matching,
    enforce_task_match_contract,
)


CANDIDATES = [
    {'id': 'task-1', 'text': 'Prepare weekly sales reports and review sales data'},
    {'id': 'task-2', 'text': 'Stock shelves and receive deliveries'},
]


class FixedProvider:
    def __init__(self, result: TaskMatchProviderResult) -> None:
        self.result = result

    def match_task(self, *_args, **_kwargs) -> TaskMatchProviderResult:
        return self.result


def test_task_match_route_is_published_with_a_structured_response() -> None:
    application = create_app('/api')
    paths = application.openapi()['paths']

    assert '/api/v1/ai/task-match' in paths
    operation = paths['/api/v1/ai/task-match']['post']
    response_schema = operation['responses']['200']['content']['application/json']['schema']
    assert response_schema['$ref'].endswith('/TaskMatchResponse')


def test_task_match_returns_a_candidate_from_the_supplied_list() -> None:
    application = create_app('/api')

    with TestClient(application) as client:
        response = client.post(
            '/api/v1/ai/task-match',
            json={
                'occupation_code': '5222',
                'user_task': 'I prepare the weekly sales report and review sales data',
                'candidates': CANDIDATES,
            },
        )

    assert response.status_code == 200
    assert response.headers['content-type'].startswith('application/json')
    payload = response.json()
    parsed = TaskMatchResponse.model_validate(payload)
    assert parsed.candidate_id == 'task-1'
    assert parsed.confidence >= 0.5
    assert isinstance(parsed.matched_concepts, list)
    assert isinstance(parsed.unmatched_concepts, list)
    assert parsed.reason


def test_task_match_returns_empty_candidate_and_question_when_nothing_fits() -> None:
    application = create_app('/api')

    with TestClient(application) as client:
        response = client.post(
            '/api/v1/ai/task-match',
            json={
                'occupation_code': '5222',
                'user_task': 'Repair satellites in deep space orbits',
                'candidates': CANDIDATES,
            },
        )

    assert response.status_code == 200
    payload = TaskMatchResponse.model_validate(response.json())
    assert payload.candidate_id == ''
    assert payload.confidence < 0.5
    assert payload.clarifying_question
    assert payload.status == 'no_match'


def test_shared_word_count_rule_matches_the_documented_examples() -> None:
    examples = [
        ('', 0),
        ('   ...  ', 0),
        ('the and of', 0),
        ('shop supervisor', 2),
        ('Managing a small team of staff', 4),
        ('manage shifts and tasks', 3),
        ('I manage the shop', 3),
        ('Open the store, serve customers, and close registers', 6),
        ('负责管理团队排班并跟进客户投诉处理', 1),
        ('管理 team 的任务', 3),
    ]

    for value, expected in examples:
        assert count_task_text_words_for_matching(value) == expected, value
    assert MINIMUM_TASK_MATCH_WORDS == 5


def test_task_match_below_the_word_gate_selects_nothing_and_skips_the_matcher() -> None:
    application = create_app('/api')

    class ExplodingProvider:
        def match_task(self, *_args, **_kwargs):
            raise AssertionError('the matcher must not run below the word gate')

    application.dependency_overrides[get_task_match_provider] = (
        lambda: ExplodingProvider()
    )
    try:
        with TestClient(application) as client:
            response = client.post(
                '/api/v1/ai/task-match',
                json={
                    'occupation_code': '5222',
                    'user_task': 'Prepare a report',
                    'candidates': CANDIDATES,
                },
            )
    finally:
        application.dependency_overrides.clear()

    assert response.status_code == 200
    payload = TaskMatchResponse.model_validate(response.json())
    assert payload.status == 'needs_more_input'
    assert payload.candidate_id == ''
    assert payload.confidence == 0.0
    assert payload.matched_concepts == []
    assert payload.clarifying_question


def test_task_match_at_the_word_threshold_runs_the_matcher() -> None:
    application = create_app('/api')
    application.dependency_overrides[get_task_match_provider] = lambda: FixedProvider(
        TaskMatchProviderResult(
            candidate_id='task-1',
            confidence=0.9,
            matched_concepts=['report'],
            unmatched_concepts=[],
            reason='Threshold boundary run.',
        )
    )

    try:
        with TestClient(application) as client:
            response = client.post(
                '/api/v1/ai/task-match',
                json={
                    'occupation_code': '5222',
                    'user_task': 'Prepare weekly sales report data',
                    'candidates': CANDIDATES,
                },
            )
    finally:
        application.dependency_overrides.clear()

    assert response.status_code == 200
    payload = TaskMatchResponse.model_validate(response.json())
    assert payload.status == 'matched'
    assert payload.candidate_id == 'task-1'


def test_contract_rejects_a_provider_candidate_id_not_in_the_request() -> None:
    result = enforce_task_match_contract(
        TaskMatchProviderResult(
            candidate_id='provider-invented-id',
            confidence=0.99,
            matched_concepts=['report'],
            unmatched_concepts=[],
            reason='Provider selected a candidate.',
        ),
        CANDIDATES,
    )

    assert result.candidate_id == ''
    assert result.clarifying_question


def test_contract_rejects_a_valid_candidate_when_confidence_is_below_half() -> None:
    result = enforce_task_match_contract(
        TaskMatchProviderResult(
            candidate_id='task-1',
            confidence=0.49,
            matched_concepts=['report'],
            unmatched_concepts=['weekly'],
            reason='The wording is ambiguous.',
        ),
        CANDIDATES,
    )

    assert result.candidate_id == ''
    assert result.confidence == 0.49
    assert result.clarifying_question


def test_route_enforces_the_candidate_allowlist_after_provider_output() -> None:
    application = create_app('/api')
    application.dependency_overrides[get_task_match_provider] = lambda: FixedProvider(
        TaskMatchProviderResult(
            candidate_id='not-a-request-candidate',
            confidence=0.98,
            matched_concepts=[],
            unmatched_concepts=['everything'],
            reason='Untrusted provider output.',
        )
    )

    try:
        with TestClient(application) as client:
            response = client.post(
                '/api/v1/ai/task-match',
                json={
                    'occupation_code': '5222',
                    'user_task': 'Prepare a weekly report for the sales team',
                    'candidates': CANDIDATES,
                },
            )
    finally:
        application.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()['candidate_id'] == ''


def test_route_enforces_the_confidence_floor_after_provider_output() -> None:
    application = create_app('/api')
    application.dependency_overrides[get_task_match_provider] = lambda: FixedProvider(
        TaskMatchProviderResult(
            candidate_id='task-1',
            confidence=0.499,
            matched_concepts=['report'],
            unmatched_concepts=[],
            reason='Low confidence provider output.',
        )
    )

    try:
        with TestClient(application) as client:
            response = client.post(
                '/api/v1/ai/task-match',
                json={
                    'occupation_code': '5222',
                    'user_task': 'Prepare a weekly report for the sales team',
                    'candidates': CANDIDATES,
                },
            )
    finally:
        application.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload['candidate_id'] == ''
    assert payload['confidence'] == 0.499
    assert payload['clarifying_question']


def test_contract_preserves_candidate_id_bytes_exactly_without_normalising_it() -> None:
    candidates = [{'id': '  task-7  ', 'text': 'Prepare reports'}]
    result = enforce_task_match_contract(
        TaskMatchProviderResult(
            candidate_id='  task-7  ',
            confidence=0.5,
            matched_concepts=['reports'],
            unmatched_concepts=[],
            reason='Exact supplied identifier.',
        ),
        candidates,
    )

    assert result.candidate_id == '  task-7  '
