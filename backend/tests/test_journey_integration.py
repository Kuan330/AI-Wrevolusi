"""Exercise the account-owned career endpoint with offline reference fixtures."""

import copy
import json
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import create_app
from app.routers import possibilities as route
from app.services import skill_matching
from app.services.auth import get_current_user
from app.services.journey import JOURNEY_KEY

PROFILE = 'aiwrevolusi.userProfile'
SHORTLIST = 'aiwrevolusi.possibilities.shortlist'
STAMP = '2026-09-28T08:00:00.000Z'


def reviewed_workspace(decisions, *, completed=True, with_analysis=True):
    tasks = [{'id': 'task-1', 'wording': 'Analyse records and help customers'}]
    profile = {
        'tasksOccupationCode': '4110', 'tasks': tasks, 'tasksConfirmed': True,
        'analysis': {'occupationCode': '4110', 'tasks': copy.deepcopy(tasks)} if with_analysis else None,
    }
    return {
        PROFILE: json.dumps(profile),
        SHORTLIST: json.dumps([2]),
        JOURNEY_KEY: json.dumps({
            'version': 1, 'contexts': {}, 'courseContexts': {},
            'review': {
                'workKey': json.dumps({'occupationCode': '4110', 'tasks': tasks}),
                'decisions': decisions, 'completed': completed, 'updatedAt': STAMP,
            },
        }),
    }


def same_sub_major(rows):
    """Taxonomy placing every source role in one sub-major, so ranking is not filtered out."""
    codes = [row['occupation_code'] for row in rows]
    return {code: {'occupation_code': code, 'level': 'unit', 'parent_code': 'SUB'} for code in codes} | {
        'SUB': {'occupation_code': 'SUB', 'level': 'sub_major', 'parent_code': None}}


def career_client(monkeypatch, workspace):
    owner = uuid4()
    queries = []
    skills = {
        1: {'core_skill': 'Analytical thinking'},
        2: {'core_skill': 'Service orientation and customer service'},
        3: {'core_skill': 'Technological literacy'},
    }
    sources = [
        {'occupation_code': '4110', 'title': 'General office clerks', 'tasks': ['Source task']},
        {'occupation_code': '2421', 'title': 'Management and organisation analysts', 'tasks': ['Other source task']},
    ]
    original_sources = copy.deepcopy(sources)

    async def execute(statement, params):
        queries.append((str(statement), params))
        assert 'FROM app_accounts' in str(statement), 'Modern work must not fall back to legacy records'
        assert params == {'id': owner}
        result = Mock()
        result.scalar_one_or_none.return_value = workspace
        return result

    monkeypatch.setattr(route, '_load_reference_data', AsyncMock(return_value=(skills, sources, same_sub_major(sources))))
    monkeypatch.setattr(route, 'occupation_required_skills', lambda *_args, **_kwargs: {1, 2, 3})
    monkeypatch.setattr(skill_matching, 'match_skills', lambda *_args, **_kwargs: [
        SimpleNamespace(wef_skill_id=skill_id) for skill_id in (1, 2, 3)
    ])
    application = create_app('/api')
    application.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=owner, occupation_id=uuid4())

    async def database():
        # These tests cover workspace-owned WEF skill review behavior. ESCO
        # career suggestions have separate fixtures in test_possibilities_esco.
        yield SimpleNamespace(execute=execute, get=AsyncMock(return_value=None))

    application.dependency_overrides[get_db] = database
    return TestClient(application), queries, sources, original_sources


def test_endpoint_keeps_rejection_on_repeat_visits_without_removing_wanted_or_source_skills(monkeypatch):
    saved = reviewed_workspace({'1': 'accepted', '2': 'rejected', '99': 'accepted'})
    original = copy.deepcopy(saved)
    client, queries, sources, original_sources = career_client(monkeypatch, saved)
    with client:
        for _ in range(2):
            response = client.get('/api/v1/possibilities')
            assert response.status_code == 200
            payload = response.json()
            assert {item['skill_id'] for item in payload['skills'] if item['state'] == 'have'} == {1}
            assert payload['shortlisted_skill_ids'] == [2]
            assert payload['status'] == 'ready'
            assert {item['skill_id']: item['state'] for item in payload['skills']} == {
                1: 'have', 2: 'shortlisted', 3: 'suggested',
            }
    assert len(queries) == 2
    assert sources == original_sources
    assert saved == original


def test_endpoint_completed_review_with_no_acceptances_does_not_resurrect_inferred_strengths(monkeypatch):
    client, _, _, _ = career_client(monkeypatch, reviewed_workspace({'2': 'rejected'}))
    with client:
        response = client.get('/api/v1/possibilities')
    assert response.status_code == 200
    assert response.json()['status'] == 'ready'
    assert all(item['state'] != 'have' for item in response.json()['skills'])
    assert {item['skill_id']: item['state'] for item in response.json()['skills']} == {
        1: 'suggested', 2: 'shortlisted', 3: 'suggested',
    }
    assert response.json()['shortlisted_skill_ids'] == [2]


def test_endpoint_changed_work_preserves_rejection_while_awaiting_a_new_review(monkeypatch):
    saved = reviewed_workspace({'1': 'accepted', '2': 'rejected'})
    profile = json.loads(saved[PROFILE])
    profile['tasks'][0]['wording'] = 'Check newly assigned records and enquiries'
    profile['analysis']['tasks'] = copy.deepcopy(profile['tasks'])
    saved[PROFILE] = json.dumps(profile)
    client, _, _, _ = career_client(monkeypatch, saved)
    with client:
        response = client.get('/api/v1/possibilities')
    assert response.status_code == 200
    # The old review no longer matches the changed work, so nothing is treated as a confirmed strength.
    assert all(item['state'] != 'have' for item in response.json()['skills'])
    assert {item['skill_id'] for item in response.json()['skills'] if item['state'] == 'suggested'} == {1, 2, 3}


@pytest.mark.parametrize('raw', ['{bad', 'null', '{"version":1,"contexts":{},"courseContexts":{"course":"missing"}}'])
def test_endpoint_unreadable_review_returns_recovery_without_ignoring_corrections(monkeypatch, raw):
    saved = reviewed_workspace({'2': 'rejected'})
    saved[JOURNEY_KEY] = raw
    original = copy.deepcopy(saved)
    client, queries, _, _ = career_client(monkeypatch, saved)
    with client:
        response = client.get('/api/v1/possibilities')
    assert response.status_code == 409
    assert 'saved skill review could not be read' in response.json()['detail']
    assert len(queries) == 1
    assert saved == original


def test_endpoint_accepts_confirmed_tasks_without_an_ilo_assessment(monkeypatch):
    client, _, _, _ = career_client(monkeypatch, reviewed_workspace(
        {'1': 'accepted', '2': 'rejected'}, with_analysis=False,
    ))
    with client:
        response = client.get('/api/v1/possibilities')
    assert response.status_code == 200
    payload = response.json()
    assert payload['current_role']['occupation_code'] == '4110'
    assert payload['status'] == 'ready'
    assert {item['skill_id'] for item in payload['skills'] if item['state'] == 'have'} == {1}


def test_endpoint_draft_tasks_do_not_become_career_strengths_without_confirmation(monkeypatch):
    saved = reviewed_workspace({'1': 'accepted'}, with_analysis=False)
    profile = json.loads(saved[PROFILE])
    profile['tasksConfirmed'] = False
    saved[PROFILE] = json.dumps(profile)
    client, _, _, _ = career_client(monkeypatch, saved)
    with client:
        response = client.get('/api/v1/possibilities')
    assert response.status_code == 200
    assert response.json()['status'] == 'needs_profile'
    assert response.json()['current_role'] is None
    assert all(item['state'] != 'have' for item in response.json()['skills'])
