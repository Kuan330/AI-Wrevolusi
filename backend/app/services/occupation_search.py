"""Token-level fuzzy recall for the occupation title search.

The search improves on the SQL substring match over ``ref_occupations``
while keeping every result tied to a database row:

* normalisation is shared with the AI endpoints (``ai_matching`` tokeniser);
* a query word matches a row word exactly, or within a small edit distance
  (at most two edits, only for words of five or more characters);
* word order does not matter because matching is per token;
* words in scripts without spaces (for example Chinese) cannot match the
  English reference text by themselves.  When a query contains such words and
  the local pass finds nothing, an optional keyword normaliser built on the
  shared AI gateway may translate the description into English search
  keywords (the Iteration 2 plan allows LLM query normalisation).  The
  normaliser can only steer the search; results are still exclusively
  ``ref_occupations`` rows.
"""

from __future__ import annotations

import re
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.schemas.occupation_search import OccupationSearchKeywords
from app.services.ai_matching import (
    normalize_task_text_for_matching,
    tokenize_task_text_for_matching,
)

# A row is only returned as a fuzzy match when at least roughly a third of the
# matchable query words were found (direct substring hits are always kept).
MINIMUM_OCCUPATION_MATCH_CONFIDENCE = 0.34
MAXIMUM_FUZZY_OCCUPATION_RESULTS = 12
MAXIMUM_NORMALISED_QUERY_KEYWORDS = 12

# A direct substring hit is by definition a strong signal; when the token
# scorer cannot reproduce a score for it, keep a middle confidence instead of
# dropping or overselling the row.
DIRECT_MATCH_FALLBACK_CONFIDENCE = 0.5

_ALNUM_PATTERN = re.compile(r'[A-Za-z0-9]')


@dataclass(frozen=True)
class OccupationSearchHit:
    """One scored row: relevance plus the terms that produced it."""

    occupation_code: str
    confidence: float
    evidence: list[str]


def _is_matchable_token(token: str) -> bool:
    return bool(_ALNUM_PATTERN.search(token))


def _maximum_edit_distance(token: str) -> int:
    """Tolerate at most two edits, and only for longer words."""

    length = len(token)
    if length <= 3:
        return 0
    if length == 4:
        return 1
    return 2


def _edit_distance(first: str, second: str, *, maximum: int = 2) -> int:
    """Bounded Levenshtein distance; returns ``maximum + 1`` when larger."""

    if first == second:
        return 0
    if abs(len(first) - len(second)) > maximum:
        return maximum + 1

    previous = list(range(len(second) + 1))
    for index, first_char in enumerate(first, start=1):
        current = [index]
        smallest = current[0]
        for position, second_char in enumerate(second, start=1):
            cost = 0 if first_char == second_char else 1
            current.append(
                min(
                    previous[position] + 1,
                    current[position - 1] + 1,
                    previous[position - 1] + cost,
                )
            )
            smallest = min(smallest, current[position])
        if smallest > maximum:
            return maximum + 1
        previous = current
    return previous[-1]


def _token_signal(
    query_token: str,
    *,
    code: str,
    title_tokens: set[str],
    description_tokens: set[str],
) -> tuple[float, str] | None:
    """Weight and evidence for one query word against one row, or ``None``."""

    if query_token.isdigit() and len(query_token) >= 3 and query_token in code:
        # Codes are four digits; shorter numeric fragments are too ambiguous
        # for fuzzy scoring (the SQL direct path still matches them).
        return 1.0, f'code contains "{query_token}"'
    if query_token in title_tokens:
        return 1.0, f'title matches "{query_token}"'
    if query_token in description_tokens:
        return 0.75, f'description matches "{query_token}"'

    allowed = _maximum_edit_distance(query_token)
    if not allowed:
        return None

    best: tuple[float, str] | None = None
    for tokens, base, label in (
        (title_tokens, 0.8, 'title'),
        (description_tokens, 0.55, 'description'),
    ):
        for candidate_token in tokens:
            distance = _edit_distance(query_token, candidate_token)
            if distance <= allowed and distance <= _maximum_edit_distance(candidate_token):
                weight = base - (0.1 * distance)
                if best is None or weight > best[0]:
                    best = (
                        weight,
                        f'{label} close to "{candidate_token}" '
                        f'(edit distance {distance})',
                    )
    return best


def score_occupation_row(
    row: Mapping[str, Any],
    query_tokens: Sequence[str],
    normalized_query: str,
) -> OccupationSearchHit | None:
    """Score one occupation row against the query; ``None`` when nothing fits."""

    code = str(row.get('occupation_code') or '')
    title = str(row.get('title') or '')
    description = str(row.get('description') or '')
    title_tokens = set(tokenize_task_text_for_matching(title))
    description_tokens = set(tokenize_task_text_for_matching(description)) - title_tokens

    matchable_tokens = [token for token in query_tokens if _is_matchable_token(token)]
    if not matchable_tokens:
        return None

    total_weight = 0.0
    evidence: list[str] = []
    for token in matchable_tokens:
        signal = _token_signal(
            token,
            code=code,
            title_tokens=title_tokens,
            description_tokens=description_tokens,
        )
        if signal is None:
            continue
        weight, note = signal
        total_weight += weight
        evidence.append(note)

    if not evidence:
        return None

    confidence = min(1.0, total_weight / len(matchable_tokens))

    # A literal phrase hit always outranks partial token coverage.
    if len(normalized_query) >= 3:
        if normalized_query in normalize_task_text_for_matching(title):
            confidence = max(confidence, 0.97)
        elif normalized_query in normalize_task_text_for_matching(description):
            confidence = max(confidence, 0.8)

    return OccupationSearchHit(
        occupation_code=code,
        confidence=confidence,
        evidence=evidence[:6],
    )


def _collect_scored_hits(
    rows: Sequence[Mapping[str, Any]],
    query_tokens: Sequence[str],
    normalized_query: str,
) -> dict[str, OccupationSearchHit]:
    hits: dict[str, OccupationSearchHit] = {}
    for row in rows:
        hit = score_occupation_row(row, query_tokens, normalized_query)
        if hit is not None and hit.occupation_code:
            hits[hit.occupation_code] = hit
    return hits


def _clean_keywords(keywords: Sequence[str]) -> list[str]:
    """Keep only usable keyword tokens, de-duplicated and bounded."""

    cleaned: list[str] = []
    seen: set[str] = set()
    for keyword in keywords:
        for token in tokenize_task_text_for_matching(str(keyword)):
            if not _is_matchable_token(token) or token in seen:
                continue
            cleaned.append(token)
            seen.add(token)
            if len(cleaned) >= MAXIMUM_NORMALISED_QUERY_KEYWORDS:
                return cleaned
    return cleaned


def normalise_search_query(query: str, gateway: Any) -> list[str]:
    """Ask the shared gateway for English keywords; ``[]`` on any failure.

    The normaliser is strictly optional: without a configured provider the
    gateway falls back to the empty keyword list and the search simply keeps
    its deterministic behaviour.
    """

    try:
        result = gateway.run_structured(
            operation='occupation-search-keywords',
            payload={
                'query': query,
                'goal': 'english search keywords for the occupation search box',
            },
            response_model=OccupationSearchKeywords,
            local=lambda: OccupationSearchKeywords(keywords=[]),
            fallback=lambda: OccupationSearchKeywords(keywords=[]),
        )
        value = getattr(result, 'value', None)
    except Exception:  # noqa: BLE001 - optional layer by design
        return []

    raw = getattr(value, 'keywords', None)
    if not isinstance(raw, list):
        return []
    return _clean_keywords([item for item in raw if isinstance(item, str)])


def _enrich_row(
    row: Mapping[str, Any],
    hit: OccupationSearchHit | None,
    match_type: str,
) -> dict[str, Any]:
    item = dict(row)
    item['confidence'] = (
        round(hit.confidence, 3) if hit else DIRECT_MATCH_FALLBACK_CONFIDENCE
    )
    item['evidence'] = (
        list(hit.evidence) if hit else ['text contains the search text']
    )
    item['match_type'] = match_type
    return item


def search_occupation_rows(
    rows: Sequence[Mapping[str, Any]],
    direct_rows: Sequence[Mapping[str, Any]],
    query: str,
    *,
    keyword_normaliser: Callable[[str], Sequence[str]] | None = None,
) -> list[dict[str, Any]]:
    """Merge direct substring hits with fuzzy token recall, ranked by relevance.

    ``rows`` must contain every row the fuzzy pass may consider; ``direct_rows``
    are the SQL substring hits that must always be preserved.
    """

    query_tokens = tokenize_task_text_for_matching(query)
    normalized_query = normalize_task_text_for_matching(query)

    combined_rows: list[Mapping[str, Any]] = list(rows)
    known_codes = {str(row.get('occupation_code') or '') for row in combined_rows}
    for row in direct_rows:
        code = str(row.get('occupation_code') or '')
        if code and code not in known_codes:
            combined_rows.append(row)
            known_codes.add(code)

    rows_by_code = {
        str(row.get('occupation_code') or ''): row for row in combined_rows
    }
    direct_codes = {
        str(row.get('occupation_code') or '') for row in direct_rows
    }

    hits = _collect_scored_hits(combined_rows, query_tokens, normalized_query)

    results: list[dict[str, Any]] = []
    fuzzy_candidates: list[OccupationSearchHit] = []
    for row in combined_rows:
        code = str(row.get('occupation_code') or '')
        hit = hits.get(code)
        if code in direct_codes:
            results.append(_enrich_row(row, hit, 'direct'))
        elif hit is not None and hit.confidence >= MINIMUM_OCCUPATION_MATCH_CONFIDENCE:
            fuzzy_candidates.append(hit)

    fuzzy_candidates.sort(key=lambda hit: (-hit.confidence, hit.occupation_code))
    for hit in fuzzy_candidates[:MAXIMUM_FUZZY_OCCUPATION_RESULTS]:
        row = rows_by_code.get(hit.occupation_code)
        if row is not None:
            results.append(_enrich_row(row, hit, 'fuzzy'))

    has_unmatchable_tokens = any(
        not _is_matchable_token(token) for token in query_tokens
    )
    if (
        not results
        and keyword_normaliser is not None
        and query_tokens
        and has_unmatchable_tokens
    ):
        keywords = _clean_keywords(keyword_normaliser(query))
        if keywords:
            keyword_text = ' '.join(keywords)
            keyword_hits = _collect_scored_hits(
                combined_rows,
                tokenize_task_text_for_matching(keyword_text),
                normalize_task_text_for_matching(keyword_text),
            )
            translated = sorted(
                (
                    hit
                    for hit in keyword_hits.values()
                    if hit.confidence >= MINIMUM_OCCUPATION_MATCH_CONFIDENCE
                ),
                key=lambda hit: (-hit.confidence, hit.occupation_code),
            )[:MAXIMUM_FUZZY_OCCUPATION_RESULTS]
            note = 'English search keywords from your description: ' + ', '.join(
                keywords
            )
            for hit in translated:
                row = rows_by_code.get(hit.occupation_code)
                if row is None:
                    continue
                item = _enrich_row(row, hit, 'fuzzy')
                item['evidence'] = [note, *item['evidence']]
                results.append(item)

    results.sort(
        key=lambda item: (
            -item['confidence'],
            0 if item['match_type'] == 'direct' else 1,
            item['occupation_code'],
        )
    )
    return results


__all__ = [
    'DIRECT_MATCH_FALLBACK_CONFIDENCE',
    'MAXIMUM_FUZZY_OCCUPATION_RESULTS',
    'MAXIMUM_NORMALISED_QUERY_KEYWORDS',
    'MINIMUM_OCCUPATION_MATCH_CONFIDENCE',
    'OccupationSearchHit',
    'normalise_search_query',
    'score_occupation_row',
    'search_occupation_rows',
]
