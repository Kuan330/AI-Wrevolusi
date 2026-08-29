import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.repositories.tasks import TaskRepository
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.exposure import infer_exposure_state


class TaskService:
    @staticmethod
    async def list_tasks(db: AsyncSession, user_id: uuid.UUID) -> list[Task]:
        return await TaskRepository.list_by_user(db, user_id)

    @staticmethod
    async def create_task(db: AsyncSession, user_id: uuid.UUID, payload: TaskCreate) -> Task:
        task = await TaskRepository.create(db, user_id, payload)
        exposure, _, _ = infer_exposure_state(task.title)
        task.exposure_type = exposure
        await db.commit()
        await db.refresh(task)
        return task

    @staticmethod
    async def update_task(
        db: AsyncSession,
        user_id: uuid.UUID,
        task_id: uuid.UUID,
        payload: TaskUpdate,
    ) -> Task:
        task = await TaskRepository.get_by_id(db, task_id)
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Task not found.')
        if task.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Task access denied.')

        updated = await TaskRepository.update(db, task, payload)
        if payload.title:
            exposure, _, _ = infer_exposure_state(payload.title)
            updated.exposure_type = exposure
            await db.commit()
            await db.refresh(updated)
        return updated

    @staticmethod
    async def delete_task(db: AsyncSession, user_id: uuid.UUID, task_id: uuid.UUID) -> None:
        task = await TaskRepository.get_by_id(db, task_id)
        if not task:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Task not found.')
        if task.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Task access denied.')
        await TaskRepository.delete(db, task)
