"""Offline checks that one task operation has one commit owner."""

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest

from app.constants.exposure_types import ExposureType
from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.tasks import TaskService
import app.services.tasks as tasks


def session(task=None):
    return SimpleNamespace(
        add=Mock(), delete=AsyncMock(), commit=AsyncMock(), refresh=AsyncMock(),
        execute=AsyncMock(return_value=Mock(scalar_one_or_none=Mock(return_value=task))),
    )


def test_create_commits_task_and_derived_exposure_together(monkeypatch):
    db = session()
    monkeypatch.setattr(tasks, 'infer_exposure_state', lambda title: (ExposureType.insufficient_data, None, None))
    seen = []
    async def commit():
        task = db.add.call_args.args[0]
        seen.append((task.title, task.exposure_type))
    db.commit.side_effect = commit
    created = asyncio.run(TaskService.create_task(db, uuid4(), TaskCreate(title='Review work')))
    assert seen == [('Review work', ExposureType.insufficient_data)]
    assert created is db.add.call_args.args[0]
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(created)


def test_inference_failure_cannot_leave_a_committed_task(monkeypatch):
    db = session()
    def fail(title):
        raise RuntimeError('inference failed')
    monkeypatch.setattr(tasks, 'infer_exposure_state', fail)
    with pytest.raises(RuntimeError, match='inference failed'):
        asyncio.run(TaskService.create_task(db, uuid4(), TaskCreate(title='Review work')))
    db.commit.assert_not_awaited()
    db.refresh.assert_not_awaited()


@pytest.mark.parametrize('payload', [TaskUpdate(title='New title'), TaskUpdate(description='New description')])
def test_update_has_one_commit_including_without_title(monkeypatch, payload):
    user = uuid4()
    task = Task(id=uuid4(), user_id=user, title='Old title')
    db = session(task)
    monkeypatch.setattr(tasks, 'infer_exposure_state', lambda title: (ExposureType.insufficient_data, None, None))
    assert asyncio.run(TaskService.update_task(db, user, task.id, payload)) is task
    db.commit.assert_awaited_once()
    db.refresh.assert_awaited_once_with(task)


def test_update_inference_failure_does_not_commit_changed_title(monkeypatch):
    user = uuid4()
    task = Task(id=uuid4(), user_id=user, title='Old title')
    db = session(task)
    def fail(title):
        raise RuntimeError('inference failed')
    monkeypatch.setattr(tasks, 'infer_exposure_state', fail)
    with pytest.raises(RuntimeError):
        asyncio.run(TaskService.update_task(db, user, task.id, TaskUpdate(title='New title')))
    db.commit.assert_not_awaited()


def test_delete_is_committed_by_service():
    user = uuid4()
    task = Task(id=uuid4(), user_id=user, title='Old title')
    db = session(task)
    asyncio.run(TaskService.delete_task(db, user, task.id))
    db.delete.assert_awaited_once_with(task)
    db.commit.assert_awaited_once()
