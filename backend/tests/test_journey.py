import copy
import json
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.routers.accounts import WorkspaceUpdate
from app.services.journey import JOURNEY_KEY, apply_skill_review, validate_journey

STAMP = '2026-09-28T08:00:00.000Z'


def state():
    return {'version': 1, 'contexts': {}, 'courseContexts': {}}


def workspace(decisions=None, completed=True):
    profile = {'tasksOccupationCode': '4110', 'tasks': [{'id': 'task', 'wording': 'Analyse records'}], 'analysis': {}}
    key = json.dumps({'occupationCode': '4110', 'tasks': profile['tasks']})
    journey = {**state(), 'review': {'workKey': key, 'decisions': decisions or {}, 'completed': completed, 'updatedAt': STAMP}}
    return {'aiwrevolusi.userProfile': json.dumps(profile), JOURNEY_KEY: json.dumps(journey)}


def test_empty_record_and_review_are_valid():
    assert validate_journey(state()) == state()
    assert validate_journey(json.loads(workspace({'1': 'accepted'})[JOURNEY_KEY]))['review']['completed']


@pytest.mark.parametrize('bad', [None, [], {'version': True, 'contexts': {}, 'courseContexts': {}},
    {'version': 1, 'contexts': {'bad': {}}, 'courseContexts': {}},
    {'version': 1, 'contexts': {}, 'courseContexts': {'c': 'missing'}},
    {'version': 1, 'contexts': {}, 'courseContexts': {}, 'activeContextId': 'missing'}])
def test_invalid_shapes_are_rejected(bad):
    with pytest.raises(ValueError):
        validate_journey(bad)


def test_review_only_accepts_bounded_positive_ids_and_review_states():
    value = json.loads(workspace({'1': 'accepted'})[JOURNEY_KEY])
    for decisions in ({'0': 'accepted'}, {'1': 'mastered'}, {'x': 'rejected'}, {str(i): 'accepted' for i in range(1, 102)}):
        bad = copy.deepcopy(value)
        bad['review']['decisions'] = decisions
        with pytest.raises(ValueError):
            validate_journey(bad)


def test_completed_current_review_filters_inferences_to_accepted_supported_skills():
    assert apply_skill_review({1, 2, 3}, workspace({'1': 'accepted', '2': 'rejected', '99': 'accepted'})) == {1}


def test_incomplete_review_removes_rejections_without_claiming_all_other_skills_reviewed():
    assert apply_skill_review({1, 2, 3}, workspace({'2': 'rejected'}, completed=False)) == {1, 3}


def test_changed_work_does_not_reuse_old_acceptance_but_preserves_rejection():
    saved = workspace({'1': 'accepted', '2': 'rejected'})
    profile = json.loads(saved['aiwrevolusi.userProfile'])
    profile['tasks'][0]['wording'] = 'Prepare new reports'
    saved['aiwrevolusi.userProfile'] = json.dumps(profile)
    assert apply_skill_review({1, 2, 3}, saved) == {1, 3}


def test_review_does_not_change_wanted_skills_or_source_requirements():
    saved = workspace({'2': 'rejected'})
    saved['aiwrevolusi.possibilities.shortlist'] = '[2]'
    before = copy.deepcopy(saved)
    apply_skill_review({1, 2}, saved)
    assert saved == before


def test_legacy_records_keep_their_existing_inferences():
    assert apply_skill_review({1, 2}, {}) == {1, 2}


def test_malformed_saved_review_reports_recovery_instead_of_ignoring_corrections():
    with pytest.raises(ValueError, match='could not be read'):
        apply_skill_review({1}, {JOURNEY_KEY: '{bad'})


def learning_context(context_id, origin):
    return {
        'id': context_id,
        'origin': origin,
        'skill': {'source': 'wef', 'id': 1, 'slug': 'analytical-thinking', 'name': 'Analytical thinking'},
        'taskIds': ['task'] if origin == 'work' else [],
        'taskLabels': ['Analyse records'] if origin == 'work' else [],
        'goal': 'Check the conclusions in my reports',
        'workKey': json.loads(workspace()[JOURNEY_KEY])['review']['workKey'],
        'createdAt': STAMP,
        **({'career': {'code': '2421', 'title': 'Management and organisation analysts'}} if origin == 'career' else {}),
    }


def test_workspace_update_preserves_review_and_learning_origins_without_rewriting_other_records():
    saved = workspace({'1': 'accepted', '2': 'rejected'})
    journey = json.loads(saved[JOURNEY_KEY])
    journey['contexts'] = {origin: learning_context(origin, origin) for origin in ('work', 'career', 'browse')}
    journey['courseContexts'] = {'course-1': 'work'}
    journey['activeContextId'] = 'career'
    journey['resume'] = {'kind': 'learning', 'id': 'career', 'updatedAt': STAMP}
    saved[JOURNEY_KEY] = json.dumps(journey)
    saved['aiwrevolusi.courseLibrary.v1'] = json.dumps({'saved': ['course-1']})
    original = copy.deepcopy(saved)

    payload = WorkspaceUpdate(owner_id=uuid4(), revision=3, data=saved)

    assert payload.data == original
    assert saved == original
    stored = json.loads(payload.data[JOURNEY_KEY])
    assert stored['review']['decisions']['2'] == 'rejected'
    assert stored['contexts']['career']['taskIds'] == []
    assert stored['contexts']['career']['career']['code'] == '2421'
    assert stored['courseContexts']['course-1'] == 'work'


@pytest.mark.parametrize('raw', [
    '{bad',
    'null',
    '[]',
    json.dumps({'version': 1, 'contexts': {}, 'courseContexts': {'course-1': 'not-saved'}}),
    json.dumps({'version': 1, 'contexts': {}, 'courseContexts': {}, 'activeContextId': 'not-saved'}),
])
def test_workspace_update_rejects_unreadable_or_dangling_journey_without_mutating_input(raw):
    saved = {JOURNEY_KEY: raw, 'aiwrevolusi.userProfile': json.dumps({'tasks': []})}
    original = copy.deepcopy(saved)
    with pytest.raises(ValidationError):
        WorkspaceUpdate(owner_id=uuid4(), revision=0, data=saved)
    assert saved == original


@pytest.mark.parametrize('field', ['review', 'resume', 'career'])
def test_workspace_update_rejects_null_records_that_cannot_be_restored_by_the_frontend(field):
    journey = state()
    if field == 'career':
        context = learning_context('browse', 'browse')
        context['career'] = None
        journey['contexts'] = {'browse': context}
    else:
        journey[field] = None
    with pytest.raises(ValidationError):
        WorkspaceUpdate(owner_id=uuid4(), revision=0, data={JOURNEY_KEY: json.dumps(journey)})


@pytest.mark.parametrize('field', ['origin', 'decision', 'resume_kind'])
def test_workspace_update_rejects_arrays_instead_of_coercing_them_to_journey_labels(field):
    journey = state()
    if field == 'origin':
        context = learning_context('work', 'work')
        context['origin'] = ['work']
        journey['contexts'] = {'work': context}
    elif field == 'decision':
        journey = json.loads(workspace()[JOURNEY_KEY])
        journey['review']['decisions'] = {'1': ['accepted']}
    else:
        journey['resume'] = {'kind': ['course'], 'id': 'course-1', 'updatedAt': STAMP}
    with pytest.raises(ValidationError):
        WorkspaceUpdate(owner_id=uuid4(), revision=0, data={JOURNEY_KEY: json.dumps(journey)})


def test_personal_skills_preserve_user_evidence_without_changing_reference_ownership():
    entry = {'id': 'personal-1', 'name': 'CAD drafting', 'taskIds': ['task'], 'taskLabels': ['Draw a part'], 'workKey': 'snapshot', 'updatedAt': STAMP}
    value = {**state(), 'personalSkills': [entry]}
    assert validate_journey(value)['personalSkills'] == [entry]
    assert apply_skill_review({1, 2}, {JOURNEY_KEY: json.dumps(value)}) == {1, 2}
    for personal in (None, {}, [entry, entry], [{**entry, 'name': ' '}], [{**entry, 'taskIds': []}], [{**entry, 'taskLabels': []}], [{**entry, 'taskIds': ['task', 'task'], 'taskLabels': ['a', 'b']}], [{**entry, 'id': str(i)} for i in range(51)]):
        with pytest.raises(ValueError):
            validate_journey({**state(), 'personalSkills': personal})
