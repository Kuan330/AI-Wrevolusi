from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.capability import CapabilityRead
from app.services.auth import get_current_user
from app.services.capabilities import CapabilityService

router = APIRouter(prefix='/capabilities', tags=['Capabilities'])


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
