import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate


class TaskRepository:
    @staticmethod
    async def list_by_user(db: AsyncSession, user_id: uuid.UUID) -> list[Task]:
        result = await db.execute(select(Task).where(Task.user_id == user_id).order_by(Task.created_at.desc()))
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, task_id: uuid.UUID) -> Task | None:
        result = await db.execute(select(Task).where(Task.id == task_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create(db: AsyncSession, user_id: uuid.UUID, payload: TaskCreate) -> Task:
        task = Task(user_id=user_id, **payload.model_dump())
        db.add(task)
        await db.commit()
        await db.refresh(task)
        return task

    @staticmethod
    async def update(db: AsyncSession, task: Task, payload: TaskUpdate) -> Task:
        update_data = payload.model_dump(exclude_none=True)
        for key, value in update_data.items():
            setattr(task, key, value)
        await db.commit()
        await db.refresh(task)
        return task

    @staticmethod
    async def delete(db: AsyncSession, task: Task) -> None:
        await db.delete(task)
        await db.commit()
