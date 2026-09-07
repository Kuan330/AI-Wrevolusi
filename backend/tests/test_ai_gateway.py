from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from app.main import create_app
from app.routers.ai import get_ai_gateway
from app.routers.ai import get_task_match_provider
from app.services.ai_gateway import AIGateway
from fastapi.testclient import TestClient


class ExampleResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    answer: int


class StaticJSONProvider:
    name = 'test-provider'

    def __init__(self, response: Any) -> None:
        self.response = response

    def complete_json(self, **_kwargs: Any) -> Any:
        return self.response


def test_gateway_validates_provider_json_as_a_pydantic_model() -> None:
    gateway = AIGateway(provider=StaticJSONProvider('{"answer": 7}'))

    result = gateway.run_structured(
        operation='example',
        payload={'question': 'six plus one'},
        response_model=ExampleResponse,
        local=lambda: {'answer': 0},
        fallback=lambda: {'answer': -1},
    )

    assert result.value == ExampleResponse(answer=7)


def test_gateway_contains_malformed_json_and_returns_validated_fallback() -> None:
    gateway = AIGateway(provider=StaticJSONProvider('not valid JSON'))

    result = gateway.run_structured(
        operation='example',
        payload={},
        response_model=ExampleResponse,
        local=lambda: {'answer': 0},
        fallback=lambda: {'answer': -1},
    )

    assert result.value == ExampleResponse(answer=-1)
    assert result.metadata.used_fallback is True
    assert result.metadata.error == 'ValueError'


def test_gateway_retries_provider_failures_within_the_configured_limit() -> None:
    class EventuallyAvailableProvider:
        name = 'eventually-available'

        def __init__(self) -> None:
            self.calls = 0

        def complete_json(self, **_kwargs: Any) -> Any:
            self.calls += 1
            if self.calls == 1:
                raise TimeoutError('simulated timeout')
            return {'answer': 9}

    provider = EventuallyAvailableProvider()
    gateway = AIGateway(provider=provider, max_attempts=2)

    result = gateway.run_structured(
        operation='example',
        payload={},
        response_model=ExampleResponse,
        local=lambda: {'answer': 0},
        fallback=lambda: {'answer': -1},
    )

    assert result.value.answer == 9
    assert result.metadata.attempts == 2
    assert provider.calls == 2


def test_gateway_cache_avoids_repeating_a_provider_call() -> None:
    provider = StaticJSONProvider({'answer': 11})
    provider.calls = 0
    original_complete = provider.complete_json

    def counting_complete(**kwargs: Any) -> Any:
        provider.calls += 1
        return original_complete(**kwargs)

    provider.complete_json = counting_complete  # type: ignore[method-assign]
    gateway = AIGateway(provider=provider)
    arguments = {
        'operation': 'example',
        'payload': {'same': 'request'},
        'response_model': ExampleResponse,
        'local': lambda: {'answer': 0},
        'fallback': lambda: {'answer': -1},
    }

    first = gateway.run_structured(**arguments)
    second = gateway.run_structured(**arguments)

    assert first.metadata.cached is False
    assert second.metadata.cached is True
    assert provider.calls == 1


def test_gateway_rejects_an_invalid_fallback_contract() -> None:
    gateway = AIGateway(provider=StaticJSONProvider('not valid JSON'))

    try:
        gateway.run_structured(
            operation='example',
            payload={},
            response_model=ExampleResponse,
            local=lambda: {'answer': 0},
            fallback=lambda: {'wrong': 'shape'},
        )
    except ValueError as exc:
        assert 'fallback' in str(exc)
    else:
        raise AssertionError('invalid fallback should be rejected')


def test_occupation_route_uses_gateway_output_but_keeps_the_candidate_allowlist() -> None:
    class Provider:
        name = 'fixture-provider'

        def complete_json(self, **_kwargs: Any) -> Any:
            return {
                'status': 'suggestions',
                'candidates': [
                    {
                        'occupation_code': 'invented-code',
                        'title': 'Invented occupation',
                        'confidence': 0.99,
                        'evidence': [],
                        'difference': 'Invented result',
                    },
                    {
                        'occupation_code': '2512',
                        'title': 'Provider title must not replace supplied title',
                        'confidence': 0.90,
                        'evidence': [],
                        'difference': 'Supplied comparison',
                    },
                ],
                'clarifying_questions': [],
            }

    application = create_app('/api')
    application.dependency_overrides[get_ai_gateway] = lambda: AIGateway(
        provider=Provider()
    )
    try:
        with TestClient(application) as client:
            response = client.post(
                '/api/v1/ai/occupation-suggestions',
                json={
                    'user_description': 'Design software applications.',
                    'candidates': [
                        {
                            'code': '2512',
                            'title': 'Software developers',
                            'description': 'Design software applications.',
                        }
                    ],
                },
            )
    finally:
        application.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert [item['occupation_code'] for item in payload['candidates']] == ['2512']
    assert payload['candidates'][0]['title'] == 'Software developers'


def test_task_route_uses_the_shared_gateway_provider_before_contract_enforcement() -> None:
    class Provider:
        name = 'fixture-provider'

        def complete_json(self, **_kwargs: Any) -> Any:
            return '{"candidate_id":"task-2","confidence":0.90,"matched_concepts":["stock"],"unmatched_concepts":[],"reason":"fixture"}'

    application = create_app('/api')
    application.dependency_overrides[get_ai_gateway] = lambda: AIGateway(
        provider=Provider()
    )
    try:
        with TestClient(application) as client:
            response = client.post(
                '/api/v1/ai/task-match',
                json={
                    'occupation_code': '5222',
                    'user_task': 'Prepare the weekly sales report.',
                    'candidates': [
                        {'id': 'task-1', 'text': 'Prepare weekly sales reports.'},
                        {'id': 'task-2', 'text': 'Stock shelves and receive deliveries.'},
                    ],
                },
            )
    finally:
        application.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()['candidate_id'] == 'task-2'


def test_skill_route_uses_a_safe_gateway_fallback_for_malformed_provider_json() -> None:
    class Provider:
        name = 'fixture-provider'

        def complete_json(self, **_kwargs: Any) -> Any:
            return '{malformed'

    application = create_app('/api')
    application.dependency_overrides[get_ai_gateway] = lambda: AIGateway(
        provider=Provider()
    )
    try:
        with TestClient(application) as client:
            response = client.post(
                '/api/v1/ai/skill-match',
                json={
                    'task_text': 'Provide customer service.',
                    'candidates': [
                        {'id': 10, 'skill': 'Customer service'},
                    ],
                },
            )
    finally:
        application.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json()['skills'] == []


def test_gateway_uses_the_local_deterministic_path_when_provider_fails() -> None:
    gateway = AIGateway(provider=StaticJSONProvider('not valid JSON'))

    result = gateway.run_structured(
        operation='example-local-fallback',
        payload={},
        response_model=ExampleResponse,
        local=lambda: {'answer': 3},
        fallback=lambda: {'answer': -1},
        prefer_local_on_provider_failure=True,
    )

    assert result.value.answer == 3
    assert result.metadata.used_fallback is True


def test_skill_provider_evidence_must_be_an_exact_task_substring() -> None:
    class Provider:
        name = 'fixture-provider'

        def complete_json(self, **_kwargs: Any) -> Any:
            return {
                'skills': [
                    {
                        'wef_skill_id': 10,
                        'confidence': 0.99,
                        'evidence_phrases': ['provider invented evidence'],
                    }
                ]
            }

    application = create_app('/api')
    application.dependency_overrides[get_ai_gateway] = lambda: AIGateway(provider=Provider())
    try:
        with TestClient(application) as client:
            response = client.post(
                '/api/v1/ai/skill-match',
                json={
                    'task_text': 'Provide customer service.',
                    'candidates': [{'id': 10, 'skill': 'Service orientation'}],
                },
            )
    finally:
        application.dependency_overrides.clear()

    assert response.status_code == 200
    assert response.json() == {'skills': []}


def test_occupation_provider_failure_uses_the_deterministic_local_result() -> None:
    class BrokenProvider:
        name = 'broken-provider'

        def complete_json(self, **_kwargs: Any) -> Any:
            raise TimeoutError('provider unavailable')

    application = create_app('/api')
    application.dependency_overrides[get_ai_gateway] = lambda: AIGateway(
        provider=BrokenProvider()
    )
    try:
        with TestClient(application) as client:
            response = client.post(
                '/api/v1/ai/occupation-suggestions',
                json={
                    'user_description': 'Design software applications.',
                    'candidates': [
                        {
                            'code': '2512',
                            'title': 'Software developers',
                            'description': 'Design software applications.',
                        }
                    ],
                },
            )
    finally:
        application.dependency_overrides.clear()

    assert response.status_code == 200
    payload = response.json()
    assert payload['status'] == 'suggestions'
    assert payload['candidates'][0]['occupation_code'] == '2512'
