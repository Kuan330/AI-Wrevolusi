"""Provider-independent, deterministic matching primitives for AI endpoints.

The matching layer deliberately accepts a provider result as untrusted input.  The
request candidate list is the authority: provider output is normalised and
validated against it before it can become an API response.
"""

from __future__ import annotations

import math
import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from typing import Any, Protocol

from app.schemas.ai_matching import TaskMatchCandidate, TaskMatchResponse


MINIMUM_TASK_MATCH_CONFIDENCE = 0.5
MAXIMUM_CONCEPTS = 50
MAXIMUM_REASON_LENGTH = 2000
MAXIMUM_QUESTION_LENGTH = 1000

# These words carry little task meaning.  The list is intentionally small and
# conservative so that domain-specific words remain available as concepts.
TASK_MATCH_STOP_WORDS = frozenset(
    {
        'a',
        'an',
        'and',
        'are',
        'as',
        'at',
        'be',
        'by',
        'for',
        'from',
        'in',
        'is',
        'it',
        'of',
        'on',
        'or',
        'that',
        'the',
        'this',
        'to',
        'with',
    }
)

_TOKEN_PATTERN = re.compile(r"[^\W_]+", re.UNICODE)
_UNSAFE_CLAIM_PATTERN = re.compile(
    r"\b(?:job\s+loss|lose\s+your\s+job|unemployment|job\s+replacement|"
    r"skill\s+gap|skills\s+gap|you\s+lack\s+skills)\b",
    re.IGNORECASE,
)

SAFE_UNCERTAIN_REASON = 'The match could not be established reliably from the supplied candidates.'
DEFAULT_CLARIFYING_QUESTION = (
    'Which supplied candidate best describes this task, and what are the main steps you perform?'
)
NO_CANDIDATE_REASON = 'No supplied candidate matched the task with at least 0.50 confidence.'
NO_CANDIDATE_QUESTION = (
    'Could you describe the main steps of the task or choose the closest supplied candidate?'
)
@dataclass(frozen=True)
class TaskMatchProviderResult:
    """The narrow result contract expected from any matching provider."""

    candidate_id: str = ''
    confidence: float = 0.0
    matched_concepts: list[str] = field(default_factory=list)
    unmatched_concepts: list[str] = field(default_factory=list)
    reason: str = ''
    clarifying_question: str | None = None


class TaskMatchProvider(Protocol):
    """Synchronous provider interface; network providers can be adapted later."""

    def match_task(
        self,
        occupation_code: str,
        user_task: str,
        candidates: Sequence[TaskMatchCandidate],
    ) -> TaskMatchProviderResult:
        ...


@dataclass(frozen=True)
class RankedTaskCandidate:
    """Deterministic, explainable score for one supplied candidate."""

    candidate: TaskMatchCandidate
    confidence: float
    matched_concepts: list[str]
    unmatched_concepts: list[str]


def normalize_task_text_for_matching(value: str) -> str:
    """Normalise task text for comparison without changing supplied IDs."""

    return ' '.join(_TOKEN_PATTERN.findall(value.casefold()))


def _canonicalise_token(token: str) -> str:
    """Handle a few obvious inflections while avoiding a general language model."""

    if len(token) > 4 and token.endswith('ies'):
        return f'{token[:-3]}y'
    if len(token) > 4 and token.endswith('ses'):
        return token[:-2]
    if len(token) > 3 and token.endswith('s') and not token.endswith('ss'):
        return token[:-1]
    return token


def _concept_tokens(value: str) -> list[tuple[str, str]]:
    """Return display tokens and comparison tokens in input order."""

    concepts: list[tuple[str, str]] = []
    seen: set[str] = set()
    for raw_token in _TOKEN_PATTERN.findall(value.casefold()):
        if raw_token in TASK_MATCH_STOP_WORDS:
            continue
        canonical = _canonicalise_token(raw_token)
        if canonical and canonical not in seen:
            concepts.append((raw_token, canonical))
            seen.add(canonical)
    return concepts


def tokenize_task_text_for_matching(value: str) -> list[str]:
    """Expose the shared comparison tokenisation for other AI endpoints."""

    return [canonical for _, canonical in _concept_tokens(value)]


def _sequence_similarity(first: str, second: str) -> float:
    return SequenceMatcher(
        None,
        normalize_task_text_for_matching(first),
        normalize_task_text_for_matching(second),
    ).ratio()


def _calculate_candidate_confidence(user_task: str, candidate_text: str) -> float:
    normalised_user_task = normalize_task_text_for_matching(user_task)
    normalised_candidate_text = normalize_task_text_for_matching(candidate_text)
    if not normalised_user_task or not normalised_candidate_text:
        return 0.0
    if normalised_user_task == normalised_candidate_text:
        return 1.0

    user_tokens = set(tokenize_task_text_for_matching(user_task))
    candidate_tokens = set(tokenize_task_text_for_matching(candidate_text))
    if not user_tokens or not candidate_tokens:
        return 0.0

    overlap = user_tokens & candidate_tokens
    if not overlap:
        return 0.0

    precision = len(overlap) / len(user_tokens)
    recall = len(overlap) / len(candidate_tokens)
    f1 = (2 * precision * recall / (precision + recall)) if precision + recall else 0.0
    sequence_similarity = _sequence_similarity(user_task, candidate_text)

    # Precision matters slightly more than character similarity: a concise user
    # description can legitimately be a subset of a longer reference task.
    confidence = (0.65 * f1) + (0.20 * precision) + (0.15 * sequence_similarity)
    if len(overlap) == 1 and len(user_tokens) > 2:
        confidence *= 0.65
    return min(1.0, max(0.0, confidence))


def _candidate_field(candidate: TaskMatchCandidate | Mapping[str, Any], field_name: str) -> Any:
    if isinstance(candidate, Mapping):
        return candidate.get(field_name)
    return getattr(candidate, field_name, None)


def _as_candidate(candidate: TaskMatchCandidate | Mapping[str, Any]) -> TaskMatchCandidate:
    if isinstance(candidate, TaskMatchCandidate):
        return candidate
    return TaskMatchCandidate.model_validate(candidate)


def rank_task_candidates(
    user_task: str,
    candidates: Sequence[TaskMatchCandidate | Mapping[str, Any]],
) -> list[RankedTaskCandidate]:
    """Rank only the candidates supplied by the caller, preserving input ties."""

    user_concepts = _concept_tokens(user_task)
    ranked: list[RankedTaskCandidate] = []

    for candidate_input in candidates:
        candidate = _as_candidate(candidate_input)
        candidate_canonical_concepts = set(tokenize_task_text_for_matching(candidate.text))
        matched = [
            display
            for display, canonical in user_concepts
            if canonical in candidate_canonical_concepts
        ]
        unmatched = [
            display
            for display, canonical in user_concepts
            if canonical not in candidate_canonical_concepts
        ]
        # Keep the concept lists stable and bounded for provider/API safety.
        ranked.append(
            RankedTaskCandidate(
                candidate=candidate,
                confidence=_calculate_candidate_confidence(user_task, candidate.text),
                matched_concepts=matched[:MAXIMUM_CONCEPTS],
                unmatched_concepts=unmatched[:MAXIMUM_CONCEPTS],
            )
        )

    # Python's sort is stable, so equal scores retain the caller's candidate order.
    return sorted(ranked, key=lambda item: item.confidence, reverse=True)


def _provider_result_from_any(result: Any) -> TaskMatchProviderResult:
    if isinstance(result, TaskMatchProviderResult):
        return result
    if isinstance(result, TaskMatchResponse):
        return TaskMatchProviderResult(
            candidate_id=result.candidate_id,
            confidence=result.confidence,
            matched_concepts=result.matched_concepts,
            unmatched_concepts=result.unmatched_concepts,
            reason=result.reason,
            clarifying_question=result.clarifying_question,
        )
    if isinstance(result, Mapping):
        return TaskMatchProviderResult(
            candidate_id=result.get('candidate_id', ''),
            confidence=result.get('confidence', 0.0),
            matched_concepts=result.get('matched_concepts', []),
            unmatched_concepts=result.get('unmatched_concepts', []),
            reason=result.get('reason', ''),
            clarifying_question=result.get('clarifying_question'),
        )
    return TaskMatchProviderResult(reason=SAFE_UNCERTAIN_REASON)


def _safe_string(value: Any, *, default: str, limit: int) -> str:
    if not isinstance(value, str):
        return default
    cleaned = value.strip()
    if not cleaned or _UNSAFE_CLAIM_PATTERN.search(cleaned):
        return default
    return cleaned[:limit]


def _safe_concepts(value: Any) -> list[str]:
    if not isinstance(value, (list, tuple, set)):
        return []
    concepts: list[str] = []
    seen: set[str] = set()
    for item in value:
        if not isinstance(item, str):
            continue
        cleaned = item.strip()
        if cleaned and cleaned not in seen and not _UNSAFE_CLAIM_PATTERN.search(cleaned):
            concepts.append(cleaned)
            seen.add(cleaned)
        if len(concepts) >= MAXIMUM_CONCEPTS:
            break
    return concepts


def _safe_confidence(value: Any) -> float:
    try:
        confidence = float(value)
    except (TypeError, ValueError):
        return 0.0
    if not math.isfinite(confidence):
        return 0.0
    return min(1.0, max(0.0, confidence))


def enforce_task_match_contract(
    provider_result: TaskMatchProviderResult | TaskMatchResponse | Mapping[str, Any],
    candidates: Sequence[TaskMatchCandidate | Mapping[str, Any]],
) -> TaskMatchResponse:
    """Apply the candidate allowlist and confidence floor to untrusted output.

    The candidate identifier is compared byte-for-byte with the request value;
    no case-folding, trimming, generated IDs, or fuzzy ID matching is allowed.
    """

    result = _provider_result_from_any(provider_result)
    candidate_ids = {
        candidate_id
        for candidate_id in (_candidate_field(candidate, 'id') for candidate in candidates)
        if isinstance(candidate_id, str)
    }
    candidate_id = result.candidate_id if isinstance(result.candidate_id, str) else ''
    confidence = _safe_confidence(result.confidence)
    matched_concepts = _safe_concepts(result.matched_concepts)
    unmatched_concepts = _safe_concepts(result.unmatched_concepts)
    reason = _safe_string(
        result.reason,
        default=SAFE_UNCERTAIN_REASON,
        limit=MAXIMUM_REASON_LENGTH,
    )
    clarifying_question = result.clarifying_question
    if clarifying_question is not None:
        clarifying_question = _safe_string(
            clarifying_question,
            default=DEFAULT_CLARIFYING_QUESTION,
            limit=MAXIMUM_QUESTION_LENGTH,
        )

    reliable_candidate = (
        candidate_id in candidate_ids
        and bool(candidate_id)
        and confidence >= MINIMUM_TASK_MATCH_CONFIDENCE
    )
    if not reliable_candidate:
        candidate_id = ''
        if not clarifying_question:
            clarifying_question = DEFAULT_CLARIFYING_QUESTION

    return TaskMatchResponse(
        candidate_id=candidate_id,
        confidence=confidence,
        matched_concepts=matched_concepts,
        unmatched_concepts=unmatched_concepts,
        reason=reason,
        clarifying_question=clarifying_question,
    )


class DeterministicTaskMatchProvider:
    """Offline fallback provider used until a reviewed provider is configured."""

    def match_task(
        self,
        occupation_code: str,
        user_task: str,
        candidates: Sequence[TaskMatchCandidate],
    ) -> TaskMatchProviderResult:
        del occupation_code  # Reserved for future occupation-specific providers.
        candidate_list = list(candidates)
        if not candidate_list:
            return TaskMatchProviderResult(
                reason='No candidate tasks were supplied for comparison.',
                unmatched_concepts=tokenize_task_text_for_matching(user_task),
                clarifying_question=NO_CANDIDATE_QUESTION,
            )

        ranked = rank_task_candidates(user_task, candidate_list)
        best = ranked[0]
        if best.confidence < MINIMUM_TASK_MATCH_CONFIDENCE:
            return TaskMatchProviderResult(
                candidate_id='',
                confidence=best.confidence,
                matched_concepts=best.matched_concepts,
                unmatched_concepts=best.unmatched_concepts,
                reason=NO_CANDIDATE_REASON,
                clarifying_question=NO_CANDIDATE_QUESTION,
            )

        return TaskMatchProviderResult(
            candidate_id=best.candidate.id,
            confidence=best.confidence,
            matched_concepts=best.matched_concepts,
            unmatched_concepts=best.unmatched_concepts,
            reason='The selected candidate shares the strongest task concepts with the user description.',
        )


# A stable singleton keeps the default provider stateless and makes dependency
# overrides straightforward in tests and in future deployments.
def default_task_match_provider() -> DeterministicTaskMatchProvider:
    return _DEFAULT_TASK_MATCH_PROVIDER


_DEFAULT_TASK_MATCH_PROVIDER = DeterministicTaskMatchProvider()


__all__ = [
    'DEFAULT_CLARIFYING_QUESTION',
    'DeterministicTaskMatchProvider',
    'MINIMUM_TASK_MATCH_CONFIDENCE',
    'RankedTaskCandidate',
    'TaskMatchProvider',
    'TaskMatchProviderResult',
    'default_task_match_provider',
    'enforce_task_match_contract',
    'normalize_task_text_for_matching',
    'rank_task_candidates',
    'tokenize_task_text_for_matching',
]
