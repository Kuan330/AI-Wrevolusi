import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.task import TaskCreate, TaskRead, TaskUpdate
from app.services.auth import get_current_user
from app.services.tasks import TaskService

router = APIRouter(prefix='/tasks', tags=['Tasks'])


@router.get('', response_model=list[TaskRead])
async def list_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TaskRead]:
    tasks = await TaskService.list_tasks(db, current_user.id)
    return [TaskRead.model_validate(item) for item in tasks]


@router.post('', response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskRead:
    task = await TaskService.create_task(db, current_user.id, payload)
    return TaskRead.model_validate(task)


@router.patch('/{task_id}', response_model=TaskRead)
async def update_task(
    task_id: uuid.UUID,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskRead:
    task = await TaskService.update_task(db, current_user.id, task_id, payload)
    return TaskRead.model_validate(task)


@router.delete('/{task_id}', status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    await TaskService.delete_task(db, current_user.id, task_id)
