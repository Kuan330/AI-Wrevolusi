"""HTTP-level contract tests for the candidate-constrained AI endpoints.

These tests deliberately use caller-supplied fixtures and disable startup table
creation. They do not exercise, or claim to exercise, an external database.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any

from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

# The repository's local .env is not a test dependency. Keep collection and
# endpoint tests deterministic without opening a database connection.
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://postgres:postgres@localhost:5432/aiwrevolusi'
os.environ['AUTO_CREATE_TABLES'] = 'false'
os.environ['JWT_SECRET_KEY'] = 'test-only-ai-api-contract-key'


ENDPOINTS = (
    '/api/v1/ai/task-match',
    '/api/v1/ai/occupation-suggestions',
    '/api/v1/ai/occupation-recommendations',
    '/api/v1/ai/skill-match',
)

TASK_CANDIDATES = [
    {'id': 'task-A', 'text': 'prepare weekly sales report and review sales data'},
    {'id': 'task-B', 'text': 'stock shelves and receive deliveries'},
]

OCCUPATION_CANDIDATES = [
    {
        'code': '2512',
        'title': 'Software developers',
        'description': 'Design, build, test, and maintain software applications.',
    },
    {
        'code': '2221',
        'title': 'Nursing professionals',
        'description': 'Provide patient care and support clinical treatment.',
    },
]

RECOMMENDATION_CANDIDATES = [
    {
        'code': '2511',
        'title': 'Systems analysts',
        'why_similar': 'Analyse business requirements and design software solutions.',
    },
    {
        'code': '2513',
        'title': 'Web and multimedia developers',
        'why_similar': 'Build and maintain software applications and web products.',
    },
]

SKILL_CANDIDATES = [
    {'id': 10, 'skill': 'Service orientation and customer service'},
    {'id': 7, 'skill': 'Empathy and active listening'},
    {'id': 21, 'skill': 'Reading, writing and mathematics'},
    {'id': 99, 'skill': 'A candidate not covered by the rules'},
]

FORBIDDEN_CLAIM_RE = re.compile(
    r'\b(?:job\s+loss|lose\s+your\s+job|unemployment|job\s+replacement|'
    r'skill\s+gap|skills\s+gap|you\s+lack\s+skills)\b',
    re.IGNORECASE,
)
DATE_PREDICTION_RE = re.compile(
    r'\b(?:20\d{2}|in\s+\d+\s+(?:month|months|year|years))\b',
    re.IGNORECASE,
)


def _make_app():
    from app.main import create_app

    return create_app('/api')


def _json_response(response) -> Any:
    """Require an actual JSON response rather than a text/HTML fallback."""

    assert response.headers.get('content-type', '').startswith('application/json')
    assert '```' not in response.text
    return response.json()


def _resolve_schema(application, schema: dict[str, Any]) -> dict[str, Any]:
    if '$ref' not in schema:
        return schema
    name = schema['$ref'].rsplit('/', 1)[-1]
    return application.openapi()['components']['schemas'][name]


def _operation_schema(application, path: str, response: bool) -> dict[str, Any]:
    operation = application.openapi()['paths'][path]['post']
    if response:
        schema = operation['responses']['200']['content']['application/json']['schema']
    else:
        schema = operation['requestBody']['content']['application/json']['schema']
    return _resolve_schema(application, schema)


def _valid_requests() -> dict[str, dict[str, Any]]:
    return {
        '/api/v1/ai/task-match': {
            'occupation_code': '5222',
            'user_task': 'prepare weekly sales report and review sales data',
            'candidates': TASK_CANDIDATES,
        },
        '/api/v1/ai/occupation-suggestions': {
            'user_description': 'I design and build software applications and debug code.',
            'extracted': {
                'actions': ['design', 'build', 'debug'],
                'objects': ['software applications', 'code'],
                'scope': ['product team'],
                'industry': ['technology'],
            },
            'candidates': OCCUPATION_CANDIDATES,
        },
        '/api/v1/ai/occupation-recommendations': {
            'selected_occupation': {'code': '2512', 'title': 'Software developers'},
            'user_context': {'industry': 'technology', 'scope': 'product team'},
            'candidates': RECOMMENDATION_CANDIDATES,
        },
        '/api/v1/ai/skill-match': {
            'task_text': 'Provide customer service and explain the warranty.',
            'candidates': SKILL_CANDIDATES,
        },
    }


def test_all_four_ai_routes_are_registered_with_json_request_and_response_schemas() -> None:
    application = _make_app()
    paths = application.openapi()['paths']

    for path in ENDPOINTS:
        assert path in paths
        operation = paths[path]['post']
        assert 'application/json' in operation['requestBody']['content']
        assert 'application/json' in operation['responses']['200']['content']
        assert '$ref' in operation['responses']['200']['content']['application/json']['schema']


def test_ai_router_routes_are_registered_once() -> None:
    """Catch duplicate include_router wiring without depending on route order."""

    application = _make_app()
    ai_routes = [
        route
        for route in application.routes
        if isinstance(route, APIRoute) and route.path.startswith('/api/v1/ai/')
    ]
    signatures = [(route.path, tuple(sorted(route.methods or ()))) for route in ai_routes]

    assert len(signatures) == len(set(signatures))


def test_ai_request_and_response_schemas_expose_the_contract_fields() -> None:
    application = _make_app()
    expected_request_fields = {
        '/api/v1/ai/task-match': {'occupation_code', 'user_task', 'candidates'},
        '/api/v1/ai/occupation-suggestions': {'user_description', 'candidates'},
        '/api/v1/ai/occupation-recommendations': {'selected_occupation', 'candidates'},
        '/api/v1/ai/skill-match': {'task_text', 'candidates'},
    }
    expected_response_fields = {
        '/api/v1/ai/task-match': {
            'candidate_id',
            'confidence',
            'matched_concepts',
            'unmatched_concepts',
            'reason',
            'clarifying_question',
        },
        '/api/v1/ai/occupation-suggestions': {
            'status',
            'candidates',
            'clarifying_questions',
        },
        '/api/v1/ai/occupation-recommendations': {
            'status',
            'candidates',
            'clarifying_questions',
        },
        '/api/v1/ai/skill-match': {'skills'},
    }

    for path in ENDPOINTS:
        request_schema = _operation_schema(application, path, response=False)
        response_schema = _operation_schema(application, path, response=True)
        assert expected_request_fields[path] <= set(request_schema.get('properties', {}))
        assert expected_response_fields[path] <= set(response_schema.get('properties', {}))


def test_valid_endpoint_responses_are_json_and_keep_outputs_inside_supplied_candidates() -> None:
    application = _make_app()
    requests = _valid_requests()

    with TestClient(application) as client:
        for path, request in requests.items():
            response = client.post(path, json=request)
            assert response.status_code == 200, (path, response.text)
            payload = _json_response(response)

            if path.endswith('task-match'):
                assert payload['candidate_id'] in {'', *(item['id'] for item in TASK_CANDIDATES)}
            elif path.endswith('occupation-suggestions'):
                allowed = {item['code'] for item in OCCUPATION_CANDIDATES}
                assert all(item['occupation_code'] in allowed for item in payload['candidates'])
            elif path.endswith('occupation-recommendations'):
                allowed = {item['code'] for item in RECOMMENDATION_CANDIDATES}
                assert all(item['occupation_code'] in allowed for item in payload['candidates'])
            else:
                allowed = {item['id'] for item in SKILL_CANDIDATES}
                assert all(item['wef_skill_id'] in allowed for item in payload['skills'])


def test_published_and_runtime_output_limits_are_bounded() -> None:
    application = _make_app()
    limits = {
        '/api/v1/ai/task-match': {'matched_concepts': 50, 'unmatched_concepts': 50},
        '/api/v1/ai/occupation-suggestions': {'candidates': 5},
        '/api/v1/ai/occupation-recommendations': {'candidates': 5},
        '/api/v1/ai/skill-match': {'skills': 2},
    }

    with TestClient(application) as client:
        requests = _valid_requests()
        for path, fields in limits.items():
            schema = _operation_schema(application, path, response=True)
            properties = schema['properties']
            response = client.post(path, json=requests[path])
            assert response.status_code == 200, (path, response.text)
            payload = _json_response(response)
            for field, limit in fields.items():
                assert properties[field].get('maxItems') == limit
                assert len(payload[field]) <= limit


def test_skill_evidence_phrases_are_exact_substrings_of_the_supplied_task() -> None:
    application = _make_app()
    task_text = 'Provide customer service and explain the warranty.'

    with TestClient(application) as client:
        response = client.post(
            '/api/v1/ai/skill-match',
            json={'task_text': task_text, 'candidates': SKILL_CANDIDATES},
        )

    assert response.status_code == 200
    payload = _json_response(response)
    assert payload['skills']
    for item in payload['skills']:
        for phrase in item['evidence_phrases']:
            assert phrase in task_text


def test_no_fit_returns_empty_or_clarifying_json_without_prohibited_predictions() -> None:
    application = _make_app()
    requests = {
        '/api/v1/ai/task-match': {
            'occupation_code': '5222',
            'user_task': 'Repair satellites in deep space.',
            'candidates': TASK_CANDIDATES,
        },
        '/api/v1/ai/occupation-suggestions': {
            'user_description': 'Repair satellites in deep space.',
            'candidates': OCCUPATION_CANDIDATES,
        },
        '/api/v1/ai/occupation-recommendations': {
            'selected_occupation': {'code': '2512', 'title': 'Software developers'},
            'user_context': {},
            'candidates': [
                {'code': '2221', 'title': 'Nursing professionals', 'why_similar': ''},
            ],
        },
        '/api/v1/ai/skill-match': {
            'task_text': 'Repair satellites in deep space.',
            'candidates': SKILL_CANDIDATES,
        },
    }

    with TestClient(application) as client:
        for path, request in requests.items():
            response = client.post(path, json=request)
            assert response.status_code == 200, (path, response.text)
            payload = _json_response(response)
            rendered = json.dumps(payload, ensure_ascii=False)
            assert not FORBIDDEN_CLAIM_RE.search(rendered)
            assert not DATE_PREDICTION_RE.search(rendered)

            if path.endswith('task-match'):
                assert payload['candidate_id'] == ''
                assert payload['clarifying_question']
            elif path.endswith('skill-match'):
                assert payload['skills'] == []
            else:
                assert payload['status'] == 'clarifying'
                assert payload['candidates'] == []
                assert payload['clarifying_questions']


def test_malformed_requests_return_json_validation_errors() -> None:
    application = _make_app()

    with TestClient(application) as client:
        for path in ENDPOINTS:
            response = client.post(path, json={})
            assert response.status_code == 422
            payload = _json_response(response)
            assert isinstance(payload, dict)
            assert payload.get('detail')


def test_task_match_provider_exception_returns_a_safe_json_fallback() -> None:
    application = _make_app()
    from app.routers.ai import get_task_match_provider

    class BrokenProvider:
        def match_task(self, *_args, **_kwargs):
            raise RuntimeError('simulated provider outage')

    application.dependency_overrides[get_task_match_provider] = lambda: BrokenProvider()
    try:
        with TestClient(application) as client:
            response = client.post(
                '/api/v1/ai/task-match',
                json={
                    'occupation_code': '5222',
                    'user_task': 'prepare a report',
                    'candidates': TASK_CANDIDATES,
                },
            )
    finally:
        application.dependency_overrides.clear()

    assert response.status_code == 200
    payload = _json_response(response)
    assert payload['candidate_id'] == ''
    assert payload['confidence'] == 0.0
    assert payload['clarifying_question']


def test_task_match_malformed_provider_output_cannot_invent_a_candidate() -> None:
    application = _make_app()
    from app.routers.ai import get_task_match_provider

    class MalformedProvider:
        def match_task(self, *_args, **_kwargs):
            return {
                'candidate_id': 'provider-invented-id',
                'confidence': 'not-a-number',
                'matched_concepts': 'not-a-list',
                'unmatched_concepts': [],
                'reason': 'provider output',
            }

    application.dependency_overrides[get_task_match_provider] = lambda: MalformedProvider()
    try:
        with TestClient(application) as client:
            response = client.post(
                '/api/v1/ai/task-match',
                json={
                    'occupation_code': '5222',
                    'user_task': 'prepare a report',
                    'candidates': TASK_CANDIDATES,
                },
            )
    finally:
        application.dependency_overrides.clear()

    assert response.status_code == 200
    payload = _json_response(response)
    assert payload['candidate_id'] == ''
    assert payload['confidence'] == 0.0
    assert payload['clarifying_question']
