from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, Generic, Protocol, TypeVar

from pydantic import BaseModel, ValidationError


ModelT = TypeVar('ModelT', bound=BaseModel)


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


_default_gateway = AIGateway()


def default_ai_gateway() -> AIGateway:
    """Return the process-local credential-free gateway."""
    return _default_gateway


__all__ = [
    'AIGateway',
    'AIGatewayProvider',
    'GatewayMetadata',
    'GatewayResult',
    'default_ai_gateway',
]
