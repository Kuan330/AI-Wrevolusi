"""Learning blueprints live in the existing account workspace JSON, not new DB tables."""
import math
from datetime import datetime
from urllib.parse import urlsplit

LEARNING_PLAN_KEY = 'aiwrevolusi.learningPlanDraft.v1'


def _text(value, limit=1000):
    return isinstance(value, str) and bool(value.strip()) and len(value) <= limit


def _date(value):
    if not _text(value, 40):
        return False
    try:
        datetime.fromisoformat(value.replace('Z', '+00:00'))
        return True
    except ValueError:
        return False


def _integer(value, minimum=1):
    return type(value) is int and value >= minimum


def _resources(resources):
    if not isinstance(resources, list) or len(resources) > 5:
        return False
    ids, contents, total = set(), set(), 0
    for item in resources:
        if not isinstance(item, dict) or not _text(item.get('id'), 100) or not _text(item.get('name'), 1000) or item['id'] in ids:
            return False
        ids.add(item['id'])
        if item.get('kind') == 'link':
            url = item.get('url')
            if not _text(url, 2048):
                return False
            try:
                parsed = urlsplit(url)
                if parsed.scheme not in ('http', 'https') or not parsed.hostname or parsed.username or parsed.password:
                    return False
            except ValueError:
                return False
            content = ('link', url)
        elif item.get('kind') == 'file':
            text, size = item.get('text'), item.get('sizeBytes')
            if not isinstance(text, str) or not text.strip() or len(text) > 20_000 or '\x00' in text or '\ufffd' in text or not _integer(size) or size > 1024 * 1024 or not item['name'].lower().endswith(('.txt', '.md', '.csv')):
                return False
            total += len(text)
            content = ('file', item['name'], text)
        else:
            return False
        if content in contents:
            return False
        contents.add(content)
    return total <= 50_000


def _plan(plan):
    if not isinstance(plan, dict) or type(plan.get('version')) is not int or plan.get('version') != 1:
        return False
    if not all(_text(plan.get(key)) for key in ('id', 'goalId', 'goalTitle', 'skillLabel', 'rationale')) or not isinstance(plan.get('skillId'), str):
        return False
    if plan.get('status') not in ('draft', 'active', 'archived') or not _date(plan.get('createdAt')) or not _date(plan.get('updatedAt')):
        return False
    accepted = plan.get('acceptedAt')
    if (accepted is not None and not _date(accepted)) or (plan['status'] == 'active' and accepted is None):
        return False
    inputs = plan.get('inputs')
    if not isinstance(inputs, dict) or inputs.get('experience') not in ('new', 'some', 'comfortable') or inputs.get('goalKind') not in ('career', 'skill', 'confidence', 'curiosity') or type(inputs.get('minutesPerDay')) is not int or inputs['minutesPerDay'] not in (15, 30, 45, 60, 90) or not _text(inputs.get('goalText')):
        return False
    if 'resources' in plan and not _resources(plan['resources']):
        return False
    courses, activities = plan.get('courseIds'), plan.get('activities')
    if not isinstance(courses, list) or not all(_text(item) for item in courses) or len(courses) != len(set(courses)) or not isinstance(activities, list) or not 1 <= len(activities) <= 1000:
        return False
    ids, course_minutes, practice_minutes = set(), 0, 0
    for item in activities:
        if not isinstance(item, dict) or not _text(item.get('id')) or not _text(item.get('title')) or not isinstance(item.get('description'), str) or item.get('kind') not in ('course', 'practice', 'review') or not _integer(item.get('minutes')) or item['id'] in ids:
            return False
        if 'estimated' in item and type(item['estimated']) is not bool:
            return False
        ids.add(item['id'])
        if item['kind'] == 'course':
            if item.get('courseId') not in courses:
                return False
            course_minutes += item['minutes']
        else:
            practice_minutes += item['minutes']
    minutes = course_minutes + practice_minutes
    return plan.get('totals') == {'minutes': minutes, 'sessions': len(activities), 'courseMinutes': course_minutes, 'practiceMinutes': practice_minutes} and type(plan.get('estimatedDays')) is int and plan['estimatedDays'] == math.ceil(minutes / inputs['minutesPerDay'])


def validate_learning_plans(value):
    plans = value.get('plans', [value]) if isinstance(value, dict) else None
    if not isinstance(value, dict) or type(value.get('version')) is not int or value.get('version') != 1 or not isinstance(plans, list) or len(plans) > 200 or not all(_plan(plan) for plan in plans) or len({plan['id'] for plan in plans}) != len(plans):
        raise ValueError('Saved learning plans are invalid. Your existing records are unchanged.')
