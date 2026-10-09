"""Target role requirements share the direction cards' verified WEF mapping."""
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest

from app.main import create_app
from app.db.session import get_db
from app.routers import possibilities as route
from app.services.auth import get_current_user

SKILLS = {1: {'core_skill': 'Analytical thinking'}, 2: {'core_skill': 'Leadership'}}
ROLE = {'occupation_code': '2421', 'title': 'Management and Organization Analysts', 'tasks': ['Analyse organisation processes']}

@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(route, '_load_reference_data', AsyncMock(return_value=(SKILLS, [ROLE], {})))
    monkeypatch.setattr(route, 'occupation_required_skills', lambda *args, **kwargs: {2, 1})
    app = create_app('/api')
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=uuid4())
    async def database():
        yield SimpleNamespace()
    app.dependency_overrides[get_db] = database
    return TestClient(app)


def test_requirements_equal_card_skills_without_ownership_states(client):
    response = client.get('/api/v1/possibilities/2421/requirements')
    assert response.status_code == 200
    payload = response.json()
    assert payload['occupation_code'] == '2421'
    assert payload['title'] == ROLE['title']
    expected = route.build_direction_payload({**ROLE, 'required_skill_ids': [1, 2]}, SKILLS)
    assert payload['skills'] == [{key: skill[key] for key in ('skill_id', 'skill_slug', 'name')} for skill in expected['skills']]
    assert all('state' not in skill for skill in payload['skills'])


def test_queries_role_by_code_without_ranking(monkeypatch, client):
    def forbid_ranking(*args, **kwargs):
        raise AssertionError('Requirements must not depend on top three recommendations')
    monkeypatch.setattr(route, 'recommend_occupations', forbid_ranking)
    assert client.get('/api/v1/possibilities/2421/requirements').status_code == 200


def test_unknown_role_returns_actionable_404(client):
    response = client.get('/api/v1/possibilities/unknown/requirements')
    assert response.status_code == 404
    assert 'Choose another career direction' in response.json()['detail']


def test_empty_skill_map_is_not_fabricated(monkeypatch, client):
    monkeypatch.setattr(route, 'occupation_required_skills', lambda *args, **kwargs: set())
    response = client.get('/api/v1/possibilities/2421/requirements')
    assert response.status_code == 200
    assert response.json()['skills'] == []


def test_database_failure_is_safe_503(monkeypatch, client):
    monkeypatch.setattr(route, '_load_reference_data', AsyncMock(side_effect=RuntimeError('private database secret')))
    response = client.get('/api/v1/possibilities/2421/requirements')
    assert response.status_code == 503
    assert 'private database secret' not in response.text


def test_requires_login():
    with TestClient(create_app('/api')) as unauthenticated:
        assert unauthenticated.get('/api/v1/possibilities/2421/requirements').status_code == 401
