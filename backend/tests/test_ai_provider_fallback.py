"""Fallback-chain tests: the keyed primary first, the OpenCode relay as safety net.

Like the other provider tests these are fully offline: ``httpx.MockTransport``
simulates both providers and retry sleeps are no-ops.
"""

from __future__ import annotations

from types import SimpleNamespace

import httpx
import pytest
from pydantic import BaseModel

from app.services.ai_gateway import (
    AIProviderError,
    FallbackProvider,
    OpenAICompatibleProvider,
    build_provider_from_settings,
)


class Answer(BaseModel):
    answer: int


def _completion(content: str) -> dict:
    return {'choices': [{'message': {'content': content}}]}


def _provider(handler, *, api_key: str = 'test-key', keyless: bool = False, **overrides):
    client = httpx.Client(transport=httpx.MockTransport(handler))
    kwargs = {
        'api_key': api_key,
        'model': 'test-model',
        'keyless': keyless,
        'client': client,
        'sleep': lambda _seconds: None,
        'backoff_base_s': 0.0,
        'max_retries': 0,
    }
    kwargs.update(overrides)
    return OpenAICompatibleProvider(**kwargs)


def _call(provider):
    return provider.complete_json(
        operation='example',
        payload={'question': 'six plus one'},
        response_model=Answer,
    )


def test_primary_success_never_touches_the_fallback() -> None:
    calls = {'fallback': 0}

    primary = _provider(lambda _request: httpx.Response(200, json=_completion('{"answer": 7}')))

    def fallback_handler(_request):
        calls['fallback'] += 1
        return httpx.Response(200, json=_completion('{"answer": 1}'))

    fallback = _provider(fallback_handler, api_key='', keyless=True)
    chain = FallbackProvider(primary=primary, fallback=fallback)

    assert _call(chain) == {'answer': 7}
    assert calls['fallback'] == 0


def test_failed_primary_falls_back_for_that_call() -> None:
    primary = _provider(lambda _request: httpx.Response(500, json={'error': 'boom'}))
    fallback = _provider(
        lambda _request: httpx.Response(200, json=_completion('{"answer": 4}')),
        api_key='',
        keyless=True,
    )
    chain = FallbackProvider(primary=primary, fallback=fallback)

    assert _call(chain) == {'answer': 4}


def test_auth_failure_disables_the_primary_for_the_rest_of_the_process() -> None:
    counts = {'primary': 0}

    def primary_handler(_request):
        counts['primary'] += 1
        return httpx.Response(401, json={'error': 'bad key'})

    primary = _provider(primary_handler)
    fallback = _provider(
        lambda _request: httpx.Response(200, json=_completion('{"answer": 4}')),
        api_key='',
        keyless=True,
    )
    chain = FallbackProvider(primary=primary, fallback=fallback)

    assert _call(chain) == {'answer': 4}
    assert _call(chain) == {'answer': 4}
    assert counts['primary'] == 1  # the dead credential is skipped on later calls


def test_both_failing_raises_so_the_gateway_can_degrade() -> None:
    primary = _provider(lambda _request: httpx.Response(500, json={'error': 'boom'}))
    fallback = _provider(
        lambda _request: httpx.Response(503, json={'error': 'down'}),
        api_key='',
        keyless=True,
    )
    chain = FallbackProvider(primary=primary, fallback=fallback)

    with pytest.raises(AIProviderError):
        _call(chain)


def test_missing_key_builds_the_opencode_fallback_alone() -> None:
    settings = SimpleNamespace(
        ai_api_key=None,
        ai_model='unused',
        ai_base_url='https://unused.test/v1',
        ai_timeout_seconds=5.0,
        ai_max_retries=1,
        ai_rpm_limit=10,
        ai_cache_size=5,
        ai_fallback_enabled=True,
    )
    provider = build_provider_from_settings(settings)
    try:
        assert isinstance(provider, OpenAICompatibleProvider)
        assert provider.model == 'muse-spark-1.3-contributor-free'
        assert provider.base_url == 'https://opencode.ai/zen/v1'
    finally:
        provider.close()


def test_configured_key_becomes_the_primary_of_the_chain() -> None:
    settings = SimpleNamespace(
        ai_api_key='secret-key',
        ai_model='fallback-primary-model',
        ai_base_url='https://provider.test/v1',
        ai_timeout_seconds=5.0,
        ai_max_retries=1,
        ai_rpm_limit=10,
        ai_cache_size=5,
        ai_fallback_enabled=True,
    )
    provider = build_provider_from_settings(settings)
    try:
        assert isinstance(provider, FallbackProvider)
        assert isinstance(provider.primary, OpenAICompatibleProvider)
        assert provider.primary.model == 'fallback-primary-model'
        assert getattr(provider.fallback, 'model', None) == 'muse-spark-1.3-contributor-free'
    finally:
        provider.close()
