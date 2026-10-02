import copy
import json
import uuid

import pytest
from pydantic import ValidationError
from app.routers.accounts import WorkspaceUpdate
from app.services.personal_learning_plans import LEARNING_PLAN_KEY, validate_learning_plans


def blueprint():
    return {
        'version': 1, 'id': 'plan-1', 'goalId': 'goal-1', 'goalTitle': 'Develop analytical thinking',
        'skillId': 'analytical-thinking', 'skillLabel': 'Analytical thinking', 'status': 'draft',
        'createdAt': '2026-10-01T10:00:00.000Z', 'updatedAt': '2026-10-01T10:00:00.000Z', 'acceptedAt': None,
        'inputs': {'experience': 'new', 'minutesPerDay': 30, 'goalKind': 'career', 'goalText': 'Build a project'},
        'courseIds': ['a'], 'activities': [
            {'id': 'a:0', 'title': 'Introduction', 'kind': 'course', 'courseId': 'a', 'minutes': 60, 'description': 'Study'},
            {'id': 'practice:1', 'title': 'Practice', 'kind': 'practice', 'minutes': 30, 'description': 'Try a sample'},
        ],
        'totals': {'minutes': 90, 'sessions': 2, 'courseMinutes': 60, 'practiceMinutes': 30},
        'estimatedDays': 3, 'rationale': 'Verified catalogue sequence', 'resources': [],
    }


def test_workspace_accepts_learning_plans_without_database_changes():
    data = {LEARNING_PLAN_KEY: json.dumps({'version': 1, 'plans': [blueprint()]})}
    assert WorkspaceUpdate(owner_id=uuid.uuid4(), data=data, revision=0).data == data
    validate_learning_plans(blueprint())  # Legacy single-blueprint compatibility.


@pytest.mark.parametrize('field,value', [
    ('version', True), ('status', 'wrong'), ('createdAt', 'invalid'), ('acceptedAt', 'invalid'),
    ('totals', {'minutes': -1}), ('estimatedDays', 2), ('courseIds', ['a', 'a']),
    ('activities', []), ('inputs', {'minutesPerDay': True}), ('resources', [{'id': 'x', 'kind': 'link', 'name': 'Unsafe', 'url': 'javascript:alert(1)'}]),
])
def test_invalid_plan_is_rejected_at_workspace_boundary(field, value):
    plan = blueprint()
    plan[field] = value
    with pytest.raises(ValidationError):
        WorkspaceUpdate(owner_id=uuid.uuid4(), data={LEARNING_PLAN_KEY: json.dumps({'version': 1, 'plans': [plan]})}, revision=0)


def test_active_plan_requires_acceptance_timestamp_and_duplicate_ids_are_rejected():
    plan = blueprint()
    plan['status'] = 'active'
    with pytest.raises(ValueError):
        validate_learning_plans({'version': 1, 'plans': [plan]})
    plan['acceptedAt'] = plan['updatedAt']
    validate_learning_plans({'version': 1, 'plans': [plan]})
    with pytest.raises(ValueError):
        validate_learning_plans({'version': 1, 'plans': [plan, copy.deepcopy(plan)]})


def test_resources_preserved_and_invalid_file_does_not_pass_validation():
    plan = blueprint()
    plan['resources'] = [
        {'id': 'file', 'kind': 'file', 'name': 'notes.md', 'sizeBytes': 7, 'text': '# Notes'},
        {'id': 'link', 'kind': 'link', 'name': 'Example', 'url': 'https://example.com/guide'},
    ]
    validate_learning_plans({'version': 1, 'plans': [plan]})
    plan['resources'][0]['text'] = '\x00bad'
    with pytest.raises(ValueError):
        validate_learning_plans({'version': 1, 'plans': [plan]})
