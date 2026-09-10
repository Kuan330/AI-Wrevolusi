from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from collections import OrderedDict, deque
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Generic, Protocol, TypeVar

import httpx
from pydantic import BaseModel, ValidationError


ModelT = TypeVar('ModelT', bound=BaseModel)

_LOGGER = logging.getLogger('app.services.ai_gateway')


class AIGatewayProvider(Protocol):
    """Minimal synchronous seam for a future structured-output provider."""

    name: str

    def complete_json(self, **kwargs: Any) -> Any:
        """Return a JSON object or string without owning transport credentials."""
        ...


@dataclass(frozen=True)
class GatewayMetadata:
    provider: str
    used_fallback: bool
    cached: bool
    attempts: int
    elapsed_ms: int
    error: str | None = None


@dataclass(frozen=True)
class GatewayResult(Generic[ModelT]):
    value: ModelT
    metadata: GatewayMetadata


class AIGateway:
    """Validate provider JSON and contain failures behind safe local logic.

    The gateway is credential-free by default. A provider can be injected later;
    every provider response is parsed and validated before it reaches a route.
    """

    def __init__(
        self,
        provider: AIGatewayProvider | None = None,
        *,
        max_attempts: int = 1,
        cache: dict[str, Any] | None = None,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        if max_attempts < 1:
            raise ValueError('max_attempts must be at least 1')
        self.provider = provider
        self.max_attempts = max_attempts
        self.cache = cache if cache is not None else {}
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def run_structured(
        self,
        *,
        operation: str,
        payload: Any,
        response_model: type[ModelT],
        local: Callable[[], Any],
        fallback: Callable[[], Any],
        cache_key: str | None = None,
        prefer_local_on_provider_failure: bool = False,
    ) -> GatewayResult[ModelT]:
        started = self._clock()
        key = cache_key or self._cache_key(operation, payload)
        if key in self.cache:
            cached = self._validate(self.cache[key], response_model)
            if cached is not None:
                return GatewayResult(cached, self._metadata(started, cached=True, attempts=0))
            self.cache.pop(key, None)

        if self.provider is not None:
            last_error: str | None = None
            for attempt in range(1, self.max_attempts + 1):
                try:
                    value = self._validate(
                        self.provider.complete_json(
                            operation=operation,
                            payload=payload,
                            response_model=response_model,
                        ),
                        response_model,
                    )
                    if value is None:
                        raise ValueError('provider returned invalid structured JSON')
                    self.cache[key] = value.model_dump(mode='json')
                    return GatewayResult(value, self._metadata(started, attempts=attempt))
                except Exception as exc:
                    last_error = type(exc).__name__

            if prefer_local_on_provider_failure:
                value = self._safe_call(local, response_model)
                if value is not None:
                    return GatewayResult(
                        value,
                        self._metadata(
                            started,
                            used_fallback=True,
                            attempts=self.max_attempts,
                            error=last_error,
                        ),
                    )
            return self._validated_fallback(
                response_model,
                fallback,
                started,
                attempts=self.max_attempts,
                error=last_error,
            )

        value = self._safe_call(local, response_model)
        if value is not None:
            return GatewayResult(value, self._metadata(started, attempts=1))
        return self._validated_fallback(
            response_model,
            fallback,
            started,
            attempts=1,
            error='LocalValidationError',
        )

    def run_candidate_constrained(
        self,
        *,
        operation: str,
        payload: Any,
        response_model: type[ModelT],
        candidates: Any,
        candidate_key: str,
        local: Callable[[], Any],
        fallback: Callable[[], Any],
        cache_key: str | None = None,
        prefer_local_on_provider_failure: bool = False,
        post_validate: Callable[[ModelT], ModelT] | None = None,
    ) -> GatewayResult[ModelT]:
        """Validate output, remove unknown IDs, then apply a final validator."""

        result = self.run_structured(
            operation=operation,
            payload=payload,
            response_model=response_model,
            local=local,
            fallback=fallback,
            cache_key=cache_key,
            prefer_local_on_provider_failure=prefer_local_on_provider_failure,
        )
        constrained = self._constrain_result(
            result.value,
            response_model=response_model,
            candidates=candidates,
            candidate_key=candidate_key,
        )
        if post_validate is not None:
            constrained = post_validate(constrained)
        return GatewayResult(constrained, result.metadata)

    @staticmethod
    def _constrain_result(
        value: ModelT,
        *,
        response_model: type[ModelT],
        candidates: Any,
        candidate_key: str,
    ) -> ModelT:
        allowed: dict[Any, Any] = {}
        for candidate in candidates or []:
            key = candidate.get(candidate_key) if isinstance(candidate, dict) else getattr(candidate, candidate_key, None)
            if key is not None:
                allowed[key] = candidate

        data = value.model_dump(mode='python')
        if 'candidate_id' in data:
            if data.get('candidate_id') not in allowed:
                data['candidate_id'] = ''
            if not data.get('candidate_id') and not data.get('clarifying_question'):
                data['clarifying_question'] = (
                    'Which supplied candidate best describes this task, and what are the main steps you perform?'
                )
            return response_model.model_validate(data)

        if 'skills' in data:
            data['skills'] = [item for item in data['skills'] if item.get('wef_skill_id') in allowed]
            return response_model.model_validate(data)

        if 'candidates' in data:
            retained: list[dict[str, Any]] = []
            for item in data['candidates']:
                key = item.get('occupation_code')
                source = allowed.get(key)
                if source is None:
                    continue
                source_data = source if isinstance(source, dict) else source.model_dump(mode='python')
                item['occupation_code'] = key
                item['title'] = source_data.get('title', item.get('title', ''))
                retained.append(item)
            data['candidates'] = retained
            if not retained and data.get('status') == 'suggestions':
                data['status'] = 'clarifying'
                if not data.get('clarifying_questions'):
                    data['clarifying_questions'] = [
                        'Please provide more detail so the supplied occupations can be compared.'
                    ]
            return response_model.model_validate(data)

        return value

    @staticmethod
    def _safe_call(callback: Callable[[], Any], response_model: type[ModelT]) -> ModelT | None:
        try:
            return AIGateway._validate(callback(), response_model)
        except Exception:
            return None

    @staticmethod
    def validate(value: Any, response_model: type[ModelT]) -> ModelT | None:
        """Validate a provider/local value against a public response model."""
        return AIGateway._validate(value, response_model)

    @staticmethod
    def _validate(value: Any, response_model: type[ModelT]) -> ModelT | None:
        if isinstance(value, response_model):
            return value
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (TypeError, ValueError, json.JSONDecodeError):
                return None
        try:
            return response_model.model_validate(value)
        except (TypeError, ValueError, ValidationError):
            return None

    def _validated_fallback(
        self,
        response_model: type[ModelT],
        fallback: Callable[[], Any],
        started: datetime,
        *,
        attempts: int,
        error: str | None,
    ) -> GatewayResult[ModelT]:
        value = self._safe_call(fallback, response_model)
        if value is None:
            raise ValueError('gateway fallback does not satisfy response schema')
        return GatewayResult(
            value,
            self._metadata(started, used_fallback=True, attempts=attempts, error=error),
        )

    def _metadata(
        self,
        started: datetime,
        *,
        cached: bool = False,
        used_fallback: bool = False,
        attempts: int,
        error: str | None = None,
    ) -> GatewayMetadata:
        elapsed = max(0, int((self._clock() - started).total_seconds() * 1000))
        return GatewayMetadata(
            provider=getattr(self.provider, 'name', None) or 'local',
            used_fallback=used_fallback,
            cached=cached,
            attempts=attempts,
            elapsed_ms=elapsed,
            error=error,
        )

    @staticmethod
    def _cache_key(operation: str, payload: Any) -> str:
        try:
            encoded = json.dumps(payload, sort_keys=True, default=str, separators=(',', ':'))
        except (TypeError, ValueError):
            encoded = repr(payload)
        return f'{operation}:{encoded}'


class AIProviderError(RuntimeError):
    """Raised when the configured HTTP provider cannot return usable JSON."""


# Transient upstream failures worth one more attempt: throttling, timeouts
# surfaced as status codes, and 5xx responses.
_RETRYABLE_PROVIDER_STATUS_CODES = frozenset({408, 409, 425, 429, 500, 502, 503, 504})

_SYSTEM_PROMPT_TEMPLATE = (
    'You are a candidate-constrained matching assistant inside a career analysis tool. '
    'Follow these rules exactly:\n'
    '1. Return one JSON object and nothing else. No markdown, no prose outside the JSON.\n'
    '2. Only use identifiers that appear in the supplied candidates. Never invent, edit, '
    'translate, or guess identifiers, scores, source links, or definitions.\n'
    '3. Never predict job loss, replacement timelines, unemployment, or personal skill gaps.\n'
    '4. If no supplied candidate is a reliable fit, return an empty selection and a '
    'clarifying question instead of forcing a match.\n'
    'The JSON object must validate against this JSON Schema:\n{schema}'
)


# Provider wire protocols. ``chat_completions`` is the OpenAI default wire;
# ``responses`` targets the OpenAI Responses API, which some relays (for
# example OpenCode Zen) exclusively serve certain models on.
_CHAT_COMPLETIONS_MODE = 'chat_completions'
_RESPONSES_MODE = 'responses'
_SUPPORTED_API_MODES = frozenset({_CHAT_COMPLETIONS_MODE, _RESPONSES_MODE})


def _normalize_extra_headers(raw: Any) -> dict[str, str]:
    """Parse the optional ``AI_EXTRA_HEADERS`` JSON object leniently.

    Invalid input is logged and ignored so a typo in ``.env`` can never stop
    the provider from starting.
    """
    if isinstance(raw, dict):
        candidates: Any = raw
    elif isinstance(raw, str) and raw.strip():
        try:
            candidates = json.loads(raw)
        except ValueError:
            _LOGGER.warning('AI_EXTRA_HEADERS was not valid JSON and was ignored')
            return {}
    else:
        return {}
    if not isinstance(candidates, dict):
        _LOGGER.warning('AI_EXTRA_HEADERS must be a JSON object and was ignored')
        return {}
    cleaned: dict[str, str] = {}
    for name, value in candidates.items():
        if isinstance(name, str) and name.strip() and isinstance(value, str):
            cleaned[name.strip()] = value
        else:
            _LOGGER.warning('AI_EXTRA_HEADERS entry %r was ignored (non-string)', name)
    return cleaned


def _load_message_json(text: str) -> Any:
    """Parse a model answer, tolerating markdown code fences around the JSON."""
    stripped = text.strip()
    if stripped.startswith('```'):
        stripped = stripped[3:]
        first_newline = stripped.find('\n')
        if first_newline != -1:
            stripped = stripped[first_newline + 1:]
        stripped = stripped.rstrip()
        if stripped.endswith('```'):
            stripped = stripped[:-3]
        stripped = stripped.strip()
    try:
        return json.loads(stripped)
    except ValueError as error:
        raise AIProviderError('provider message content was not valid JSON') from error


class _BoundedLruCache:
    """Small thread-safe LRU cache for raw provider responses."""

    def __init__(self, max_size: int) -> None:
        self._max_size = max_size
        self._entries: OrderedDict[str, Any] = OrderedDict()
        self._lock = threading.Lock()

    def get(self, key: str) -> Any | None:
        if self._max_size <= 0:
            return None
        with self._lock:
            if key not in self._entries:
                return None
            value = self._entries.pop(key)
            self._entries[key] = value
            return value

    def put(self, key: str, value: Any) -> None:
        if self._max_size <= 0:
            return
        with self._lock:
            self._entries.pop(key, None)
            self._entries[key] = value
            while len(self._entries) > self._max_size:
                self._entries.popitem(last=False)


class OpenAICompatibleProvider:
    """Structured-JSON adapter for OpenAI-compatible model APIs.

    Two wire protocols are supported: ``chat_completions`` (the OpenAI
    default) and ``responses`` (the OpenAI Responses API, which relays may
    require for certain models).  The adapter can also run keyless for
    anonymous relays: ``keyless=True`` relaxes the credential requirement and
    an explicit empty ``Authorization`` header goes out instead of a bearer.

    The adapter is deliberately thin: it retries transient failures with
    exponential backoff, caches raw responses, applies a local requests-per-
    minute guard, and only returns content that already satisfies the target
    response model.  Every breach raises :class:`AIProviderError`; the caller
    (:class:`AIGateway`) decides how to degrade, and the gateway's candidate
    constraint layer remains the only component allowed to shape what an
    endpoint returns.
    """

    name = 'openai-compatible'

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        base_url: str = 'https://api.openai.com/v1',
        api_mode: str = _CHAT_COMPLETIONS_MODE,
        keyless: bool = False,
        extra_headers: dict[str, str] | None = None,
        timeout_s: float = 20.0,
        max_retries: int = 2,
        backoff_base_s: float = 0.5,
        rpm_limit: int = 60,
        cache_size: int = 128,
        max_tokens: int | None = None,
        client: httpx.Client | None = None,
        sleep: Callable[[float], None] = time.sleep,
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        cleaned_key = (api_key or '').strip()
        if not cleaned_key and not keyless:
            raise ValueError('api_key must contain non-whitespace characters')
        if not (model or '').strip():
            raise ValueError('model must contain non-whitespace characters')
        if max_retries < 0:
            raise ValueError('max_retries must not be negative')
        if rpm_limit < 1:
            raise ValueError('rpm_limit must be at least 1')

        mode = str(api_mode or _CHAT_COMPLETIONS_MODE).strip().lower()
        if mode not in _SUPPORTED_API_MODES:
            _LOGGER.warning(
                'Unknown ai_api_mode %r; falling back to %s',
                api_mode,
                _CHAT_COMPLETIONS_MODE,
            )
            mode = _CHAT_COMPLETIONS_MODE

        self.model = model.strip()
        self.api_mode = mode
        path = '/chat/completions' if mode == _CHAT_COMPLETIONS_MODE else '/responses'
        self._endpoint = f"{base_url.rstrip('/')}{path}"
        headers = {'Content-Type': 'application/json'}
        if extra_headers:
            headers.update(extra_headers)
        if cleaned_key:
            headers['Authorization'] = f'Bearer {cleaned_key}'
        elif 'Authorization' not in headers:
            # Keyless relays expect an explicit empty bearer instead of no header.
            headers['Authorization'] = ''
        self._headers = headers
        self.max_retries = int(max_retries)
        self._backoff_base_s = max(0.0, float(backoff_base_s))
        self._rpm_limit = int(rpm_limit)
        self._max_tokens = max_tokens
        self._client = client or httpx.Client(timeout=httpx.Timeout(float(timeout_s)))
        self._owns_client = client is None
        self._sleep = sleep
        self._clock = clock
        self._cache = _BoundedLruCache(max(0, int(cache_size)))
        self._request_times: deque[float] = deque()
        self._lock = threading.Lock()

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def complete_json(
        self,
        *,
        operation: str,
        payload: Any,
        response_model: type[ModelT],
    ) -> Any:
        """Return parsed JSON that satisfies ``response_model`` or raise."""
        cache_key = self._cache_key(operation, payload)
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        body = self._build_request_body(operation, payload, response_model)
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            if attempt > 0:
                self._sleep(self._backoff_base_s * (2 ** (attempt - 1)))
            try:
                self._consume_rate_limit_slot()
                response = self._client.post(
                    self._endpoint,
                    headers=self._headers,
                    json=body,
                )
            except httpx.HTTPError as error:  # timeouts and transport failures
                last_error = error
                _LOGGER.warning(
                    'AI provider attempt %s/%s failed: %s',
                    attempt + 1,
                    self.max_retries + 1,
                    type(error).__name__,
                )
                continue

            if response.status_code in _RETRYABLE_PROVIDER_STATUS_CODES:
                last_error = AIProviderError(
                    f'provider returned retryable status {response.status_code}'
                )
                _LOGGER.warning(
                    'AI provider attempt %s/%s failed with status %s',
                    attempt + 1,
                    self.max_retries + 1,
                    response.status_code,
                )
                continue
            if response.status_code >= 400:
                raise AIProviderError(
                    f'provider rejected the request with status {response.status_code}'
                )

            try:
                parsed = self._parse_payload(response)
            except AIProviderError as error:
                last_error = error
                _LOGGER.warning(
                    'AI provider attempt %s/%s returned unusable content: %s',
                    attempt + 1,
                    self.max_retries + 1,
                    error,
                )
                continue
            if AIGateway.validate(parsed, response_model) is None:
                last_error = AIProviderError(
                    'provider output did not satisfy the response schema'
                )
                _LOGGER.warning(
                    'AI provider attempt %s/%s returned schema-invalid output',
                    attempt + 1,
                    self.max_retries + 1,
                )
                continue

            self._cache.put(cache_key, parsed)
            return parsed

        raise AIProviderError(
            f'provider request failed after {self.max_retries + 1} attempt(s): {last_error}'
        )

    def _build_request_body(
        self,
        operation: str,
        payload: Any,
        response_model: type[ModelT],
    ) -> dict[str, Any]:
        try:
            schema = response_model.model_json_schema()
        except Exception:  # noqa: BLE001 - the schema is prompt guidance only
            schema = {}
        system_prompt = _SYSTEM_PROMPT_TEMPLATE.format(
            schema=json.dumps(schema, sort_keys=True, default=str),
        )
        request_payload = json.dumps(
            {'operation': operation, 'request': payload},
            sort_keys=True,
            default=str,
        )
        if self.api_mode == _RESPONSES_MODE:
            # The Responses API carries the system prompt via ``instructions``
            # and the task payload as one input string; the temperature stays
            # at the model default because reasoning models may reject 0.
            body: dict[str, Any] = {
                'model': self.model,
                'instructions': system_prompt,
                'input': request_payload,
                'stream': False,
            }
            if self._max_tokens is not None:
                body['max_output_tokens'] = self._max_tokens
            return body
        body: dict[str, Any] = {
            'model': self.model,
            'messages': [
                {'role': 'system', 'content': system_prompt},
                {'role': 'user', 'content': request_payload},
            ],
            'response_format': {'type': 'json_object'},
            'temperature': 0,
        }
        if self._max_tokens is not None:
            body['max_tokens'] = self._max_tokens
        return body

    def _parse_payload(self, response: httpx.Response) -> Any:
        """Parse provider content with the wire format of the active mode."""
        if self.api_mode == _RESPONSES_MODE:
            return self._parse_responses_payload(response)
        return self._parse_completion_payload(response)

    @staticmethod
    def _parse_completion_payload(response: httpx.Response) -> Any:
        try:
            data = response.json()
            content = data['choices'][0]['message']['content']
        except (ValueError, KeyError, IndexError, TypeError) as error:
            raise AIProviderError(
                'provider response did not include a chat completion message'
            ) from error

        if isinstance(content, str):
            return _load_message_json(content)
        if isinstance(content, (dict, list)):
            return content
        raise AIProviderError('provider message content had an unsupported type')

    @staticmethod
    def _parse_responses_payload(response: httpx.Response) -> Any:
        """Extract the JSON answer from an OpenAI Responses API payload."""
        try:
            data = response.json()
        except ValueError as error:
            raise AIProviderError(
                'provider response did not include an output message'
            ) from error
        if not isinstance(data, dict):
            raise AIProviderError('provider response did not include an output message')

        text: str | None = None
        output = data.get('output')
        if isinstance(output, list):
            for item in output:
                if not isinstance(item, dict) or item.get('type') != 'message':
                    continue
                for part in item.get('content') or []:
                    if (
                        isinstance(part, dict)
                        and part.get('type') in {'output_text', 'text'}
                        and isinstance(part.get('text'), str)
                    ):
                        text = part['text']
                        break
                if text is not None:
                    break
        if text is None and isinstance(data.get('output_text'), str):
            text = data['output_text']
        if text is None:
            raise AIProviderError('provider response did not include an output message')
        return _load_message_json(text)

    def _consume_rate_limit_slot(self) -> None:
        """Refuse to send when the local per-minute budget is exhausted.

        The guard fails fast instead of sleeping: a burst request degrades to
        the deterministic path rather than blocking an API worker thread.
        """
        now = self._clock()
        with self._lock:
            while self._request_times and now - self._request_times[0] >= 60.0:
                self._request_times.popleft()
            if len(self._request_times) >= self._rpm_limit:
                raise AIProviderError('local rate limit reached; request was not sent')
            self._request_times.append(now)

    def _cache_key(self, operation: str, payload: Any) -> str:
        try:
            encoded = json.dumps(
                {'model': self.model, 'operation': operation, 'payload': payload},
                sort_keys=True,
                default=str,
                separators=(',', ':'),
            )
        except (TypeError, ValueError):
            encoded = f'{self.model}:{operation}:{payload!r}'
        return hashlib.sha256(encoded.encode('utf-8')).hexdigest()


def build_provider_from_settings(settings_obj: Any | None = None) -> OpenAICompatibleProvider | None:
    """Build the optional provider from settings; return None without a key.

    ``AI_KEYLESS=true`` builds the provider without any credential for
    anonymous relays; otherwise a non-empty ``AI_API_KEY`` is required.
    """
    if settings_obj is None:
        from app.core.config import get_settings

        settings_obj = get_settings()

    api_key = getattr(settings_obj, 'ai_api_key', None)
    keyless = bool(getattr(settings_obj, 'ai_keyless', False))
    if (not api_key or not str(api_key).strip()) and not keyless:
        _LOGGER.warning(
            'AI provider is not configured (AI_API_KEY is empty); '
            'AI endpoints run on deterministic logic only.'
        )
        return None

    return OpenAICompatibleProvider(
        api_key=str(api_key or ''),
        model=str(getattr(settings_obj, 'ai_model', 'gpt-4o-mini')),
        base_url=str(getattr(settings_obj, 'ai_base_url', 'https://api.openai.com/v1')),
        api_mode=str(getattr(settings_obj, 'ai_api_mode', _CHAT_COMPLETIONS_MODE)),
        keyless=keyless,
        extra_headers=_normalize_extra_headers(getattr(settings_obj, 'ai_extra_headers', '')),
        timeout_s=float(getattr(settings_obj, 'ai_timeout_seconds', 20.0)),
        max_retries=int(getattr(settings_obj, 'ai_max_retries', 2)),
        rpm_limit=int(getattr(settings_obj, 'ai_rpm_limit', 60)),
        cache_size=int(getattr(settings_obj, 'ai_cache_size', 128)),
    )


_default_gateway: AIGateway | None = None


def default_ai_gateway() -> AIGateway:
    """Return the process-local gateway, configured from the environment.

    Without an ``AI_API_KEY`` this stays credential-free and every endpoint
    keeps its deterministic behaviour.
    """
    global _default_gateway
    if _default_gateway is None:
        _default_gateway = AIGateway(
            provider=build_provider_from_settings(),
            max_attempts=1,
        )
    return _default_gateway


def reset_default_ai_gateway() -> None:
    """Rebuild the process-local gateway on next use (tests and hot reloads)."""
    global _default_gateway
    _default_gateway = None


__all__ = [
    'AIProviderError',
    'AIGateway',
    'AIGatewayProvider',
    'GatewayMetadata',
    'GatewayResult',
    'OpenAICompatibleProvider',
    'build_provider_from_settings',
    'default_ai_gateway',
    'reset_default_ai_gateway',
]
