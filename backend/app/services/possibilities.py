from __future__ import annotations

import json
import math
import re
from collections.abc import Iterable, Mapping
from typing import Literal

SkillState = Literal['have', 'learning', 'shortlisted', 'missing']


MODERN_PROFILE_KEY = 'aiwrevolusi.userProfile'
PROFILE_RECOVERY_MESSAGE = 'Your saved work profile could not be read. Reload your saved account or restore a valid profile before viewing Possibilities.'
ESCO_VERSION = '1.2.0'
ESCO_SOURCE_URL = 'https://ec.europa.eu/esco/portal'
ESCO_SOURCE_NOTE = ('Career directions use ESCO v1.2.0 occupation-to-skill links. Matches are exploratory; ESCO is not a validated Malaysian job-readiness or hiring assessment.')


def confirmed_workspace_evidence(workspace: object, occupations: Iterable[Mapping]) -> tuple[list[str], dict | None]:
    """Read confirmed evidence. A modern profile never falls back to old data.

    A completed analysis or an explicit task confirmation supplies evidence.
    Starter drafts do not. Invalid modern data needs recovery instead of
    silently substituting another source.
    """
    if not isinstance(workspace, Mapping):
        raise ValueError(PROFILE_RECOVERY_MESSAGE)
    modern = MODERN_PROFILE_KEY in workspace
    task_confirmation = False
    try:
        if modern:
            profile = json.loads(workspace[MODERN_PROFILE_KEY])
            if not isinstance(profile, dict):
                raise ValueError(PROFILE_RECOVERY_MESSAGE)
            if 'tasks' in profile and (
                not isinstance(profile['tasks'], list)
                or any(not isinstance(task, dict) for task in profile['tasks'])
            ):
                raise ValueError(PROFILE_RECOVERY_MESSAGE)
            analysis = profile.get('analysis')
            if analysis is None and profile.get('tasksConfirmed') is True:
                task_confirmation = True
                analysis = {'occupationCode': profile.get('tasksOccupationCode'), 'tasks': profile.get('tasks')}
        else:
            analysis = json.loads(workspace.get('aiwrevolusi.confirmedAnalysis', 'null'))
    except (TypeError, ValueError) as error:
        if modern:
            raise ValueError(PROFILE_RECOVERY_MESSAGE) from error
        return [], None
    if analysis is None:
        return [], None
    if not isinstance(analysis, dict):
        if modern:
            raise ValueError(PROFILE_RECOVERY_MESSAGE)
        return [], None
    code = analysis.get('occupationCode')
    tasks = analysis.get('tasks')
    valid = (
        ((task_confirmation and code is None) or (isinstance(code, str) and bool(code.strip())))
        and isinstance(tasks, list)
        and all(isinstance(task, dict) and isinstance(task.get('wording'), str)
                and bool(task['wording'].strip()) for task in tasks)
    )
    if modern and not valid:
        raise ValueError(PROFILE_RECOVERY_MESSAGE)
    if not isinstance(tasks, list):
        return [], None
    if task_confirmation and code is None:
        return list(dict.fromkeys(task['wording'].strip() for task in tasks)), None
    if not isinstance(code, str):
        return [], None
    reference = next((row for row in occupations if row['occupation_code'] == code), None)
    if reference is None:
        if modern:
            raise ValueError(PROFILE_RECOVERY_MESSAGE)
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


def reviewed_esco_evidence(workspace: object) -> tuple[set[str], set[str]]:
    """Return only current, task-linked ESCO self-reports and learning interests."""
    from app.services.specialist_review import SPECIALIST_KEY, validate_specialist_review

    if not isinstance(workspace, Mapping):
        raise ValueError('Your saved work profile could not be read. Reload your account before viewing career options.')
    try:
        raw_profile = workspace.get(MODERN_PROFILE_KEY)
        if raw_profile is not None:
            profile = json.loads(raw_profile)
            if not isinstance(profile, dict):
                raise ValueError()
            analysis = profile.get('analysis') or {}
            tasks = profile.get('tasks') if isinstance(profile.get('tasks'), list) else analysis.get('tasks', [])
            occupation_code = profile.get('tasksOccupationCode') or analysis.get('occupationCode')
            confirmed = profile.get('tasksConfirmed') is True or bool(analysis.get('tasks'))
        else:
            analysis = json.loads(workspace.get('aiwrevolusi.confirmedAnalysis', 'null')) or {}
            tasks = analysis.get('tasks', [])
            occupation_code = analysis.get('occupationCode')
            confirmed = bool(tasks)
        if not confirmed or not isinstance(tasks, list):
            return set(), set()
        current_tasks = {task['id']: task['wording'] for task in tasks
                         if isinstance(task, dict) and isinstance(task.get('id'), str)
                         and isinstance(task.get('wording'), str)}
        raw_specialist = workspace.get(SPECIALIST_KEY)
        specialist = validate_specialist_review(json.loads(raw_specialist)) if raw_specialist else {'entries': []}
    except (TypeError, ValueError, KeyError, AttributeError) as error:
        raise ValueError('Your saved ESCO skill review could not be read. Reload your account before viewing career options.') from error

    current: set[str] = set()
    developing: set[str] = set()
    for entry in specialist['entries']:
        if (entry['sourceVersion'] != ESCO_VERSION
                or entry['occupationCode'] != occupation_code
                or current_tasks.get(entry['taskId']) != entry['taskWording']):
            continue
        if entry['decision'] == 'use':
            current.add(entry['skillUri'])
        if entry['wantsLearning']:
            developing.add(entry['skillUri'])
    return current, developing - current


def wef_career_evidence(
    workspace: object,
    inferred_skill_ids: set[int],
    allowed_skill_ids: set[int],
) -> tuple[set[int], set[int], set[int]]:
    """Return accepted, task-suggested, and saved-learning WEF skills."""
    from app.services.journey import JOURNEY_KEY, _review_matches_work, validate_journey

    if not isinstance(workspace, Mapping):
        raise ValueError('Your saved skill review could not be read. Reload your account before viewing career options.')
    try:
        raw = workspace.get(JOURNEY_KEY)
        if raw is None:
            return set(), inferred_skill_ids & allowed_skill_ids, set()
        state = validate_journey(json.loads(raw))
    except (TypeError, ValueError) as error:
        raise ValueError('Your saved skill review could not be read. Reload your account before viewing career options.') from error

    current: set[int] = set()
    rejected: set[int] = set()
    review = state.get('review')
    review_is_current = bool(review and _review_matches_work(review['workKey'], dict(workspace)))
    if review_is_current:
        current = {
            int(skill_id) for skill_id, decision in review['decisions'].items()
            if decision == 'accepted' and int(skill_id) in allowed_skill_ids
        }
        rejected = {
            int(skill_id) for skill_id, decision in review['decisions'].items()
            if decision == 'rejected' and int(skill_id) in allowed_skill_ids
        }
    developing = {
        context['skill']['id'] for context in state['contexts'].values()
        if context['skill']['id'] in allowed_skill_ids
        and _review_matches_work(context['workKey'], dict(workspace))
    }
    suggested = (inferred_skill_ids & allowed_skill_ids) - current - rejected - developing
    return current, suggested, developing - current


def completed_course_wef_skill_ids(
    skills: Mapping[int, Mapping],
    catalogue_scope: Mapping[str, Mapping[str, set[int]]],
    progress_rows: Iterable[Mapping],
) -> set[int]:
    """Return WEF skills with at least one fully completed linked course."""
    progress: dict[tuple[str, str], dict[int, int]] = {}
    for row in progress_rows:
        key = (str(row['skill_id']), str(row['course_id']))
        progress.setdefault(key, {})[int(row['chapter_index'])] = int(row['value'])

    completed_slugs = {
        skill_slug
        for skill_slug, courses in catalogue_scope.items()
        for course_id, chapter_indexes in courses.items()
        if chapter_indexes and all(
            progress.get((skill_slug, course_id), {}).get(chapter_index, 0) >= 10
            for chapter_index in chapter_indexes
        )
    }
    return {
        int(skill_id)
        for skill_id, skill in skills.items()
        if slugify_skill_name(str(skill.get('core_skill') or '')) in completed_slugs
    }


def occupations_in_same_sub_major(
    occupations: Iterable[Mapping],
    current_occupation_code: str | None,
    taxonomy: Mapping[str, Mapping],
) -> list[Mapping]:
    """Limit candidate occupations to the selected role's sub-major category."""
    rows = list(occupations)
    if not current_occupation_code:
        return rows

    def sub_major_code(code: str) -> str | None:
        seen: set[str] = set()
        row = taxonomy.get(code)
        while row:
            current_code = str(row.get('occupation_code') or '')
            if current_code in seen:
                return None
            seen.add(current_code)
            if row.get('level') == 'sub_major':
                return current_code
            parent = str(row.get('parent_code') or '')
            row = taxonomy.get(parent)
        return None

    selected_sub_major = sub_major_code(str(current_occupation_code))
    if selected_sub_major is None:
        # If taxonomy data is missing or stale, avoid silently recommending
        # occupations from unrelated categories.
        return []
    return [
        row for row in rows
        if sub_major_code(str(row.get('occupation_code') or '')) == selected_sub_major
    ]


def rank_esco_directions(occupations, relations, skills, current_skill_uris, developing_skill_uris, source):
    """Rank source-linked ESCO roles using current skills and learning interests."""
    by_occupation: dict[str, list[dict]] = {}
    for relation in relations:
        if relation['skill_uri'] in skills:
            by_occupation.setdefault(relation['occupation_uri'], []).append(relation)

    ranked = []
    for occupation in occupations:
        role_relations = by_occupation.get(occupation['uri'], [])
        essential = {r['skill_uri'] for r in role_relations if r['relation'] == 'essential'}
        optional = {r['skill_uri'] for r in role_relations if r['relation'] == 'optional'}
        required = essential | optional
        current_overlap = required & current_skill_uris
        developing_overlap = required & developing_skill_uris
        if not current_overlap and not developing_overlap:
            continue
        not_yet_evidenced = essential - current_skill_uris - developing_skill_uris
        requirements = [
            {'uri': uri, 'label': skills[uri]['label'], 'relation': relation,
             'state': 'current' if uri in current_skill_uris else ('developing' if uri in developing_skill_uris else 'not_yet_evidenced')}
            for uri, relation in sorted(((uri, 'essential') for uri in essential), key=lambda item: skills[item[0]]['label'].casefold())
        ]
        requirements.extend(
            {'uri': uri, 'label': skills[uri]['label'], 'relation': 'optional',
             'state': 'current' if uri in current_skill_uris else ('developing' if uri in developing_skill_uris else 'not_yet_evidenced')}
            for uri in sorted(optional - essential, key=lambda item: skills[item]['label'].casefold())
        )
        ranked.append({
            'occupation_code': occupation['isco_code'], 'occupation_uri': occupation['uri'],
            'title': occupation['label'], 'area': 'ESCO occupation',
            'description': occupation['description'], 'coverage_pct': None, 'skills': [],
            'requirements': requirements, 'source': source,
            'current_skill_overlap': len(current_overlap),
            'developing_skill_overlap': len(developing_overlap),
            'essential_not_yet_evidenced': len(not_yet_evidenced),
        })
    ranked.sort(key=lambda row: (
        -sum(skill['relation'] == 'essential' and skill['state'] == 'current' for skill in row['requirements']),
        -row['current_skill_overlap'], row['essential_not_yet_evidenced'],
        -row['developing_skill_overlap'], row['title'].casefold(), row['occupation_uri'],
    ))
    return ranked[:3]


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
# Bump when the occupation skill aggregation rules change (e.g. uncapped matches).
_OCCUPATION_SKILL_CACHE_VERSION = 3
_required_skills_cache: dict[str, frozenset[int]] = {}
_required_skills_cache_key: tuple[int, int, tuple[tuple[int, str], ...]] | None = None


def _skills_cache_key(skills: Mapping[int, Mapping]) -> tuple[int, int, tuple[tuple[int, str], ...]]:
    names = tuple(
        sorted(
            (int(skill_id), str(row.get('core_skill') or ''))
            for skill_id, row in skills.items()
            if str(row.get('core_skill') or '').strip()
        )
    )
    return (_OCCUPATION_SKILL_CACHE_VERSION, len(names), names)


def _match_candidates(skills: Mapping[int, Mapping]):
    from app.schemas.skill_matching import SkillMatchCandidate

    return [
        SkillMatchCandidate(id=int(skill_id), skill=name)
        for skill_id, name in _skills_cache_key(skills)[2]
    ]


def occupation_required_skills(
    tasks: Iterable[object],
    skills: Mapping[int, Mapping],
    *,
    occupation: Mapping | None = None,
) -> set[int]:
    """Map occupation evidence through the allowlisted matcher without a 3-skill cap.

    Pass ``occupation`` so title and description also contribute to the skill set.
    """
    if occupation is not None:
        code = str(occupation.get('occupation_code') or occupation.get('masco_code') or '')
        if code:
            return _cached_occupation_required_skills(
                code, occupation, tasks, skills
            )
    from app.services.skill_matching import match_skills

    candidates = _match_candidates(skills)
    required: set[int] = set()
    for task in tasks:
        required.update(
            item.wef_skill_id
            for item in match_skills(_task_text(task), candidates, limit=None)
        )
    return required


def _ensure_skills_cache(skills: Mapping[int, Mapping]) -> None:
    global _required_skills_cache, _required_skills_cache_key
    cache_key = _skills_cache_key(skills)
    if _required_skills_cache_key != cache_key:
        _required_skills_cache = {}
        _required_skills_cache_key = cache_key


def _occupation_evidence_texts(occupation: Mapping, tasks: Iterable[object]) -> list[str]:
    """Title, description, and task wording all contribute to the skill set."""
    texts: list[str] = []
    for value in (occupation.get('title'), occupation.get('description')):
        if isinstance(value, str) and value.strip():
            texts.append(value.strip())
    for task in tasks:
        text = _task_text(task).strip()
        if text:
            texts.append(text)
    return texts


def _cached_occupation_required_skills(
    occupation_code: str,
    occupation: Mapping,
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
    for text in _occupation_evidence_texts(occupation, tasks):
        required.update(
            item.wef_skill_id for item in match_skills(text, match_list, limit=None)
        )
    frozen = frozenset(required)
    _required_skills_cache[occupation_code] = frozen
    return set(frozen)


def skill_overlap_score(
    confirmed_skill_ids: set[int], required_skill_ids: set[int]
) -> int:
    """Return a symmetric overlap score without rewarding narrow subsets as 100%."""

    if not confirmed_skill_ids or not required_skill_ids:
        return 0
    shared = confirmed_skill_ids & required_skill_ids
    return round(
        2 * len(shared) * 100 / (len(confirmed_skill_ids) + len(required_skill_ids))
    )


def recommend_occupations(
    occupations: Iterable[Mapping],
    confirmed_skill_ids: set[int],
    skills: Mapping[int, Mapping],
    limit: int = 3,
    *,
    exclude_codes: set[str] | None = None,
    developing_skill_ids: set[int] | None = None,
    suggested_skill_ids: set[int] | None = None,
) -> list[dict]:
    """Rank occupations by current, task-suggested, and developing WEF skills.

    Coverage is the current and developing overlap / required skills, using every WEF skill matched
    from the occupation's title, description, and ILO tasks (not a 3-skill cap).
    """
    _ensure_skills_cache(skills)
    candidates = _match_candidates(skills)
    excluded = exclude_codes or set()
    developing = developing_skill_ids or set()
    suggested = suggested_skill_ids or set()
    ranked: list[dict] = []
    for occupation in occupations:
        code = str(occupation.get('occupation_code') or occupation.get('masco_code') or '')
        if not code or code in excluded:
            continue
        required = _cached_occupation_required_skills(
            code, occupation, occupation.get('tasks') or [], skills, candidates=candidates
        )
        # Tiny sets inflate percentages; keep occupations with a usable skill map.
        if len(required) < 2:
            continue
        owned = confirmed_skill_ids & required
        learning = developing & required
        task_suggestions = suggested & required
        if not owned and not learning and not task_suggestions:
            continue
        ranked.append({
            'occupation_code': code,
            'title': str(occupation.get('title') or ''),
            'area': occupation.get('industry'),
            'description': str(occupation.get('description') or ''),
            # Coverage = shared / required — matches the direction skill map.
            'coverage_pct': round(len(owned | learning | task_suggestions) * 100 / len(required)),
            'required_skill_ids': sorted(required),
            'overlap_count': len(owned),
            'developing_overlap_count': len(learning),
            'suggested_overlap_count': len(task_suggestions),
            'missing_count': len(required - owned - learning - task_suggestions),
            'skill_states': {
                skill_id: 'have' if skill_id in owned else 'learning' if skill_id in learning else 'suggested' if skill_id in task_suggestions else 'missing'
                for skill_id in required
            },
        })
    # Current matches lead; developing skills improve future-fit ranking.
    ranked.sort(key=lambda row: (
        -(row['overlap_count'] + row['developing_overlap_count'] + row['suggested_overlap_count']),
        -row['overlap_count'], row['missing_count'], -row['coverage_pct'], row['title'].casefold(),
    ))
    return ranked[:limit]


def chosen_direction_score(
    owned_skill_ids: set[int], required_skill_ids: set[int]
) -> int:
    """Coverage against the chosen direction's required skill map."""

    if not required_skill_ids:
        return 0
    return round(len(owned_skill_ids & required_skill_ids) * 100 / len(required_skill_ids))


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
    'skill_overlap_score',
    'slugify_skill_name',
    'validate_shortlist_ids',
]
