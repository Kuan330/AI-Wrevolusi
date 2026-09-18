"""Stored-task routes enforce account ownership and serialize current ORM rows."""

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

from app.constants.exposure_types import ExposureType
from app.constants.task_status import TaskStatus
from app.db.session import get_db
from app.main import create_app
from app.models.task import Task
from app.repositories.tasks import TaskRepository
from app.services.auth import get_current_user
from app.services.tasks import TaskService


def client_for(user_id=None):
    application = create_app('/api')
    if user_id:
        application.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=user_id)
    async def db():
        yield object()
    application.dependency_overrides[get_db] = db
    return TestClient(application)


def test_exposure_requires_authentication_before_loading_a_task(monkeypatch):
    read = AsyncMock()
    monkeypatch.setattr(TaskRepository, 'get_by_id', read)
    with client_for() as client:
        response = client.get(f'/api/v1/exposure/tasks/{uuid4()}')
    assert response.status_code == 401
    read.assert_not_awaited()


@pytest.mark.parametrize('case, expected', [('owner', 200), ('other', 403), ('missing', 404)])
def test_exposure_only_returns_the_owners_task(monkeypatch, case, expected):
    user = uuid4()
    task_id = uuid4()
    task = None if case == 'missing' else SimpleNamespace(
        id=task_id, user_id=user if case == 'owner' else uuid4(), title='Prepare reports',
    )
    monkeypatch.setattr(TaskRepository, 'get_by_id', AsyncMock(return_value=task))
    with client_for(user) as client:
        response = client.get(f'/api/v1/exposure/tasks/{task_id}')
    assert response.status_code == expected
    if case == 'owner':
        assert response.json()['task_id'] == str(task_id)
    else:
        assert 'exposure_type' not in response.json()


@pytest.mark.parametrize('operation', ['list', 'create', 'update'])
def test_task_endpoints_serialize_orm_without_a_profile_task_column(monkeypatch, operation):
    user = uuid4()
    task = Task(id=uuid4(), user_id=user, occupation_id=None, title='Prepare reports',
                description=None, status=TaskStatus.needs_review,
                exposure_type=ExposureType.insufficient_data, context=None)
    method = {'list': 'list_tasks', 'create': 'create_task', 'update': 'update_task'}[operation]
    monkeypatch.setattr(TaskService, method, AsyncMock(return_value=[task] if operation == 'list' else task))
    with client_for(user) as client:
        if operation == 'list':
            response = client.get('/api/v1/tasks')
        elif operation == 'create':
            response = client.post('/api/v1/tasks', json={'title': task.title})
        else:
            response = client.patch(f'/api/v1/tasks/{task.id}', json={'title': task.title})
    assert response.status_code == (201 if operation == 'create' else 200)
    payload = response.json()[0] if operation == 'list' else response.json()
    assert payload['profile_task_id'] is None
    assert payload['id'] == str(task.id)
    assert payload['user_id'] == str(user)
