import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.preparation import PreparationCreate, PreparationRead, PreparationUpdate
from app.services.auth import get_current_user
from app.services.preparation import PreparationService

router = APIRouter(prefix='/preparation', tags=['Preparation'])


@router.get('', response_model=list[PreparationRead])
async def list_preparation(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[PreparationRead]:
    preparations = await PreparationService.list_preparations(db, current_user.id)
    return [PreparationRead.model_validate(item) for item in preparations]


@router.post('', response_model=PreparationRead, status_code=status.HTTP_201_CREATED)
async def create_preparation(
    payload: PreparationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PreparationRead:
    preparation = await PreparationService.create_preparation(db, current_user.id, payload)
    return PreparationRead.model_validate(preparation)


@router.patch('/{preparation_id}', response_model=PreparationRead)
async def update_preparation(
    preparation_id: uuid.UUID,
    payload: PreparationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> PreparationRead:
    preparation = await PreparationService.update_preparation(db, current_user.id, preparation_id, payload)
    return PreparationRead.model_validate(preparation)
