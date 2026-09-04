from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db

router = APIRouter(prefix='/reference', tags=['Reference Data'])

OCCUPATION_COLUMNS = 'occupation_code, level, parent_code, title, description'

REFERENCE_DATA_VERSION_QUERY = '''
SELECT md5(
    COALESCE(
        (SELECT jsonb_agg(to_jsonb(occupation) ORDER BY occupation.occupation_code)::text
         FROM ref_occupations AS occupation),
        '[]'
    ) || '|' ||
    COALESCE(
        (SELECT jsonb_agg(to_jsonb(task) ORDER BY task.isco_08, task.task_id)::text
         FROM ref_ilo_tasks AS task),
        '[]'
    ) || '|' ||
    COALESCE(
        (SELECT jsonb_agg(to_jsonb(skill) ORDER BY skill.wef_skill_id)::text
         FROM ref_wef_skills AS skill),
        '[]'
    )
) AS version
'''


@router.get('/version')
async def get_reference_data_version(db: AsyncSession = Depends(get_db)) -> dict[str, str]:
    # ponytail: hash the small reference catalog on profile load; replace this
    # with a stored version row if catalog size makes the query measurably slow.
    result = await db.execute(text(REFERENCE_DATA_VERSION_QUERY))
    return {'version': str(result.scalar_one())}


@router.get('/occupations')
async def list_reference_occupations(
    parent: str | None = Query(default=None),
    q: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    if q and q.strip():
        result = await db.execute(
            text(
                f'SELECT {OCCUPATION_COLUMNS} FROM ref_occupations '
                'WHERE (title ILIKE :query OR description ILIKE :query) '
                "AND level = 'unit' "
                'ORDER BY occupation_code'
            ),
            {'query': f'%{q.strip()}%'},
        )
    elif parent:
        result = await db.execute(
            text(
                f'SELECT {OCCUPATION_COLUMNS} FROM ref_occupations '
                'WHERE parent_code = :parent ORDER BY occupation_code'
            ),
            {'parent': parent},
        )
    else:
        result = await db.execute(
            text(
                f'SELECT {OCCUPATION_COLUMNS} FROM ref_occupations '
                "WHERE level = 'major' ORDER BY occupation_code"
            )
        )
    return [dict(row) for row in result.mappings().all()]


@router.get('/occupations/{code}')
async def get_reference_occupation(code: str, db: AsyncSession = Depends(get_db)) -> dict:
    result = await db.execute(
        text(
            f'SELECT {OCCUPATION_COLUMNS} FROM ref_occupations '
            'WHERE occupation_code = :code'
        ),
        {'code': code},
    )
    row = result.mappings().one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail='occupation not found')
    return dict(row)


@router.get('/occupations/{code}/tasks')
async def list_reference_tasks(code: str, db: AsyncSession = Depends(get_db)) -> list[dict]:
    result = await db.execute(
        text(
            'SELECT isco_08, task_id, task_text, score_2025, potential25, mean_score_2025 '
            'FROM ref_ilo_tasks WHERE isco_08 = :code ORDER BY task_id'
        ),
        {'code': code},
    )
    return [dict(row) for row in result.mappings().all()]


@router.get('/wef-skills')
async def list_reference_wef_skills(db: AsyncSession = Depends(get_db)) -> list[dict]:
    result = await db.execute(
        text(
            'SELECT wef_skill_id, core_skill, wef_skill_group, future_trend_category, '
            'future_net_increase_2025_2030, genai_substitution_capacity_category '
            'FROM ref_wef_skills ORDER BY wef_skill_id'
        )
    )
    return [dict(row) for row in result.mappings().all()]
