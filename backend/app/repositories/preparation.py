import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.preparation import Preparation
from app.schemas.preparation import PreparationCreate, PreparationUpdate


class PreparationRepository:
    @staticmethod
    async def list_by_user(db: AsyncSession, user_id: uuid.UUID) -> list[Preparation]:
        result = await db.execute(
            select(Preparation)
            .where(Preparation.user_id == user_id)
            .order_by(Preparation.priority.asc(), Preparation.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, preparation_id: uuid.UUID) -> Preparation | None:
        result = await db.execute(select(Preparation).where(Preparation.id == preparation_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create(db: AsyncSession, user_id: uuid.UUID, payload: PreparationCreate) -> Preparation:
        preparation = Preparation(user_id=user_id, **payload.model_dump())
        db.add(preparation)
        await db.commit()
        await db.refresh(preparation)
        return preparation

    @staticmethod
    async def update(
        db: AsyncSession,
        preparation: Preparation,
        payload: PreparationUpdate,
    ) -> Preparation:
        update_data = payload.model_dump(exclude_none=True)
        for key, value in update_data.items():
            setattr(preparation, key, value)
        await db.commit()
        await db.refresh(preparation)
        return preparation
