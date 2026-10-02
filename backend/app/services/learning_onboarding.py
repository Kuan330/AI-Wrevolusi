"""First-time learning setup: user-owned goals without invented work/skill evidence."""
import json
from datetime import datetime

LEARNING_ONBOARDING_KEY = 'aiwrevolusi.learningPlanOnboarding.v1'


def validate_learning_onboarding(value, data=None):
    if not isinstance(value, dict) or set(value) != {'version', 'completedAt', 'goalId', 'planId'} or type(value['version']) is not int or value['version'] != 1:
        raise ValueError('Learning setup is invalid. Your existing records are unchanged.')
    for key in ('goalId', 'planId'):
        if not isinstance(value[key], str) or not value[key].strip() or len(value[key]) > 100:
            raise ValueError('Learning setup references are invalid.')
    try:
        if not isinstance(value['completedAt'], str) or len(value['completedAt']) > 40:
            raise ValueError()
        datetime.fromisoformat(value['completedAt'].replace('Z', '+00:00'))
    except ValueError as exc:
        raise ValueError('Learning setup completion date is invalid.') from exc
    if data is not None:
        goals = json.loads(data.get('aiwrevolusi.learningGoals.v1', '{"goals":[]}')).get('goals', [])
        saved = json.loads(data.get('aiwrevolusi.learningPlanDraft.v1', '{}'))
        plans = saved.get('plans', [saved])
        if not any(goal.get('id') == value['goalId'] for goal in goals) or not any(plan.get('id') == value['planId'] and plan.get('goalId') == value['goalId'] for plan in plans):
            raise ValueError('Complete learning setup only with its saved goal and plan.')


def validate_onboarding_source(goal, data):
    marker = json.loads(data.get(LEARNING_ONBOARDING_KEY, '{}'))
    validate_learning_onboarding(marker, data)
    wording = goal.get('wording')
    if not isinstance(wording, str) or not wording.strip() or len(wording) > 300:
        raise ValueError('Write a learning goal of 300 characters or fewer.')
    identifier = goal['id']
    expected = {
        'skill': {'source': 'personal', 'id': identifier, 'label': wording, 'sourceVersion': None},
        'decision': None, 'tasks': [], 'occupationCode': None, 'sourceOccupationUri': None,
        'career': None, 'origin': 'browse', 'workKey': None, 'wording': wording,
    }
    if goal.get('sourceKey') != 'onboarding:' + identifier or goal.get('initial') != expected or marker['goalId'] != identifier:
        raise ValueError('A first-time learning goal cannot claim confirmed skills or work evidence.')
