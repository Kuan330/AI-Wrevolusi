import copy
import json
import pytest
from app.services.learning_onboarding import (
    LEARNING_ONBOARDING_KEY, validate_learning_onboarding, validate_onboarding_source,
)


def fixture():
    goal_id, plan_id = '12345678-1234-1234-1234-123456789abc', 'plan-1'
    wording = 'Learn AI for my current job'
    marker = {'version': 1, 'completedAt': '2026-10-01T00:00:00Z', 'goalId': goal_id, 'planId': plan_id}
    goal = {'id': goal_id, 'sourceKey': 'onboarding:' + goal_id, 'wording': wording,
            'initial': {'skill': {'source': 'personal', 'id': goal_id, 'label': wording, 'sourceVersion': None},
                        'decision': None, 'tasks': [], 'occupationCode': None, 'sourceOccupationUri': None,
                        'career': None, 'origin': 'browse', 'workKey': None, 'wording': wording}}
    data = {LEARNING_ONBOARDING_KEY: json.dumps(marker), 'aiwrevolusi.learningGoals.v1': json.dumps({'version': 1, 'goals': [goal]}),
            'aiwrevolusi.learningPlanDraft.v1': json.dumps({'version': 1, 'plans': [{'id': plan_id, 'goalId': goal_id}]})}
    return goal, marker, data


def test_valid_completed_marker_and_user_owned_goal():
    goal, marker, data = fixture()
    validate_learning_onboarding(marker, data)
    validate_onboarding_source(goal, data)


@pytest.mark.parametrize('patch', [{'version': True}, {'version': 2}, {'completedAt': 'bad'}, {'completedAt': None}, {'goalId': ''}, {'planId': ' '}, {'extra': True}])
def test_corrupt_marker_is_rejected(patch):
    _, marker, _ = fixture()
    marker.update(patch)
    with pytest.raises(ValueError):
        validate_learning_onboarding(marker)


@pytest.mark.parametrize('key', ['aiwrevolusi.learningGoals.v1', 'aiwrevolusi.learningPlanDraft.v1'])
def test_marker_requires_goal_and_plan_in_the_same_transaction(key):
    _, marker, data = fixture()
    del data[key]
    with pytest.raises(ValueError):
        validate_learning_onboarding(marker, data)


def test_plan_must_belong_to_the_completed_goal():
    _, marker, data = fixture()
    data['aiwrevolusi.learningPlanDraft.v1'] = json.dumps({'plans': [{'id': marker['planId'], 'goalId': 'different-goal'}]})
    with pytest.raises(ValueError):
        validate_learning_onboarding(marker, data)


@pytest.mark.parametrize('patch', [{'decision': 'accepted'}, {'tasks': [{'id': 't1', 'wording': 'Invented task'}]}, {'origin': 'work'}, {'career': {'code': '1', 'title': 'Invented career'}}, {'workKey': 'invented-work'}])
def test_first_time_goal_cannot_fabricate_evidence(patch):
    goal, _, data = fixture()
    goal['initial'].update(patch)
    with pytest.raises(ValueError):
        validate_onboarding_source(goal, data)


def test_source_identity_cannot_be_rewritten():
    goal, _, data = fixture()
    goal['sourceKey'] = 'onboarding:different'
    with pytest.raises(ValueError):
        validate_onboarding_source(goal, data)


def test_marker_cannot_authorize_a_different_free_goal():
    goal, marker, data = fixture()
    another = copy.deepcopy(goal)
    another['id'] = 'different-goal'
    data['aiwrevolusi.learningGoals.v1'] = json.dumps({'goals': [goal, another]})
    marker['goalId'] = another['id']
    data[LEARNING_ONBOARDING_KEY] = json.dumps(marker)
    data['aiwrevolusi.learningPlanDraft.v1'] = json.dumps({'plans': [{'id': marker['planId'], 'goalId': another['id']}]})
    with pytest.raises(ValueError):
        validate_onboarding_source(goal, data)


def full_workspace():
    goal, marker, data = fixture()
    now = marker['completedAt']
    goal.update(createdAt=now, updatedAt=now, action=None, attempts=[], history=[], revision=1, needsReview=False)
    plan = {
        'version': 1, 'id': marker['planId'], 'goalId': goal['id'], 'goalTitle': goal['wording'],
        'skillId': '', 'skillLabel': goal['wording'], 'status': 'draft', 'createdAt': now, 'updatedAt': now,
        'inputs': {'experience': 'new', 'minutesPerDay': 30, 'goalKind': 'career', 'goalText': goal['wording']},
        'resources': [], 'courseIds': [], 'activities': [
            {'id': 'practice:1', 'title': 'Try a small activity', 'kind': 'practice', 'minutes': 30, 'description': 'Practice your goal.'},
            {'id': 'review:1', 'title': 'Review your learning', 'kind': 'review', 'minutes': 15, 'description': 'Record what worked.'}],
        'totals': {'minutes': 45, 'sessions': 2, 'courseMinutes': 0, 'practiceMinutes': 45},
        'estimatedDays': 2, 'rationale': 'A practice starting sequence.', 'acceptedAt': None,
    }
    data['aiwrevolusi.learningGoals.v1'] = json.dumps({'version': 1, 'goals': [goal]})
    data['aiwrevolusi.learningPlanDraft.v1'] = json.dumps({'version': 1, 'plans': [plan]})
    return data


def test_full_first_use_save_passes_real_account_and_goal_transition_validation():
    from uuid import uuid4
    from app.routers.accounts import WorkspaceUpdate
    from app.services.learning_goals import validate_learning_goal_transition
    data = full_workspace()
    WorkspaceUpdate(owner_id=uuid4(), revision=0, data=data)
    validate_learning_goal_transition({}, data)


def test_revisiting_or_updating_other_workspace_records_keeps_completed_setup_valid():
    from uuid import uuid4
    from app.routers.accounts import WorkspaceUpdate
    from app.services.learning_goals import validate_learning_goal_transition
    before = full_workspace()
    after = copy.deepcopy(before)
    after['aiwrevolusi.plan.courses.v1'] = json.dumps({'courses': []})
    WorkspaceUpdate(owner_id=uuid4(), revision=0, data=after)
    validate_learning_goal_transition(before, after)


def test_account_endpoint_rejects_marker_without_its_saved_plan():
    from uuid import uuid4
    from pydantic import ValidationError
    from app.routers.accounts import WorkspaceUpdate
    data = full_workspace()
    del data['aiwrevolusi.learningPlanDraft.v1']
    with pytest.raises(ValidationError):
        WorkspaceUpdate(owner_id=uuid4(), revision=0, data=data)
