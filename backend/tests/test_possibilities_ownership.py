"""Account workspace precedence and recovery behavior, without a database."""

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

PROFILE = 'aiwrevolusi.userProfile'
LEGACY = 'aiwrevolusi.confirmedAnalysis'


def analysis(text='modern evidence', code='1111'):
    return {'occupationCode': code, 'tasks': [{'wording': text}]}


def setup_client(monkeypatch, workspace, *, fail_workspace=False, user_id=None, query_params=None):
    queries = []
    user_id = user_id or uuid4()
    async def execute(statement, params):
        query = str(statement)
        queries.append(query)
        if query_params is not None:
            query_params.append((query, dict(params) if isinstance(params, dict) else params))
        result = Mock()
        if 'FROM app_accounts' in query:
            if fail_workspace:
                raise RuntimeError('private database detail')
            result.scalar_one_or_none.return_value = workspace
        elif 'FROM tasks' in query:
            result.mappings.return_value.all.return_value = [{'title': 'legacy evidence', 'description': None}]
        elif 'FROM occupations' in query:
            result.mappings.return_value.one_or_none.return_value = {'masco_code': '2222', 'title': 'Legacy role'}
        else:
            raise AssertionError(query)
        return result
    # The current route reads the installed ESCO release with AsyncSession.get.
    # Returning no release keeps these workspace-ownership tests independent of
    # the specialist catalogue while still exercising the route.
    db = SimpleNamespace(execute=execute, get=AsyncMock(return_value=None))
    monkeypatch.setattr(route, '_load_reference_data', AsyncMock(return_value=(
        {1: {'core_skill': 'Modern skill'}, 2: {'core_skill': 'Legacy skill'}},
        [{'occupation_code': '1111', 'title': 'Modern role'}, {'occupation_code': '2222', 'title': 'Legacy role'}],
        {'1111': {'occupation_code': '1111', 'level': 'unit', 'parent_code': 'SUB'},
         '2222': {'occupation_code': '2222', 'level': 'unit', 'parent_code': 'SUB'},
         'SUB': {'occupation_code': 'SUB', 'level': 'sub_major', 'parent_code': None}},
    )))
    monkeypatch.setattr(route, 'occupation_required_skills', lambda *args, **kwargs: set())
    monkeypatch.setattr(skill_matching, 'match_skills', lambda text, *args, **kwargs: [
        SimpleNamespace(wef_skill_id=1 if text == 'modern evidence' else 2),
    ])
    application = create_app('/api')
    application.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user_id, occupation_id=uuid4())
    async def database():
        yield db
    application.dependency_overrides[get_db] = database
    return TestClient(application), queries


def test_modern_confirmation_ignores_conflicting_legacy_workspace_and_tables(monkeypatch):
    workspace = {PROFILE: json.dumps({'analysis': analysis()}), LEGACY: json.dumps(analysis('legacy evidence', '2222'))}
    client, queries = setup_client(monkeypatch, workspace)
    with client:
        response = client.get('/api/v1/possibilities')
    assert response.status_code == 200
    payload = response.json()
    assert payload['current_role']['occupation_code'] == '1111'
    # Modern evidence is matched from tasks; the conflicting legacy skill is not.
    assert {item['skill_id'] for item in payload['skills'] if item['state'] == 'suggested'} == {1}
    assert not any('FROM tasks' in query or 'FROM occupations' in query for query in queries)


@pytest.mark.parametrize('profile', [{'analysis': None}, {'tasks': []}])
def test_cleared_or_unconfirmed_modern_profile_never_resurrects_legacy(monkeypatch, profile):
    client, queries = setup_client(monkeypatch, {PROFILE: json.dumps(profile), LEGACY: json.dumps(analysis('legacy evidence', '2222'))})
    with client:
        response = client.get('/api/v1/possibilities')
    assert response.status_code == 200
    assert response.json()['status'] == 'needs_profile'
    assert response.json()['current_role'] is None
    assert all(item['state'] != 'have' for item in response.json()['skills'])
    assert len(queries) == 1


@pytest.mark.parametrize('raw', ['{bad', 'null', '[]', '"profile"', '{"analysis":[]}', '{"analysis":{"tasks":[]}}', '{"tasks":"bad","analysis":null}', '{"analysis":{"occupationCode":"1111","tasks":[{}]}}'])
def test_invalid_modern_profile_returns_recovery_error_without_legacy_queries(monkeypatch, raw):
    client, queries = setup_client(monkeypatch, {PROFILE: raw, LEGACY: json.dumps(analysis('legacy evidence', '2222'))})
    with client:
        response = client.get('/api/v1/possibilities')
    assert response.status_code == 409
    assert 'saved work profile could not be read' in response.json()['detail']
    assert len(queries) == 1


@pytest.mark.parametrize('workspace', [{}, {LEGACY: json.dumps(analysis('legacy evidence', '2222'))}])
def test_absent_modern_profile_keeps_legacy_fallback(monkeypatch, workspace):
    client, queries = setup_client(monkeypatch, workspace)
    with client:
        response = client.get('/api/v1/possibilities')
    assert response.status_code == 200
    assert response.json()['current_role']['occupation_code'] == '2222'
    assert {item['skill_id'] for item in response.json()['skills'] if item['state'] == 'suggested'} == {2}
    assert any('FROM tasks' in query for query in queries)


def test_workspace_read_failure_does_not_fall_back_to_old_tasks(monkeypatch):
    client, queries = setup_client(monkeypatch, {}, fail_workspace=True)
    with client:
        response = client.get('/api/v1/possibilities')
    assert response.status_code == 503
    assert 'saved account could not be loaded' in response.json()['detail']
    assert 'private database detail' not in response.text
    assert len(queries) == 1


@pytest.mark.parametrize('workspace', [[], 'invalid', False])
def test_invalid_workspace_container_requires_recovery(monkeypatch, workspace):
    client, queries = setup_client(monkeypatch, workspace)
    with client:
        response = client.get('/api/v1/possibilities')
    assert response.status_code == 409
    assert len(queries) == 1


def test_workspace_and_legacy_task_queries_are_scoped_to_authenticated_user(monkeypatch):
    user_id = uuid4()
    query_params = []
    client, _ = setup_client(monkeypatch, {}, user_id=user_id, query_params=query_params)
    with client:
        response = client.get('/api/v1/possibilities')

    assert response.status_code == 200
    assert next(params for query, params in query_params if 'FROM app_accounts' in query) == {'id': user_id}
    assert next(params for query, params in query_params if 'FROM tasks' in query) == {'user_id': user_id}


def test_unauthenticated_possibilities_request_does_not_query_database(monkeypatch):
    client, queries = setup_client(monkeypatch, {})
    client.app.dependency_overrides.pop(get_current_user)
    with client:
        response = client.get('/api/v1/possibilities')

    assert response.status_code == 401
    assert queries == []
