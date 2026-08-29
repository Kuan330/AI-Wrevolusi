import uuid

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.preparation import Preparation
from app.repositories.preparation import PreparationRepository
from app.schemas.preparation import PreparationCreate, PreparationUpdate


class PreparationService:
    @staticmethod
    async def list_preparations(db: AsyncSession, user_id: uuid.UUID) -> list[Preparation]:
        return await PreparationRepository.list_by_user(db, user_id)

    @staticmethod
    async def create_preparation(
        db: AsyncSession,
        user_id: uuid.UUID,
        payload: PreparationCreate,
    ) -> Preparation:
        return await PreparationRepository.create(db, user_id, payload)

    @staticmethod
    async def update_preparation(
        db: AsyncSession,
        user_id: uuid.UUID,
        preparation_id: uuid.UUID,
        payload: PreparationUpdate,
    ) -> Preparation:
        preparation = await PreparationRepository.get_by_id(db, preparation_id)
        if not preparation:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Preparation not found.')
        if preparation.user_id != user_id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Preparation access denied.')
        return await PreparationRepository.update(db, preparation, payload)
