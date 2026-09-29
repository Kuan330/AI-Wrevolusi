import copy
import json
from uuid import uuid4

import pytest
from pydantic import ValidationError
from app.services.specialist_review import SPECIALIST_KEY, validate_specialist_review
from app.routers.accounts import WorkspaceUpdate


def entry():
    return {'taskId': 't1', 'taskWording': 'Interpret mechanical drawings', 'occupationCode': '3115',
            'skillUri': 'http://data.europa.eu/esco/skill/12345678-1234-1234-1234-123456789abc',
            'skillLabel': 'Interpret drawings', 'sourceVersion': 'v1.2.0', 'decision': None,
            'wantsLearning': True, 'updatedAt': '2026-09-29T00:00:00.000Z'}


def state():
    e = entry()
    return {'version': 1, 'entries': [e], 'focusKey': json.dumps([e['taskId'], e['skillUri']], separators=(',', ':'))}


def test_specialist_choices_are_separate_from_source_skill_facts_and_wef_records():
    result = validate_specialist_review(state())
    assert result['entries'][0]['decision'] is None
    WorkspaceUpdate(owner_id=uuid4(), revision=0, data={SPECIALIST_KEY: json.dumps(result)})


def test_rejected_skill_can_still_be_a_learning_interest():
    value = state()
    value['entries'][0]['decision'] = 'no'
    assert validate_specialist_review(value)['focusKey']


@pytest.mark.parametrize('patch', [{'decision': 'mastered'}, {'skillUri': 'wef:1'}, {'wantsLearning': 1}, {'abilityScore': 80}, {'updatedAt': 'yesterday'}, {'taskWording': ''}, {'occupationCode': []}])
def test_invalid_specialist_entry_fails_without_sanitising_saved_data(patch):
    value = state()
    value['entries'][0].update(patch)
    original = copy.deepcopy(value)
    with pytest.raises(ValueError):
        validate_specialist_review(value)
    assert value == original
    with pytest.raises(ValidationError):
        WorkspaceUpdate(owner_id=uuid4(), revision=0, data={SPECIALIST_KEY: json.dumps(value)})


def test_duplicate_entries_and_unwanted_focus_are_rejected():
    value = state()
    value['entries'].append(entry())
    with pytest.raises(ValueError): validate_specialist_review(value)
    value = state()
    value['entries'][0]['wantsLearning'] = False
    with pytest.raises(ValueError): validate_specialist_review(value)


@pytest.mark.parametrize('value', [None, [], {'version': True, 'entries': [], 'focusKey': None}, {'version': 1, 'entries': [], 'focusKey': 'missing'}])
def test_invalid_records_fail_closed(value):
    with pytest.raises(ValueError): validate_specialist_review(value)


def test_source_occupation_is_optional_and_never_replaces_work_occupation():
    value = state()
    value['entries'][0]['sourceOccupationUri'] = 'http://data.europa.eu/esco/occupation/12345678-1234-1234-1234-123456789abc'
    assert validate_specialist_review(value)['entries'][0]['occupationCode'] == '3115'
    value['entries'][0]['sourceOccupationUri'] = None
    assert validate_specialist_review(value)
    value['entries'][0]['sourceOccupationUri'] = 'https://untrusted.example/role'
    with pytest.raises(ValueError): validate_specialist_review(value)
