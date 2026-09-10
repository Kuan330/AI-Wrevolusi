"""Unit tests for the Responses-API wire and keyless mode of the provider.

Like ``test_ai_provider.py`` these never touch the network: ``httpx.MockTransport``
simulates the relay and retry sleeps are injected no-op functions, so everything
here is deterministic and fast.
"""

from __future__ import annotations

import json
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


def _responses_body(text: str) -> dict:
    return {
        'object': 'response',
        'status': 'completed',
        'output': [
            {'type': 'reasoning', 'encrypted_content': 'opaque'},
            {'type': 'message', 'content': [{'type': 'output_text', 'text': text}]},
        ],
    }


def _build_keyless_provider(handler, **overrides) -> OpenAICompatibleProvider:
    client = httpx.Client(transport=httpx.MockTransport(handler))
    kwargs = {
        'api_key': '',
        'model': 'muse-spark-1.3-contributor-free',
        'base_url': 'https://relay.test/zen/v1',
        'api_mode': 'responses',
        'keyless': True,
        'extra_headers': {'x-opencode-session': 'test-scope'},
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


def test_responses_mode_targets_the_responses_endpoint_and_parses_the_message() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured['url'] = str(request.url)
        captured['authorization'] = request.headers.get('authorization')
        captured['session'] = request.headers.get('x-opencode-session')
        captured['body'] = json.loads(request.content)
        return httpx.Response(200, json=_responses_body('{"answer": 7}'))

    provider = _build_keyless_provider(handler)

    assert _call(provider) == {'answer': 7}
    assert captured['url'].endswith('/responses')
    assert captured['authorization'] == ''
    assert captured['session'] == 'test-scope'
    assert 'messages' not in captured['body']
    assert captured['body']['instructions']
    assert isinstance(captured['body']['input'], str)
    assert captured['body']['stream'] is False


def test_responses_mode_strips_markdown_code_fences() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_responses_body('```json\n{"answer": 5}\n```'))

    provider = _build_keyless_provider(handler)

    assert _call(provider) == {'answer': 5}


def test_responses_mode_rejects_payloads_without_an_output_message() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={'object': 'response', 'output': [{'type': 'reasoning'}]},
        )

    provider = _build_keyless_provider(handler, max_retries=0)

    with pytest.raises(AIProviderError):
        _call(provider)


def test_keyless_provider_sends_an_explicit_empty_authorization() -> None:
    captured: dict = {}

    def handler(request: httpx.Request) -> httpx.Response:
        captured['authorization'] = request.headers.get('authorization')
        return httpx.Response(200, json=_responses_body('{"answer": 1}'))

    provider = _build_keyless_provider(handler, extra_headers=None)

    assert _call(provider) == {'answer': 1}
    assert captured['authorization'] == ''


def test_chat_mode_still_requires_a_key() -> None:
    with pytest.raises(ValueError):
        OpenAICompatibleProvider(api_key='', model='test-model')


def test_unknown_api_mode_falls_back_to_chat_completions() -> None:
    provider = OpenAICompatibleProvider(
        api_key='test-key',
        model='test-model',
        api_mode='not-a-mode',
    )
    try:
        assert provider.api_mode == 'chat_completions'
    finally:
        provider.close()


def test_build_provider_from_settings_allows_a_keyless_responses_relay() -> None:
    base = dict(
        ai_api_key=None,
        ai_model='muse-spark-1.3-contributor-free',
        ai_base_url='https://relay.test/zen/v1',
        ai_api_mode='responses',
        ai_keyless=True,
        ai_extra_headers='{"x-opencode-session": "scope", "Authorization": ""}',
        ai_timeout_seconds=5.0,
        ai_max_retries=1,
        ai_rpm_limit=10,
        ai_cache_size=5,
    )
    provider = build_provider_from_settings(SimpleNamespace(**base, ai_fallback_enabled=False))
    try:
        assert isinstance(provider, OpenAICompatibleProvider)
        assert provider.api_mode == 'responses'
        assert provider.model == 'muse-spark-1.3-contributor-free'
    finally:
        provider.close()

    # With the fallback enabled the keyless relay becomes the chain's primary.
    provider = build_provider_from_settings(SimpleNamespace(**base, ai_fallback_enabled=True))
    try:
        assert isinstance(provider, FallbackProvider)
        assert isinstance(provider.primary, OpenAICompatibleProvider)
        assert provider.primary.api_mode == 'responses'
    finally:
        provider.close()
