from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.services.ai_gateway import AIGateway, default_ai_gateway
from app.services.occupation_search import (
    normalise_search_query,
    search_occupation_rows,
)

router = APIRouter(prefix='/reference', tags=['Reference Data'])

OCCUPATION_COLUMNS = 'occupation_code, level, parent_code, title, description'


def get_reference_ai_gateway() -> AIGateway:
    """Dependency seam for the optional search-keyword normaliser."""

    return default_ai_gateway()


@router.get('/occupations')
async def list_reference_occupations(
    parent: str | None = Query(default=None),
    q: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    gateway: AIGateway = Depends(get_reference_ai_gateway),
) -> list[dict]:
    if q and q.strip():
        needle = q.strip()
        result = await db.execute(
            text(
                f'SELECT {OCCUPATION_COLUMNS} FROM ref_occupations '
                'WHERE (title ILIKE :query OR description ILIKE :query OR occupation_code ILIKE :query) '
                "AND level = 'unit' "
                'ORDER BY occupation_code'
            ),
            {'query': f'%{needle}%'},
        )
        direct_rows = [dict(row) for row in result.mappings().all()]
        # Token-level fuzzy recall over the full unit list complements the
        # substring hits above.  The occupation table is small enough to score
        # in-process (see tests/test_reference_fuzzy.py for the budget check).
        unit_result = await db.execute(
            text(
                f'SELECT {OCCUPATION_COLUMNS} FROM ref_occupations '
                "WHERE level = 'unit' ORDER BY occupation_code"
            )
        )
        unit_rows = [dict(row) for row in unit_result.mappings().all()]
        return search_occupation_rows(
            unit_rows,
            direct_rows,
            needle,
            keyword_normaliser=lambda query: normalise_search_query(query, gateway),
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
            'SELECT wef_skill_id, core_skill, wef_skill_group, core_skill_importance_2025_pct, '
            'future_trend_category, '
            'future_net_increase_2025_2030, genai_substitution_capacity_category '
            'FROM ref_wef_skills ORDER BY wef_skill_id'
        )
    )
    return [dict(row) for row in result.mappings().all()]
