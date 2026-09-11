"""Optional LLM task-match judge built on the shared AI gateway.

The judge adds a confirmation layer on top of the deterministic task matching
used by the exposure assessment.  It can only choose from caller-supplied
candidates, every failure (no provider, timeout, malformed output, unknown
identifier) returns ``None``, and the deterministic result is always kept as
the fallback so an API request can never be blocked by this layer.
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Protocol

from app.schemas.ai_matching import TaskMatchCandidate, TaskMatchResponse
from app.services.ai_gateway import AIGateway
from app.services.ai_matching import (
    TaskMatchProviderResult,
    enforce_task_match_contract,
)


class TaskMatchJudge(Protocol):
    """Narrow judging interface used by the exposure assessment."""

    @property
    def available(self) -> bool:
        ...

    def match_task(
        self,
        occupation_code: str,
        user_task: str,
        candidates: Sequence[TaskMatchCandidate],
    ) -> TaskMatchProviderResult | None:
        ...


class LLMTaskMatchJudge:
    """Gateway-backed judge that never raises and never invents identifiers."""

    def __init__(self, gateway: AIGateway) -> None:
        self._gateway = gateway

    @property
    def available(self) -> bool:
        return getattr(self._gateway, 'provider', None) is not None

    def match_task(
        self,
        occupation_code: str,
        user_task: str,
        candidates: Sequence[TaskMatchCandidate],
    ) -> TaskMatchProviderResult | None:
        provider = getattr(self._gateway, 'provider', None)
        if provider is None:
            return None

        payload = {
            'occupation_code': occupation_code,
            'user_task': user_task,
            'candidates': [
                {'id': candidate.id, 'text': candidate.text}
                for candidate in candidates
            ],
        }
        try:
            raw_result = provider.complete_json(
                operation='task-match',
                payload=payload,
                response_model=TaskMatchResponse,
            )
        except Exception:  # noqa: BLE001 - the optional layer must never break a request
            return None

        validated = AIGateway.validate(raw_result, TaskMatchResponse)
        if validated is None:
            return None
        constrained = enforce_task_match_contract(validated, candidates)
        if not constrained.candidate_id:
            return None

        return TaskMatchProviderResult(
            candidate_id=constrained.candidate_id,
            confidence=constrained.confidence,
            matched_concepts=constrained.matched_concepts,
            unmatched_concepts=constrained.unmatched_concepts,
            reason=constrained.reason,
            clarifying_question=constrained.clarifying_question,
        )


__all__ = [
    'LLMTaskMatchJudge',
    'TaskMatchJudge',
]
