import uuid

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.occupation import Occupation
from app.schemas.occupation import OccupationCreate


class OccupationRepository:
    @staticmethod
    async def list_all(db: AsyncSession) -> list[Occupation]:
        result = await db.execute(select(Occupation).order_by(Occupation.title.asc()))
        return list(result.scalars().all())

    @staticmethod
    async def search(db: AsyncSession, keyword: str) -> list[Occupation]:
        result = await db.execute(
            select(Occupation).where(
                or_(
                    Occupation.title.ilike(f'%{keyword}%'),
                    Occupation.industry.ilike(f'%{keyword}%'),
                    Occupation.masco_code.ilike(f'%{keyword}%'),
                )
            )
        )
        return list(result.scalars().all())

    @staticmethod
    async def get_by_id(db: AsyncSession, occupation_id: uuid.UUID) -> Occupation | None:
        result = await db.execute(select(Occupation).where(Occupation.id == occupation_id))
        return result.scalar_one_or_none()

    @staticmethod
    async def create(db: AsyncSession, payload: OccupationCreate) -> Occupation:
        occupation = Occupation(**payload.model_dump())
        db.add(occupation)
        await db.commit()
        await db.refresh(occupation)
        return occupation
