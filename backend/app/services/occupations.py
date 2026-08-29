from sqlalchemy.ext.asyncio import AsyncSession

from app.models.occupation import Occupation
from app.repositories.occupations import OccupationRepository
from app.schemas.occupation import OccupationCreate


class OccupationService:
    @staticmethod
    async def list_occupations(db: AsyncSession) -> list[Occupation]:
        return await OccupationRepository.list_all(db)

    @staticmethod
    async def search_occupations(db: AsyncSession, keyword: str) -> list[Occupation]:
        return await OccupationRepository.search(db, keyword)

    @staticmethod
    async def create_occupation(db: AsyncSession, payload: OccupationCreate) -> Occupation:
        return await OccupationRepository.create(db, payload)
