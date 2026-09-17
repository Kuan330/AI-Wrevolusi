"""Auditable, offline WEF skill matching.

This module intentionally contains no network or model call.  Rules describe
observable task phrases, and every returned identifier/evidence phrase is
constrained by the request's candidate list and task text.

The rule table covers all 26 WEF core skills.  Each rule lists phrases a person
might actually write — either the skill's own name, or the everyday words for
the work that uses it — so both "inventory" and "I keep track of stock and deal
with suppliers" land on Resource management and operations.
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


MAX_SKILL_MATCHES = 3
MINIMUM_SKILL_MATCH_CONFIDENCE = 0.50
# Occupation profiles need the full evidence set; the UI/task suggest path stays capped.
MAX_OCCUPATION_SKILL_MATCHES = len(SKILL_RULES) if False else 26  # filled after SKILL_RULES — see below


@dataclass(frozen=True)
class SkillRule:
    skill_id: int
    phrases: tuple[str, ...]
    confidence: float


# IDs are only rule hints.  They become eligible output only when the same ID
# is present in the caller-provided candidates.
#
# Every rule lists the distinctive words of its own skill name first, then the
# everyday words for the work that uses it. The name words matter because people
# search with fragments — "thinking" has to reach Analytical, Creative and
# Systems thinking, since a partial name is a normal way to search.
SKILL_RULES: tuple[SkillRule, ...] = (
    SkillRule(1, ("analytical", "analytical thinking", "thinking", "analyse", "analyze", "analysis", "problem solving", "reasoning", "reviewing", "evaluating", "assessing", "formulating", "identifying", "examining", "investigating", "determining"), 0.88),
    SkillRule(2, ("resilience", "resilient", "flexibility", "agility", "adapt to change", "working under pressure", "cope with change", "adapting", "adjusting", "responding to challenges"), 0.84),
    SkillRule(3, ("leadership", "leading a team", "lead a team", "managing a team", "supervising staff", "assigning staff", "work schedules", "delegating", "directing", "overseeing", "coordinating activities", "managing staff", "leading staff"), 0.88),
    SkillRule(4, ("creative", "creative thinking", "creativity", "thinking", "innovation", "brainstorming", "new ideas", "developing new", "innovative", "creative solutions", "designing new"), 0.86),
    SkillRule(5, ("motivation", "self-motivated", "self-awareness", "take initiative", "working independently", "reflect on", "self-directed", "proactive", "taking responsibility"), 0.80),
    SkillRule(6, ("technological literacy", "technological", "literacy", "digital tools", "software", "spreadsheets", "excel", "computer skills", "information technology", "digital systems", "electronic systems"), 0.86),
    SkillRule(7, ("empathy", "empathetic", "active listening", "listening", "understand customer", "compassion", "understanding needs", "relating to", "interpersonal"), 0.86),
    SkillRule(8, ("curiosity", "curious", "lifelong learning", "continuous learning", "upskilling", "self-development", "researching", "learning new", "staying current", "professional development"), 0.82),
    SkillRule(9, ("talent management", "talent", "hiring", "recruiting", "interviewing staff", "evaluating staff", "promoting staff", "onboarding", "selecting staff", "staff development", "human resources"), 0.88),
    SkillRule(10, ("customer service", "prompt service", "advising", "customer", "client", "complaint", "after-sales", "consulting with", "liaising with", "serving clients", "client relations"), 0.90),
    SkillRule(11, ("artificial intelligence", "generative ai", "machine learning", "big data", "data analytics", "data science", "ai", "automated systems", "intelligent systems"), 0.88),
    SkillRule(12, ("systems thinking", "systems", "thinking", "root cause", "recurring causes", "interconnected", "systematic approach", "holistic view", "integrated systems"), 0.82),
    SkillRule(13, ("resource management", "operations", "inventory", "stock levels", "ordering new stock", "supplier", "procurement", "logistics", "coordinating resources", "managing resources", "operational management"), 0.86),
    SkillRule(14, ("dependability", "attention to detail", "dependable", "reliability", "accuracy", "checking work", "thoroughness", "precise", "meticulous", "careful attention"), 0.84),
    SkillRule(15, ("quality control", "quality", "quality assurance", "quality checks", "inspection", "audit", "compliance", "safety", "ensuring consistency", "monitoring standards", "maintaining quality", "reviewing compliance"), 0.86),
    SkillRule(16, ("teaching", "teach", "mentor", "mentoring", "coach", "coaching", "training", "instructing staff", "educating", "developing skills", "knowledge transfer"), 0.88),
    SkillRule(17, ("cybersecurity", "network security", "it security", "firewall", "data protection", "networks", "information security", "security protocols"), 0.86),
    SkillRule(18, ("design", "user experience", "usability", "prototyping", "wireframe", "user research", "displaying goods", "designing", "layout", "visual design"), 0.82),
    SkillRule(19, ("multi-lingualism", "multilingual", "language", "bilingual", "translating", "interpretation", "cross-cultural communication", "language skills"), 0.84),
    SkillRule(20, ("marketing", "media", "campaigns", "social media", "advertising", "brand", "content creation", "promotional", "public relations", "communications"), 0.86),
    SkillRule(21, ("reading", "writing", "report writing", "documentation", "mathematics", "numeracy", "calculations", "budget", "financial transactions", "invoice", "payment", "records", "preparing reports", "briefing papers", "written communication", "documenting"), 0.80),
    SkillRule(22, ("environmental", "environmental stewardship", "stewardship", "sustainability", "sustainable", "carbon footprint", "recycling", "esg", "environmental protection", "green practices"), 0.86),
    SkillRule(23, ("programming", "coding", "software development", "python", "javascript", "sql", "writing code", "computer code", "software engineering", "application development"), 0.88),
    SkillRule(24, ("manual dexterity", "manual", "dexterity", "precision", "hand tools", "assembling", "stacking", "packing", "physical manipulation", "fine motor skills"), 0.80),
    SkillRule(25, ("global citizenship", "citizenship", "diversity", "inclusion", "cross-cultural", "multicultural", "international", "global perspective"), 0.80),
    SkillRule(26, ("sensory", "sensory-processing", "colour detection", "colour matching", "visual inspection", "sensory analysis"), 0.78),
)


def _candidate_value(candidate: SkillMatchCandidate | Mapping[str, Any], key: str) -> Any:
    if isinstance(candidate, Mapping):
        return candidate.get(key)
    return getattr(candidate, key)


def _phrase_pattern(phrase: str) -> re.Pattern[str]:
    """Compile once: word-boundary match with optional simple plurals."""

    return re.compile(rf"\b{re.escape(phrase)}(?:s|es)?\b", flags=re.IGNORECASE)


# Possibilities ranks every ILO task through these rules; compiling up front
# avoids rebuilding hundreds of thousands of regexes on a cold request.
_COMPILED_RULES: tuple[tuple[SkillRule, tuple[re.Pattern[str], ...]], ...] = tuple(
    (rule, tuple(_phrase_pattern(phrase) for phrase in rule.phrases))
    for rule in SKILL_RULES
)


def _whole_phrase_match(task_text: str, phrase: str) -> str | None:
    """Return the exact source substring matching a case-insensitive phrase.

    Word boundaries matter here: without them a short rule phrase like ``ai``
    would fire inside unrelated words such as "email" or "training".

    Only the plural form is tolerated automatically, because people write
    "suppliers" far more often than "supplier". Every other inflection is
    spelled out in the rule table instead, so matching stays predictable.
    """

    match = _phrase_pattern(phrase).search(task_text)
    return match.group(0) if match else None


def _rule_evidence(task_text: str, patterns: tuple[re.Pattern[str], ...]) -> list[str]:
    evidence: list[str] = []
    seen: set[str] = set()
    for pattern in patterns:
        match = pattern.search(task_text)
        if not match:
            continue
        source_phrase = match.group(0)
        if source_phrase.casefold() not in seen:
            evidence.append(source_phrase)
            seen.add(source_phrase.casefold())
    return evidence


def match_skills(
    task_text: str,
    candidates: Sequence[SkillMatchCandidate | Mapping[str, Any]],
    *,
    limit: int | None = MAX_SKILL_MATCHES,
) -> list[SkillMatchItem]:
    """Return the strongest matches from the candidate allowlist.

    Task-level suggestions stay capped (default ``MAX_SKILL_MATCHES``). Pass
    ``limit=None`` when building an occupation skill set so every matched WEF
    skill is kept for overlap percentages.
    """

    if not task_text.strip():
        return []

    candidate_by_id: dict[int, SkillMatchCandidate | Mapping[str, Any]] = {}
    for candidate in candidates:
        try:
            candidate_by_id[candidate_id(candidate)] = candidate
        except (KeyError, TypeError, ValueError):
            continue

    matches: list[SkillMatchItem] = []
    for rule, patterns in _COMPILED_RULES:
        if rule.skill_id not in candidate_by_id:
            continue
        evidence = _rule_evidence(task_text, patterns)
        if not evidence:
            continue
        matches.append(
            SkillMatchItem(
                wef_skill_id=rule.skill_id,
                confidence=rule.confidence,
                evidence_phrases=evidence,
            )
        )

    # Strongest signal first. Ordered by the rule table instead, the suggestions
    # a user sees would depend on where a rule happens to sit in the file.
    matches.sort(key=lambda item: item.confidence, reverse=True)
    if limit is None:
        return matches
    return matches[: max(0, limit)]


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
