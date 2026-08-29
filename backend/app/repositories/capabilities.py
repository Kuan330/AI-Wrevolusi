import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.capability import Capability


class CapabilityRepository:
    @staticmethod
    async def list_by_user(db: AsyncSession, user_id: uuid.UUID) -> list[Capability]:
        result = await db.execute(
            select(Capability)
            .where(Capability.user_id == user_id)
            .order_by(Capability.created_at.desc())
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, capability_id: uuid.UUID) -> Capability | None:
        result = await db.execute(select(Capability).where(Capability.id == capability_id))
        return result.scalar_one_or_none()
