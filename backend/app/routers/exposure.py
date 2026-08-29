import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.repositories.tasks import TaskRepository
from app.schemas.exposure import ExposureResult
from app.services.exposure import infer_exposure_state

router = APIRouter(prefix='/exposure', tags=['Exposure'])


@router.get('/tasks/{task_id}', response_model=ExposureResult)
async def task_exposure(task_id: uuid.UUID, db: AsyncSession = Depends(get_db)) -> ExposureResult:
    task = await TaskRepository.get_by_id(db, task_id)
    if not task:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='Task not found.')

    exposure_type, confidence, reason = infer_exposure_state(task.title)
    return ExposureResult(task_id=task.id, exposure_type=exposure_type, confidence=confidence, reason=reason)
