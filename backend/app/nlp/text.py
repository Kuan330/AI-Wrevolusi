from __future__ import annotations

import re
import unicodedata


_WHITESPACE = re.compile(r"\s+")
_TOKEN = re.compile(r"[a-z0-9]+")
_STOPWORDS = frozenset(
    {
        "a",
        "an",
        "the",
        "and",
        "or",
        "to",
        "of",
        "for",
        "in",
        "on",
        "at",
        "with",
        "by",
        "as",
        "such",
    }
)


def normalize_text(text: str) -> str:
    """NFKC + collapse whitespace. Do not translate Malay or mixed text."""
    folded = unicodedata.normalize("NFKC", text or "").strip()
    return _WHITESPACE.sub(" ", folded)


def normalize_for_match(text: str) -> str:
    value = normalize_text(text).casefold()
    return value.rstrip(".;")


def content_tokens(text: str) -> set[str]:
    return {
        token
        for token in _TOKEN.findall(normalize_for_match(text))
        if token not in _STOPWORDS and len(token) > 1
    }


def is_work_task(
    text: str,
    *,
    min_chars: int = 12,
    min_tokens: int = 2,
) -> bool:
    """True when the text can stand as a work activity, not a keyword or fragment.

    This is not an ILO similarity check. Shortened ILO lines such as
    "Planning and preparing work schedules" must pass.
    """
    normalized = normalize_text(text)
    if len(normalized) < min_chars:
        return False
    tokens = content_tokens(normalized)
    return len(tokens) >= min_tokens


def is_kept_ilo_edit(
    query: str,
    canonical: str,
    *,
    min_chars: int = 20,
    min_tokens: int = 3,
    min_ratio: float = 0.4,
) -> bool:
    """True when query is the same ILO sentence or a shortened form of it.

    Adding new work (query longer with new content) is not a kept edit.
    """
    query_key = normalize_for_match(query)
    canonical_key = normalize_for_match(canonical)
    if not query_key or not canonical_key:
        return False
    if query_key == canonical_key:
        return True
    if len(query_key) < min_chars:
        return False
    if len(query_key) / len(canonical_key) < min_ratio:
        return False
    if canonical_key.startswith(query_key) and (
        len(canonical_key) == len(query_key) or not canonical_key[len(query_key)].isalnum()
    ):
        return True
    query_tokens = content_tokens(query_key)
    canonical_tokens = content_tokens(canonical_key)
    if len(query_tokens) < min_tokens:
        return False
    return query_tokens <= canonical_tokens
