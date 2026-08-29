from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.occupation import OccupationCreate, OccupationRead
from app.services.occupations import OccupationService

router = APIRouter(prefix='/occupations', tags=['Occupations'])


@router.get('', response_model=list[OccupationRead])
async def list_occupations(
    q: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[OccupationRead]:
    if q:
        occupations = await OccupationService.search_occupations(db, q)
    else:
        occupations = await OccupationService.list_occupations(db)
    return [OccupationRead.model_validate(item) for item in occupations]


@router.post('', response_model=OccupationRead, status_code=status.HTTP_201_CREATED)
async def create_occupation(
    payload: OccupationCreate,
    db: AsyncSession = Depends(get_db),
) -> OccupationRead:
    occupation = await OccupationService.create_occupation(db, payload)
    return OccupationRead.model_validate(occupation)
