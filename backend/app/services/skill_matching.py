"""Auditable, offline WEF skill matching.

This module intentionally contains no network or model call.  Rules describe
observable task phrases, and every returned identifier/evidence phrase is
constrained by the request's candidate list and task text.
"""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from app.schemas.skill_matching import (
    SkillMatchCandidate,
    SkillMatchItem,
    SkillMatchResponse,
    candidate_id,
)


MAX_SKILL_MATCHES = 2
MINIMUM_SKILL_MATCH_CONFIDENCE = 0.50


@dataclass(frozen=True)
class SkillRule:
    skill_id: int
    phrases: tuple[str, ...]
    confidence: float


# IDs are only rule hints.  They become eligible output only when the same ID
# is present in the caller-provided candidates.
SKILL_RULES: tuple[SkillRule, ...] = (
    SkillRule(10, ("customer service", "customer", "service", "prompt service", "advising"), 0.90),
    SkillRule(7, ("active listening", "listen", "empathy", "understand customer"), 0.84),
    SkillRule(16, ("instructing staff", "instruct", "train", "teach", "mentoring"), 0.88),
    SkillRule(9, ("hiring", "interviewing", "evaluating staff", "promoting staff", "dismissing staff"), 0.86),
    SkillRule(3, ("work schedules", "schedule", "assigning staff", "supervising"), 0.84),
    SkillRule(13, ("inventory", "stock levels", "ordering new stock", "operations"), 0.82),
    SkillRule(14, ("safety", "stock", "packing", "wrapping", "attention to detail"), 0.76),
    SkillRule(21, ("budget", "financial transactions", "invoice", "payment", "cash register", "records"), 0.82),
    SkillRule(15, ("quality", "returned goods", "safety procedures", "quality control"), 0.82),
    SkillRule(12, ("appropriate action", "systems thinking", "recurring causes"), 0.78),
    SkillRule(1, ("product mix", "determining prices", "financial", "budgeting"), 0.76),
    SkillRule(18, ("displaying goods", "design", "user experience"), 0.76),
    SkillRule(24, ("wrapping", "packing", "stacking", "manual dexterity"), 0.78),
)


def _candidate_value(candidate: SkillMatchCandidate | Mapping[str, Any], key: str) -> Any:
    if isinstance(candidate, Mapping):
        return candidate.get(key)
    return getattr(candidate, key)


def _whole_phrase_match(task_text: str, phrase: str) -> str | None:
    """Return the exact source substring matching a case-insensitive phrase."""

    match = re.search(re.escape(phrase), task_text, flags=re.IGNORECASE)
    return match.group(0) if match else None


def _rule_evidence(task_text: str, rule: SkillRule) -> list[str]:
    evidence: list[str] = []
    seen: set[str] = set()
    for phrase in rule.phrases:
        source_phrase = _whole_phrase_match(task_text, phrase)
        if source_phrase and source_phrase.casefold() not in seen:
            evidence.append(source_phrase)
            seen.add(source_phrase.casefold())
    return evidence


def match_skills(
    task_text: str,
    candidates: Sequence[SkillMatchCandidate | Mapping[str, Any]],
) -> list[SkillMatchItem]:
    """Return at most two reliable matches from the supplied candidate allowlist."""

    if not task_text.strip():
        return []

    candidate_by_id: dict[int, SkillMatchCandidate | Mapping[str, Any]] = {}
    for candidate in candidates:
        try:
            candidate_by_id[candidate_id(candidate)] = candidate
        except (KeyError, TypeError, ValueError):
            continue

    matches: list[SkillMatchItem] = []
    for rule in SKILL_RULES:
        if rule.skill_id not in candidate_by_id:
            continue
        evidence = _rule_evidence(task_text, rule)
        if not evidence:
            continue
        matches.append(
            SkillMatchItem(
                wef_skill_id=rule.skill_id,
                confidence=rule.confidence,
                evidence_phrases=evidence,
            )
        )
        if len(matches) == MAX_SKILL_MATCHES:
            break

    return matches


def match_skills_response(
    task_text: str,
    candidates: Sequence[SkillMatchCandidate | Mapping[str, Any]],
) -> SkillMatchResponse:
    """Build the public response through the deterministic matching seam."""

    return SkillMatchResponse(skills=match_skills(task_text, candidates))


__all__ = [
    "MAX_SKILL_MATCHES",
    "MINIMUM_SKILL_MATCH_CONFIDENCE",
    "SKILL_RULES",
    "SkillRule",
    "match_skills",
    "match_skills_response",
]
