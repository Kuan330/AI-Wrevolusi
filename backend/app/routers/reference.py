from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
import logging
import time
from threading import Lock

from app.core.config import settings
from app.db.session import get_db
from app.services.ai_gateway import AIGateway, default_ai_gateway
from app.services.occupation_search import (
    normalise_search_query,
    search_occupation_rows,
)

router = APIRouter(prefix='/reference', tags=['Reference Data'])
logger = logging.getLogger(__name__)

OCCUPATION_COLUMNS = 'occupation_code, level, parent_code, title, description'

# Unit occupations are stable reference data — cache once per process so every
# search keystroke does not re-scan the full table.
_unit_rows_cache: list[dict] | None = None
_unit_rows_lock = Lock()

# Short-lived result cache for identical search queries (typing + retries).
_SEARCH_RESULT_TTL_S = 60.0
_SEARCH_RESULT_MAX = 128
_search_result_cache: dict[tuple[str | None, str], tuple[float, list[dict]]] = {}
_search_result_lock = Lock()


def get_reference_ai_gateway() -> AIGateway:
    """Dependency seam for the optional search-keyword normaliser."""

    return default_ai_gateway()


def clear_occupation_search_caches() -> None:
    """Test helper — drop process caches between fixtures."""

    global _unit_rows_cache
    with _unit_rows_lock:
        _unit_rows_cache = None
    with _search_result_lock:
        _search_result_cache.clear()


async def _load_unit_occupations(db: AsyncSession) -> list[dict]:
    global _unit_rows_cache
    with _unit_rows_lock:
        if _unit_rows_cache is not None:
            return _unit_rows_cache

    unit_result = await db.execute(
        text(
            f'SELECT {OCCUPATION_COLUMNS} FROM ref_occupations '
            "WHERE level = 'unit' ORDER BY occupation_code"
        )
    )
    rows = [dict(row) for row in unit_result.mappings().all()]
    with _unit_rows_lock:
        _unit_rows_cache = rows
    return rows


def _cached_search_result(query: tuple[str | None, str]) -> list[dict] | None:
    now = time.monotonic()
    with _search_result_lock:
        entry = _search_result_cache.get(query)
        if entry is None:
            return None
        expires_at, rows = entry
        if expires_at < now:
            del _search_result_cache[query]
            return None
        return [dict(row) for row in rows]


def _store_search_result(query: tuple[str | None, str], rows: list[dict]) -> None:
    now = time.monotonic()
    with _search_result_lock:
        if len(_search_result_cache) >= _SEARCH_RESULT_MAX:
            # Drop expired entries first, then the oldest insert.
            stale = [key for key, (expires_at, _) in _search_result_cache.items() if expires_at < now]
            for key in stale:
                del _search_result_cache[key]
            while len(_search_result_cache) >= _SEARCH_RESULT_MAX:
                _search_result_cache.pop(next(iter(_search_result_cache)))
        _search_result_cache[query] = (
            now + _SEARCH_RESULT_TTL_S,
            [dict(row) for row in rows],
        )


def _timed_keyword_normaliser(query: str, gateway: AIGateway) -> list[str]:
    """Sync normaliser with a hard timeout — only invoked for unmatched scripts."""

    from concurrent.futures import ThreadPoolExecutor, TimeoutError as FuturesTimeout

    with ThreadPoolExecutor(max_workers=1) as pool:
        future = pool.submit(normalise_search_query, query, gateway)
        try:
            return list(future.result(timeout=settings.occupation_search_normaliser_timeout_s))
        except FuturesTimeout:
            logger.warning(
                'occupation_search_normaliser_timeout query=%r budget_s=%.1f',
                query,
                settings.occupation_search_normaliser_timeout_s,
            )
            return []
        except Exception:  # noqa: BLE001 - optional layer by design
            logger.exception('occupation_search_normaliser_failed query=%r', query)
            return []


@router.get('/occupations')
async def list_reference_occupations(
    parent: str | None = Query(default=None),
    q: str | None = Query(default=None),
    area: str | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    gateway: AIGateway = Depends(get_reference_ai_gateway),
) -> list[dict]:
    area_rows = None
    if area is not None:
        area = area.strip()
        major = await db.execute(
            text("SELECT occupation_code FROM ref_occupations WHERE occupation_code = :area AND level = 'major'"),
            {'area': area},
        )
        if major.scalar_one_or_none() is None:
            raise HTTPException(status_code=422, detail='Choose a valid work area.')
        # Codes need not share prefixes. Follow the stored parent relationships.
        result = await db.execute(
            text(
                'WITH RECURSIVE descendants AS ('
                f'SELECT {OCCUPATION_COLUMNS} FROM ref_occupations WHERE occupation_code = :area '
                'UNION '
                'SELECT child.occupation_code, child.level, child.parent_code, child.title, child.description '
                'FROM ref_occupations child JOIN descendants parent ON child.parent_code = parent.occupation_code'
                ') '
                f"SELECT {OCCUPATION_COLUMNS} FROM descendants WHERE level = 'unit' ORDER BY title, occupation_code"
            ),
            {'area': area},
        )
        area_rows = [dict(row) for row in result.mappings().all()]
        if not q or not q.strip():
            return area_rows

    if q and q.strip():
        needle = q.strip()
        cache_key = (area, needle.casefold())
        cached = _cached_search_result(cache_key)
        if cached is not None:
            return cached

        if area_rows is not None:
            unit_rows = area_rows
            direct_rows = [
                row for row in area_rows
                if any(needle.casefold() in str(row.get(field) or '').casefold()
                       for field in ('title', 'description', 'occupation_code'))
            ]
        else:
            result = await db.execute(
                text(
                    f'SELECT {OCCUPATION_COLUMNS} FROM ref_occupations '
                    'WHERE (title ILIKE :query OR description ILIKE :query OR occupation_code ILIKE :query) '
                    "AND level = 'unit' ORDER BY occupation_code"
                ),
                {'query': f'%{needle}%'},
            )
            direct_rows = [dict(row) for row in result.mappings().all()]
            unit_rows = await _load_unit_occupations(db)

        # Fuzzy scoring is CPU-bound; keep the async event loop free.
        rows = await asyncio.to_thread(
            search_occupation_rows,
            unit_rows,
            direct_rows,
            needle,
            keyword_normaliser=lambda query: _timed_keyword_normaliser(query, gateway),
        )
        _store_search_result(cache_key, rows)
        return rows
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
