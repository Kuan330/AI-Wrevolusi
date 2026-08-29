import uuid

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.preparation import Preparation
from app.models.schedule import Schedule
from app.schemas.schedule import ScheduleCreate, ScheduleUpdate


class ScheduleService:
    @staticmethod
    async def list_schedules(db: AsyncSession, user_id: uuid.UUID) -> list[Schedule]:
        result = await db.execute(
            select(Schedule)
            .where(Schedule.user_id == user_id)
            .order_by(Schedule.planned_for.asc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def create_schedule(db: AsyncSession, user_id: uuid.UUID, payload: ScheduleCreate) -> Schedule:
        prep_result = await db.execute(select(Preparation).where(Preparation.id == payload.preparation_id))
        preparation = prep_result.scalar_one_or_none()
        if not preparation or preparation.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Preparation not found.')

        schedule = Schedule(user_id=user_id, **payload.model_dump())
        db.add(schedule)
        await db.commit()
        await db.refresh(schedule)
        return schedule

    @staticmethod
    async def update_schedule(
        db: AsyncSession,
        user_id: uuid.UUID,
        schedule_id: uuid.UUID,
        payload: ScheduleUpdate,
    ) -> Schedule:
        result = await db.execute(select(Schedule).where(Schedule.id == schedule_id))
        schedule = result.scalar_one_or_none()
        if not schedule:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Schedule not found.')
        if schedule.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Schedule access denied.')

        for key, value in payload.model_dump(exclude_none=True).items():
            setattr(schedule, key, value)

        await db.commit()
        await db.refresh(schedule)
        return schedule
