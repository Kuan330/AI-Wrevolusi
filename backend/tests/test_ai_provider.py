"""Unit tests for the optional OpenAI-compatible provider.

The tests never touch the network: ``httpx.MockTransport`` simulates upstream
responses and retry sleeps are injected no-op functions, so everything here is
deterministic and fast.
"""

from __future__ import annotations

import json
from types import SimpleNamespace

import httpx
import pytest
from pydantic import BaseModel

from app.services.ai_gateway import (
    AIGateway,
    AIProviderError,
    OpenAICompatibleProvider,
    build_provider_from_settings,
)


class Answer(BaseModel):
    answer: int


def _completion_body(content: str) -> dict:
    return {'choices': [{'message': {'content': content}}]}


def _build_provider(handler, **overrides) -> OpenAICompatibleProvider:
    client = httpx.Client(transport=httpx.MockTransport(handler))
    kwargs = {
        'api_key': 'test-key',
        'model': 'test-model',
        'client': client,
        'sleep': lambda _seconds: None,
        'backoff_base_s': 0.0,
    }
    kwargs.update(overrides)
    return OpenAICompatibleProvider(**kwargs)


def _call(provider: OpenAICompatibleProvider):
    return provider.complete_json(
        operation='example',
        payload={'question': 'six plus one'},
        response_model=Answer,
    )


def test_provider_parses_a_valid_json_completion_and_sends_expected_request() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured['authorization'] = request.headers.get('authorization')
        captured['body'] = json.loads(request.content)
        return httpx.Response(200, json=_completion_body('{"answer": 7}'))

    provider = _build_provider(handler)
    result = _call(provider)

    assert result == {'answer': 7}
    assert captured['authorization'] == 'Bearer test-key'
    assert captured['body']['model'] == 'test-model'
    assert captured['body']['messages'][0]['role'] == 'system'
    assert captured['body']['messages'][1]['role'] == 'user'
    assert captured['body']['response_format'] == {'type': 'json_object'}


def test_provider_strips_markdown_code_fences() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_completion_body('```json\n{"answer": 5}\n```'))

    provider = _build_provider(handler)

    assert _call(provider) == {'answer': 5}


def test_provider_retries_a_transient_status_then_succeeds() -> None:
    calls = {'count': 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls['count'] += 1
        if calls['count'] == 1:
            return httpx.Response(503, json={'error': 'unavailable'})
        return httpx.Response(200, json=_completion_body('{"answer": 3}'))

    provider = _build_provider(handler, max_retries=2)

    assert _call(provider) == {'answer': 3}
    assert calls['count'] == 2


def test_provider_raises_after_exhausting_retries() -> None:
    calls = {'count': 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls['count'] += 1
        return httpx.Response(500, json={'error': 'boom'})

    provider = _build_provider(handler, max_retries=2)

    with pytest.raises(AIProviderError):
        _call(provider)
    assert calls['count'] == 3


def test_provider_rejects_non_json_content() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_completion_body('not valid JSON'))

    provider = _build_provider(handler, max_retries=0)

    with pytest.raises(AIProviderError):
        _call(provider)


def test_provider_rejects_schema_invalid_output() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_completion_body('{"wrong": "shape"}'))

    provider = _build_provider(handler, max_retries=0)

    with pytest.raises(AIProviderError):
        _call(provider)


def test_provider_cache_avoids_repeating_an_identical_request() -> None:
    calls = {'count': 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls['count'] += 1
        return httpx.Response(200, json=_completion_body('{"answer": 11}'))

    provider = _build_provider(handler, cache_size=8)

    assert _call(provider) == {'answer': 11}
    assert _call(provider) == {'answer': 11}
    assert calls['count'] == 1


def test_provider_rate_limit_refuses_a_burst() -> None:
    calls = {'count': 0}

    def handler(_request: httpx.Request) -> httpx.Response:
        calls['count'] += 1
        return httpx.Response(200, json=_completion_body('{"answer": 1}'))

    provider = _build_provider(handler, rpm_limit=1, cache_size=0)

    assert _call(provider) == {'answer': 1}
    with pytest.raises(AIProviderError):
        provider.complete_json(
            operation='example',
            payload={'question': 'a different request'},
            response_model=Answer,
        )
    assert calls['count'] == 1


def test_build_provider_from_settings_requires_a_key() -> None:
    without_key = SimpleNamespace(
        ai_api_key=None,
        ai_model='test-model',
        ai_base_url='https://example.test/v1',
        ai_timeout_seconds=5.0,
        ai_max_retries=1,
        ai_rpm_limit=10,
        ai_cache_size=5,
    )
    assert build_provider_from_settings(without_key) is None

    with_key = SimpleNamespace(**{**vars(without_key), 'ai_api_key': 'secret-key'})
    provider = build_provider_from_settings(with_key)
    try:
        assert isinstance(provider, OpenAICompatibleProvider)
        assert provider.model == 'test-model'
    finally:
        provider.close()


def test_gateway_degrades_to_the_local_result_when_the_provider_fails() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(503, json={'error': 'unavailable'})

    provider = _build_provider(handler, max_retries=0)
    gateway = AIGateway(provider=provider, max_attempts=1)

    result = gateway.run_structured(
        operation='example',
        payload={},
        response_model=Answer,
        local=lambda: {'answer': 4},
        fallback=lambda: {'answer': -1},
        prefer_local_on_provider_failure=True,
    )

    assert result.value == Answer(answer=4)
    assert result.metadata.used_fallback is True
    assert result.metadata.error is not None
