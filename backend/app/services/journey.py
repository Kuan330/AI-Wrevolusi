"""Bounded account-owned journey records; no changes to source skill facts."""
from __future__ import annotations

import json
import re
from datetime import datetime

JOURNEY_KEY = 'aiwrevolusi.journey.v1'


def _text(value: object, limit: int = 1000, *, nonempty: bool = False) -> bool:
    return isinstance(value, str) and len(value) <= limit and (bool(value) or not nonempty)


def _date(value: object) -> bool:
    if not _text(value, 40, nonempty=True):
        return False
    try:
        datetime.fromisoformat(value.replace('Z', '+00:00'))
        return True
    except ValueError:
        return False


def _strings(value: object) -> bool:
    return isinstance(value, list) and len(value) <= 100 and all(_text(item) for item in value)


def validate_journey(value: object) -> dict:
    """Reject malformed new records without modifying the saved workspace."""
    error = 'Saved journey data is invalid. Reload the saved account before changing it.'
    if not isinstance(value, dict) or value.get('version') != 1 or isinstance(value.get('version'), bool):
        raise ValueError(error)
    contexts, courses = value.get('contexts'), value.get('courseContexts')
    if not isinstance(contexts, dict) or not isinstance(courses, dict) or len(contexts) > 500 or len(courses) > 500:
        raise ValueError(error)
    for key, context in contexts.items():
        if not isinstance(context, dict) or context.get('id') != key or not _text(key, 100, nonempty=True):
            raise ValueError(error)
        skill = context.get('skill')
        if not isinstance(skill, dict) or skill.get('source') != 'wef':
            raise ValueError(error)
        if type(skill.get('id')) is not int or not 0 < skill['id'] <= 9_007_199_254_740_991:
            raise ValueError(error)
        if not _text(skill.get('slug'), 120) or not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', skill['slug']):
            raise ValueError(error)
        if not _text(skill.get('name'), 200, nonempty=True):
            raise ValueError(error)
        if context.get('origin') not in ('work', 'career', 'browse') or not _strings(context.get('taskIds')) or not _strings(context.get('taskLabels')):
            raise ValueError(error)
        if len(context['taskIds']) != len(context['taskLabels']) or not _text(context.get('goal')) or not _text(context.get('workKey'), 100_000) or not _date(context.get('createdAt')):
            raise ValueError(error)
        career = context.get('career')
        if 'career' in context and (not isinstance(career, dict) or not _text(career.get('code'), 40, nonempty=True) or not _text(career.get('title'), 200, nonempty=True)):
            raise ValueError(error)
        if context['origin'] == 'career' and career is None:
            raise ValueError(error)
    if any(not _text(key, 100, nonempty=True) or not _text(context, 100) or context not in contexts for key, context in courses.items()):
        raise ValueError(error)
    if 'activeContextId' in value and (not _text(value['activeContextId'], 100) or value['activeContextId'] not in contexts):
        raise ValueError(error)
    if 'personalSkills' in value:
        personal = value['personalSkills']
        if not isinstance(personal, list) or len(personal) > 50:
            raise ValueError(error)
        ids = set()
        for entry in personal:
            if not isinstance(entry, dict) or not _text(entry.get('id'), 100, nonempty=True) or not entry['id'].strip() or entry['id'] in ids:
                raise ValueError(error)
            ids.add(entry['id'])
            if not _text(entry.get('name'), 120, nonempty=True) or not entry['name'].strip():
                raise ValueError(error)
            if ('decision' in entry and (entry['decision'] is not None and (not isinstance(entry['decision'], str) or entry['decision'] not in ('use', 'no', 'unsure')))) or ('wantsLearning' in entry and type(entry['wantsLearning']) is not bool):
                raise ValueError(error)
            task_ids, labels = entry.get('taskIds'), entry.get('taskLabels')
            if not _strings(task_ids) or not task_ids or any(not item.strip() for item in task_ids) or len(set(task_ids)) != len(task_ids):
                raise ValueError(error)
            if not _strings(labels) or len(labels) != len(task_ids) or any(not item.strip() for item in labels):
                raise ValueError(error)
            if not _text(entry.get('workKey'), 100_000, nonempty=True) or not _date(entry.get('updatedAt')):
                raise ValueError(error)
    review = value.get('review')
    if 'review' in value:
        if not isinstance(review, dict) or not _text(review.get('workKey'), 100_000) or type(review.get('completed')) is not bool or not _date(review.get('updatedAt')):
            raise ValueError(error)
        decisions = review.get('decisions')
        if not isinstance(decisions, dict) or len(decisions) > 100 or any(not isinstance(key, str) or not re.fullmatch(r'[1-9]\d*', key) or decision not in ('accepted', 'rejected') for key, decision in decisions.items()):
            raise ValueError(error)
    resume = value.get('resume')
    if 'resume' in value:
        if not isinstance(resume, dict) or resume.get('kind') not in ('work', 'skills', 'learning', 'course') or not _date(resume.get('updatedAt')) or ('id' in resume and not _text(resume['id'], 100)):
            raise ValueError(error)
    return value


def _review_matches_work(work_key: str, workspace: dict) -> bool:
    try:
        snapshot = json.loads(work_key)
        raw_profile = workspace.get('aiwrevolusi.userProfile')
        if raw_profile is not None:
            profile = json.loads(raw_profile)
            tasks = profile.get('tasks')
            analysis = profile.get('analysis') or {}
            code = profile.get('tasksOccupationCode') or analysis.get('occupationCode')
        else:
            analysis = json.loads(workspace.get('aiwrevolusi.confirmedAnalysis', 'null')) or {}
            tasks, code = analysis.get('tasks'), analysis.get('occupationCode')
        if not isinstance(snapshot, dict) or not isinstance(tasks, list) or not isinstance(snapshot.get('tasks'), list):
            return False
        expected = sorted((task['id'], task['wording']) for task in tasks)
        recorded = sorted((task['id'], task['wording']) for task in snapshot['tasks'])
        return snapshot.get('occupationCode') == code and expected == recorded
    except (TypeError, ValueError, KeyError, AttributeError):
        return False


def apply_skill_review(owned: set[int], workspace: dict) -> set[int]:
    """A rejected current-work inference never becomes a confirmed career strength.

    Review does not remove a career requirement or prohibit wanting to learn it.
    Legacy accounts retain their existing inferred results until a review exists.
    """
    raw = workspace.get(JOURNEY_KEY)
    if raw is None:
        return owned
    try:
        state = validate_journey(json.loads(raw))
    except (TypeError, ValueError):
        raise ValueError('Your saved skill review could not be read. Reload your saved account before viewing career options.') from None
    review = state.get('review')
    if not review:
        return owned
    decisions = review['decisions']
    filtered = owned - {int(key) for key, decision in decisions.items() if decision == 'rejected'}
    if review['completed'] and _review_matches_work(review['workKey'], workspace):
        filtered &= {int(key) for key, decision in decisions.items() if decision == 'accepted'}
    return filtered
