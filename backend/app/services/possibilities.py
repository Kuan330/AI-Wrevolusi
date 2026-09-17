from __future__ import annotations

import json
import math
import re
from collections.abc import Iterable, Mapping
from typing import Literal

SkillState = Literal['have', 'learning', 'shortlisted', 'missing']


def confirmed_workspace_evidence(workspace: object, occupations: Iterable[Mapping]) -> tuple[list[str], dict | None]:
    """Read the confirmed snapshot, never the editable task draft.

    A present modern profile is authoritative, including a cleared/invalid
    analysis; stale legacy data must not resurrect that confirmation.
    """
    if not isinstance(workspace, Mapping):
        return [], None
    key = 'aiwrevolusi.userProfile'
    try:
        if key in workspace:
            profile = json.loads(workspace[key])
            analysis = profile.get('analysis') if isinstance(profile, dict) else None
        else:
            analysis = json.loads(workspace.get('aiwrevolusi.confirmedAnalysis', 'null'))
    except (TypeError, ValueError):
        return [], None
    if not isinstance(analysis, dict):
        return [], None
    code = analysis.get('occupationCode')
    if not isinstance(code, str):
        return [], None
    reference = next((row for row in occupations if row['occupation_code'] == code), None)
    tasks = analysis.get('tasks')
    if reference is None or not isinstance(tasks, list):
        return [], None
    texts = list(dict.fromkeys(
        task['wording'].strip() for task in tasks
        if isinstance(task, dict) and isinstance(task.get('wording'), str) and task['wording'].strip()
    ))
    if not texts:
        return [], None
    return texts, {'occupation_code': code, 'title': reference['title']}


def slugify_skill_name(name: str) -> str:
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9]+', '-', name.lower())).strip('-')


def classify_skill_state(*, has_skill: bool, learning: bool, shortlisted: bool) -> SkillState:
    """Classify facts without interpreting them as job readiness."""

    if has_skill:
        return 'have'
    if learning:
        return 'learning'
    if shortlisted:
        return 'shortlisted'
    return 'missing'


def validate_shortlist_ids(
    skill_ids: Iterable[int], *, allowed_skill_ids: set[int], limit: int
) -> list[int]:
    """Return a stable, deduplicated shortlist containing only verified WEF IDs."""

    raw = list(skill_ids)
    if any(type(skill_id) is not int or skill_id <= 0 for skill_id in raw):
        raise ValueError('shortlisted skill IDs must be positive integers')
    unique = list(dict.fromkeys(raw))
    if len(unique) > limit:
        raise ValueError('too many shortlisted skills')
    unknown = [skill_id for skill_id in unique if skill_id not in allowed_skill_ids]
    if unknown:
        raise ValueError(f'unknown WEF skill: {unknown[0]}')
    return unique


def _task_text(task: object) -> str:
    if isinstance(task, str):
        return task
    if isinstance(task, Mapping):
        return str(task.get('task_text') or task.get('title') or task.get('description') or '')
    return str(getattr(task, 'title', '') or '') + ' ' + str(getattr(task, 'description', '') or '')


# Reference occupation→skill maps are stable for a process; cache avoids re-matching
# every occupation on each Possibilities request (the main timeout source).
_required_skills_cache: dict[str, frozenset[int]] = {}
_required_skills_cache_key: tuple[int, tuple[tuple[int, str], ...]] | None = None


def _skills_cache_key(skills: Mapping[int, Mapping]) -> tuple[int, tuple[tuple[int, str], ...]]:
    names = tuple(
        sorted(
            (int(skill_id), str(row.get('core_skill') or ''))
            for skill_id, row in skills.items()
            if str(row.get('core_skill') or '').strip()
        )
    )
    return (len(names), names)


def _match_candidates(skills: Mapping[int, Mapping]):
    from app.schemas.skill_matching import SkillMatchCandidate

    return [
        SkillMatchCandidate(id=int(skill_id), skill=name)
        for skill_id, name in _skills_cache_key(skills)[1]
    ]


def occupation_required_skills(tasks: Iterable[object], skills: Mapping[int, Mapping]) -> set[int]:
    """Map occupation task evidence through the existing allowlisted matcher."""
    from app.services.skill_matching import match_skills

    candidates = _match_candidates(skills)
    required: set[int] = set()
    for task in tasks:
        required.update(item.wef_skill_id for item in match_skills(_task_text(task), candidates))
    return required


def _ensure_skills_cache(skills: Mapping[int, Mapping]) -> None:
    global _required_skills_cache, _required_skills_cache_key
    cache_key = _skills_cache_key(skills)
    if _required_skills_cache_key != cache_key:
        _required_skills_cache = {}
        _required_skills_cache_key = cache_key


def _cached_occupation_required_skills(
    occupation_code: str,
    tasks: Iterable[object],
    skills: Mapping[int, Mapping],
    *,
    candidates: list | None = None,
) -> set[int]:
    _ensure_skills_cache(skills)
    cached = _required_skills_cache.get(occupation_code)
    if cached is not None:
        return set(cached)
    from app.services.skill_matching import match_skills

    match_list = candidates if candidates is not None else _match_candidates(skills)
    required: set[int] = set()
    for task in tasks:
        required.update(item.wef_skill_id for item in match_skills(_task_text(task), match_list))
    frozen = frozenset(required)
    _required_skills_cache[occupation_code] = frozen
    return set(frozen)


def recommend_occupations(
    occupations: Iterable[Mapping], confirmed_skill_ids: set[int], skills: Mapping[int, Mapping], limit: int = 3
) -> list[dict]:
    """Return valid real occupations, ranked by overlap; input order breaks ties."""
    _ensure_skills_cache(skills)
    candidates = _match_candidates(skills)
    ranked: list[dict] = []
    for occupation in occupations:
        code = str(occupation.get('occupation_code') or occupation.get('masco_code') or '')
        required = _cached_occupation_required_skills(
            code, occupation.get('tasks') or [], skills, candidates=candidates
        )
        if not required:
            continue
        owned = required & confirmed_skill_ids
        ranked.append({
            'occupation_code': code,
            'title': str(occupation.get('title') or ''),
            'area': occupation.get('industry'),
            'description': str(occupation.get('description') or ''),
            'coverage_pct': round(len(owned) * 100 / len(required)),
            'required_skill_ids': sorted(required),
        })
    ranked.sort(key=lambda row: -row['coverage_pct'])
    return ranked[:limit]


def chosen_direction_score(owned_skill_ids: set[int], shortlisted_skill_ids: set[int], required_skill_ids: set[int]) -> int:
    """Score owned skills fully and shortlisted-only skills half, once each."""
    if not required_skill_ids:
        return 0
    owned = owned_skill_ids & required_skill_ids
    shortlist_only = (shortlisted_skill_ids & required_skill_ids) - owned
    return (len(owned) + 0.5 * len(shortlist_only)) * 100 / len(required_skill_ids)


def filter_allowed_directions(
    rows: Iterable[Mapping], allowed: Mapping[str, Mapping]
) -> list[dict]:
    """Filter provider output and restore authoritative occupation metadata."""

    result: list[dict] = []
    seen: set[str] = set()
    for row in rows:
        code = str(row.get('occupation_code') or row.get('code') or '').strip()
        if not code or code in seen or code not in allowed:
            continue
        try:
            confidence = float(row.get('confidence'))
        except (TypeError, ValueError):
            continue
        if not math.isfinite(confidence):
            continue
        reference = allowed[code]
        result.append(
            {
                'occupation_code': code,
                'title': str(reference.get('title') or ''),
                'description': str(reference.get('description') or ''),
                'confidence': max(0.0, min(1.0, confidence)),
            }
        )
        seen.add(code)
    return result


__all__ = [
    'classify_skill_state',
    'chosen_direction_score',
    'filter_allowed_directions',
    'occupation_required_skills',
    'recommend_occupations',
    'slugify_skill_name',
    'validate_shortlist_ids',
]
