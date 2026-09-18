"""Occupation catalogue is readable but cannot be changed through public routes."""

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import create_app
from app.services.auth import get_current_user
from app.services.occupations import OccupationService


@pytest.mark.parametrize('signed_in', [False, True])
def test_occupation_creation_route_is_disabled(monkeypatch, signed_in):
    application = create_app('/api')
    if signed_in:
        application.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=uuid4())
    create = AsyncMock()
    monkeypatch.setattr(OccupationService, 'create_occupation', create)
    with TestClient(application) as client:
        response = client.post('/api/v1/occupations', json={'title': 'Injected'})
    assert response.status_code == 405
    create.assert_not_awaited()
    assert 'post' not in application.openapi()['paths']['/api/v1/occupations']


@pytest.mark.parametrize('query, method', [('', 'list_occupations'), ('?q=clerk', 'search_occupations')])
def test_occupation_list_and_search_remain_public(monkeypatch, query, method):
    application = create_app('/api')
    reader = AsyncMock(return_value=[])
    monkeypatch.setattr(OccupationService, method, reader)
    async def database():
        yield object()
    application.dependency_overrides[get_db] = database
    with TestClient(application) as client:
        response = client.get('/api/v1/occupations' + query)
    assert response.status_code == 200
    assert response.json() == []
    reader.assert_awaited_once()
