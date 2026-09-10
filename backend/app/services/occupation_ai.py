"""Offline, candidate-safe occupation retrieval and recommendation logic.

The service deliberately does not query a database or call a network model.  The
caller supplies the only occupations that may appear in the result, and all
explanations are derived from those supplied values and the request text.
"""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable
from typing import Any

from app.schemas.occupation_ai import (
    OccupationRecommendationCandidate,
    OccupationRecommendationsRequest,
    OccupationResultItem,
    OccupationSuggestionCandidate,
    OccupationSuggestionsRequest,
    OccupationSuggestionsResponse,
    OccupationRecommendationsResponse,
)

MAX_RESULTS = 5
SUGGESTION_CONFIDENCE_FLOOR = 0.30
RECOMMENDATION_CONFIDENCE_FLOOR = 0.28

_TOKEN_RE = re.compile(r"[\w]+", re.UNICODE)
_STOP_WORDS = {
    'a',
    'about',
    'an',
    'and',
    'are',
    'as',
    'at',
    'be',
    'by',
    'do',
    'does',
    'for',
    'from',
    'has',
    'have',
    'i',
    'in',
    'is',
    'it',
    'my',
    'of',
    'on',
    'or',
    'our',
    'that',
    'the',
    'their',
    'this',
    'to',
    'use',
    'we',
    'with',
    'work',
    'working',
    'job',
    'role',
    'responsible',
    'responsibilities',
}
_CANONICAL_FORMS = {
    'analyses': 'analyz',
    'analysis': 'analyz',
    'analyze': 'analyz',
    'analyse': 'analyz',
    'analyzing': 'analyz',
    'analysing': 'analyz',
    'built': 'build',
    'building': 'build',
    'builds': 'build',
    'created': 'create',
    'creating': 'create',
    'creates': 'create',
    'developed': 'develop',
    'developing': 'develop',
    'developer': 'develop',
    'developers': 'develop',
    'develops': 'develop',
    'designed': 'design',
    'designing': 'design',
    'designer': 'design',
    'designers': 'design',
    'designs': 'design',
    'debugged': 'debug',
    'debugging': 'debug',
    'maintained': 'maintain',
    'maintaining': 'maintain',
    'manager': 'manag',
    'managers': 'manag',
    'managing': 'manag',
    'planning': 'plan',
    'planned': 'plan',
    'plans': 'plan',
    'reports': 'report',
    'reporting': 'report',
    'tested': 'test',
    'testing': 'test',
}


def _normalise_token(token: str) -> str:
    token = unicodedata.normalize('NFKD', token)
    token = ''.join(character for character in token if not unicodedata.combining(character))
    return _CANONICAL_FORMS.get(token, token)


def _tokens(value: str) -> set[str]:
    """Return comparable meaningful tokens without changing output values."""

    result: set[str] = set()
    for raw_token in _TOKEN_RE.findall(value.casefold()):
        token = _normalise_token(raw_token)
        if len(token) > 1 and token not in _STOP_WORDS:
            result.add(token)
    return result


def _flatten_context(value: Any) -> list[str]:
    """Flatten user context for matching while never emitting it verbatim."""

    if value is None:
        return []
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        values: list[str] = []
        for key in sorted(value):
            values.extend(_flatten_context(key))
            values.extend(_flatten_context(value[key]))
        return values
    if isinstance(value, (list, tuple, set)):
        values = []
        for item in value:
            values.extend(_flatten_context(item))
        return values
    return [str(value)]


def _query_tokens_for_suggestions(request: OccupationSuggestionsRequest) -> set[str]:
    signals = request.extracted
    parts = [request.user_description]
    for values in (signals.actions, signals.objects, signals.scope, signals.industry):
        parts.extend(values)
    return _tokens(' '.join(parts))


def _overlap(query_tokens: set[str], candidate_tokens: set[str]) -> set[str]:
    return query_tokens.intersection(candidate_tokens)


def _score(query_tokens: set[str], title: str, detail: str) -> tuple[float, set[str], set[str]]:
    title_tokens = _tokens(title)
    detail_tokens = _tokens(detail)
    searchable_tokens = title_tokens | detail_tokens
    matched = _overlap(query_tokens, searchable_tokens)
    title_matched = _overlap(query_tokens, title_tokens)

    if not query_tokens:
        return 0.0, matched, title_matched

    coverage = len(matched) / len(query_tokens)
    candidate_coverage = len(matched) / len(searchable_tokens) if searchable_tokens else 0.0
    title_coverage = len(title_matched) / len(title_tokens) if title_tokens else 0.0
    detail_coverage = (
        len(_overlap(query_tokens, detail_tokens)) / len(detail_tokens)
        if detail_tokens
        else 0.0
    )
    value = (
        (0.35 * coverage)
        + (0.35 * candidate_coverage)
        + (0.15 * title_coverage)
        + (0.15 * detail_coverage)
    )
    return min(value, 1.0), matched, title_matched


def _format_terms(terms: Iterable[str], limit: int = 6) -> str:
    return ', '.join(sorted(terms)[:limit])


def _suggestion_evidence(
    matched: set[str],
    title_matched: set[str],
    extracted: bool,
) -> list[str]:
    evidence: list[str] = []
    if matched:
        evidence.append(f"Shared supplied terms: {_format_terms(matched)}.")
    if title_matched:
        evidence.append(
            f"The supplied occupation title matches: {_format_terms(title_matched)}."
        )
    if extracted:
        evidence.append('The ranking also used the supplied extracted activity and context fields.')
    if not evidence:
        evidence.append('No strong shared term was found in the supplied occupation details.')
    return evidence


def _suggestion_difference(
    query_tokens: set[str],
    candidate_tokens: set[str],
) -> str:
    missing_from_candidate = query_tokens - candidate_tokens
    candidate_only = candidate_tokens - query_tokens
    if missing_from_candidate:
        return (
            'The user description includes terms not present in the supplied candidate details: '
            f"{_format_terms(missing_from_candidate)}."
        )
    if candidate_only:
        return (
            'The supplied candidate details also mention terms not in the user description: '
            f"{_format_terms(candidate_only)}."
        )
    return (
        'The supplied details overlap closely; the request does not provide a distinguishing '
        'scope beyond those shared terms.'
    )


def _clarifying_questions_for_suggestions(
    request: OccupationSuggestionsRequest,
) -> list[str]:
    questions: list[str] = []
    signals = request.extracted
    if not signals.actions:
        questions.append('What are the main activities you perform?')
    if not signals.objects:
        questions.append('What products, services, information, or equipment do you work with?')
    if not signals.scope:
        questions.append('What is the scope or setting of the work?')
    if not signals.industry:
        questions.append('Which industry or sector is involved?')
    if not questions:
        questions.append('Which supplied occupation candidate best reflects the work you described?')
    return questions[:4]


def _build_suggestion_item(
    candidate: OccupationSuggestionCandidate,
    score: float,
    query_tokens: set[str],
) -> OccupationResultItem:
    candidate_tokens = _tokens(f'{candidate.title} {candidate.description}')
    _, matched, title_matched = _score(query_tokens, candidate.title, candidate.description)
    return OccupationResultItem(
        occupation_code=candidate.code,
        title=candidate.title,
        confidence=round(score, 3),
        evidence=_suggestion_evidence(
            matched,
            title_matched,
            bool(query_tokens),
        ),
        difference=_suggestion_difference(query_tokens, candidate_tokens),
    )


def suggest_occupations(
    request: OccupationSuggestionsRequest,
) -> OccupationSuggestionsResponse:
    """Rerank only request candidates against the supplied work description."""

    query_tokens = _query_tokens_for_suggestions(request)
    ranked: list[tuple[float, int, OccupationSuggestionCandidate]] = []
    for index, candidate in enumerate(request.candidates):
        score, _, _ = _score(query_tokens, candidate.title, candidate.description)
        ranked.append((score, index, candidate))

    ranked.sort(key=lambda item: (-item[0], item[1]))
    selected = [item for item in ranked if item[0] >= SUGGESTION_CONFIDENCE_FLOOR][:MAX_RESULTS]
    if not selected:
        return OccupationSuggestionsResponse(
            status='clarifying',
            candidates=[],
            clarifying_questions=_clarifying_questions_for_suggestions(request),
        )

    return OccupationSuggestionsResponse(
        status='suggestions',
        candidates=[_build_suggestion_item(candidate, score, query_tokens) for score, _, candidate in selected],
        clarifying_questions=[],
    )


def _query_tokens_for_recommendations(request: OccupationRecommendationsRequest) -> set[str]:
    parts = [request.selected_occupation.title]
    parts.extend(_flatten_context(request.user_context))
    return _tokens(' '.join(parts))


def _recommendation_score(
    query_tokens: set[str],
    candidate: OccupationRecommendationCandidate,
) -> tuple[float, set[str], set[str]]:
    lexical_score, matched, title_matched = _score(
        query_tokens,
        candidate.title,
        candidate.why_similar,
    )
    note_tokens = _tokens(candidate.why_similar)
    # A non-empty caller-provided rationale is useful evidence, but it cannot
    # exceed the lexical score's contribution by itself.
    note_signal = min(len(note_tokens) / 10.0, 1.0) * 0.30
    return min((0.70 * lexical_score) + note_signal, 1.0), matched, title_matched


def _recommendation_evidence(
    candidate: OccupationRecommendationCandidate,
    matched: set[str],
    title_matched: set[str],
) -> list[str]:
    evidence = ['Exploration only; this is not hiring advice.']
    if candidate.why_similar.strip():
        evidence.append(f"Supplied similarity note: {candidate.why_similar.strip()}")
    if matched:
        evidence.append(f"Shared supplied terms: {_format_terms(matched)}.")
    if title_matched:
        evidence.append(f"The supplied title matches: {_format_terms(title_matched)}.")
    return evidence


def _recommendation_difference(
    selected_title: str,
    candidate_title: str,
) -> str:
    selected_tokens = _tokens(selected_title)
    candidate_tokens = _tokens(candidate_title)
    candidate_only = candidate_tokens - selected_tokens
    selected_only = selected_tokens - candidate_tokens
    if candidate_only and selected_only:
        return (
            'The supplied candidate title emphasizes '
            f"{_format_terms(candidate_only)} rather than the selected title's "
            f"{_format_terms(selected_only)}."
        )
    if candidate_only:
        return f"The supplied candidate title additionally emphasizes {_format_terms(candidate_only)}."
    if selected_only:
        return f"The supplied candidate title does not include {_format_terms(selected_only)} from the selected title."
    return 'The supplied candidate and selected titles share the same meaningful terms; verify the scope difference.'


def _clarifying_questions_for_recommendations() -> list[str]:
    return [
        'What aspect of the selected occupation would you like to explore, such as tasks, setting, or industry?',
        'Please provide a supplied similarity note or more context for comparing these occupations.',
    ]


def _build_recommendation_item(
    request: OccupationRecommendationsRequest,
    candidate: OccupationRecommendationCandidate,
    score: float,
    matched: set[str],
    title_matched: set[str],
) -> OccupationResultItem:
    return OccupationResultItem(
        occupation_code=candidate.code,
        title=candidate.title,
        confidence=round(score, 3),
        evidence=_recommendation_evidence(candidate, matched, title_matched),
        difference=_recommendation_difference(
            request.selected_occupation.title,
            candidate.title,
        ),
    )


def recommend_occupations(
    request: OccupationRecommendationsRequest,
) -> OccupationRecommendationsResponse:
    """Rerank only request candidates for exploration around a selected role."""

    query_tokens = _query_tokens_for_recommendations(request)
    ranked: list[tuple[float, int, OccupationRecommendationCandidate, set[str], set[str]]] = []
    for index, candidate in enumerate(request.candidates):
        score, matched, title_matched = _recommendation_score(query_tokens, candidate)
        ranked.append((score, index, candidate, matched, title_matched))

    ranked.sort(key=lambda item: (-item[0], item[1]))
    selected = [item for item in ranked if item[0] >= RECOMMENDATION_CONFIDENCE_FLOOR][:MAX_RESULTS]
    if not selected:
        return OccupationRecommendationsResponse(
            status='clarifying',
            candidates=[],
            clarifying_questions=_clarifying_questions_for_recommendations(),
        )

    return OccupationRecommendationsResponse(
        status='suggestions',
        candidates=[
            _build_recommendation_item(request, candidate, score, matched, title_matched)
            for score, _, candidate, matched, title_matched in selected
        ],
        clarifying_questions=[],
    )


# Explicit aliases make the provider seam easy to replace without changing routes.
deterministic_suggest_occupations = suggest_occupations
deterministic_recommend_occupations = recommend_occupations
