from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.capability import (
    CapabilityRead,
    ConfirmedTaskCapabilityRecognitionBatchRequest,
    ConfirmedTaskCapabilityRecognitionBatchResponse,
)
from app.services.auth import get_current_user
from app.services.capabilities import CapabilityService
from app.services.capabilities import recognize_capabilities_from_confirmed_tasks

router = APIRouter(prefix='/capabilities', tags=['Capabilities'])


@router.post(
    '/recognize',
    response_model=ConfirmedTaskCapabilityRecognitionBatchResponse,
)
async def recognize_capabilities_for_confirmed_tasks(
    request: ConfirmedTaskCapabilityRecognitionBatchRequest,
    db: AsyncSession = Depends(get_db),
) -> ConfirmedTaskCapabilityRecognitionBatchResponse:
    return await recognize_capabilities_from_confirmed_tasks(db, request)


@router.get('', response_model=list[CapabilityRead])
async def list_capabilities(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CapabilityRead]:
    capabilities = await CapabilityService.list_capabilities(db, current_user.id)
    return [CapabilityRead.model_validate(item) for item in capabilities]


@router.post('/infer', response_model=list[CapabilityRead], status_code=status.HTTP_201_CREATED)
async def infer_capabilities(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[CapabilityRead]:
    capabilities = await CapabilityService.infer_from_tasks(db, current_user.id)
    return [CapabilityRead.model_validate(item) for item in capabilities]
