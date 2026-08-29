import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.schedule import ScheduleCreate, ScheduleRead, ScheduleUpdate
from app.services.auth import get_current_user
from app.services.schedule import ScheduleService

router = APIRouter(prefix='/schedule', tags=['Schedule'])


@router.get('', response_model=list[ScheduleRead])
async def list_schedule(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ScheduleRead]:
    schedules = await ScheduleService.list_schedules(db, current_user.id)
    return [ScheduleRead.model_validate(item) for item in schedules]


@router.post('', response_model=ScheduleRead, status_code=status.HTTP_201_CREATED)
async def create_schedule(
    payload: ScheduleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScheduleRead:
    schedule = await ScheduleService.create_schedule(db, current_user.id, payload)
    return ScheduleRead.model_validate(schedule)


@router.patch('/{schedule_id}', response_model=ScheduleRead)
async def update_schedule(
    schedule_id: uuid.UUID,
    payload: ScheduleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ScheduleRead:
    schedule = await ScheduleService.update_schedule(db, current_user.id, schedule_id, payload)
    return ScheduleRead.model_validate(schedule)
