from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from ..db import fetch_all, fetch_one

router = APIRouter(tags=["occupations"])

OCC_COLS = "occupation_code, level, parent_code, title, description"


@router.get("/occupations")
def list_occupations(
    parent: Optional[str] = Query(default=None),
    q: Optional[str] = Query(default=None),
) -> list:
    if q and q.strip():
        like = f"%{q.strip()}%"
        return fetch_all(
            f"""
            SELECT {OCC_COLS}
            FROM public.ref_occupations
            WHERE title ILIKE %s OR description ILIKE %s
            ORDER BY occupation_code
            """,
            (like, like),
        )
    if parent is None or parent == "":
        return fetch_all(
            f"SELECT {OCC_COLS} FROM public.ref_occupations "
            "WHERE level = %s ORDER BY occupation_code",
            ("major",),
        )
    return fetch_all(
        f"SELECT {OCC_COLS} FROM public.ref_occupations "
        "WHERE parent_code = %s ORDER BY occupation_code",
        (parent,),
    )


@router.get("/occupations/{code}")
def get_occupation(code: str) -> dict:
    row = fetch_one(
        f"SELECT {OCC_COLS} FROM public.ref_occupations WHERE occupation_code = %s",
        (code,),
    )
    if not row:
        raise HTTPException(status_code=404, detail="occupation not found")
    return row


@router.get("/occupations/{code}/exposure")
def get_exposure(code: str) -> dict:
    """Occupation-level ILO 2025 mean and potential25 (not a task-band mapping)."""
    occ = fetch_one(
        f"SELECT {OCC_COLS} FROM public.ref_occupations WHERE occupation_code = %s",
        (code,),
    )
    if not occ:
        raise HTTPException(status_code=404, detail="occupation not found")
    if occ["level"] != "unit":
        raise HTTPException(status_code=400, detail="exposure is only defined for a 4-digit unit")
    row = fetch_one(
        """
        SELECT mean_score_2025, potential25, COUNT(*)::int AS task_count
        FROM public.ref_ilo_tasks
        WHERE isco_08 = %s
        GROUP BY mean_score_2025, potential25
        """,
        (code,),
    )
    return {
        "occupation_code": occ["occupation_code"],
        "title": occ["title"],
        "mean_score_2025": row["mean_score_2025"] if row else None,
        "potential25": row["potential25"] if row else None,
        "task_count": row["task_count"] if row else 0,
        "source": "ILO / Gmyrek et al. 2025",
    }


@router.get("/occupations/{code}/tasks")
def list_tasks(code: str) -> list[dict]:
    occ = fetch_one(
        "SELECT occupation_code, level FROM public.ref_occupations WHERE occupation_code = %s",
        (code,),
    )
    if not occ:
        raise HTTPException(status_code=404, detail="occupation not found")
    if occ["level"] != "unit":
        return []
    return fetch_all(
        """
        SELECT isco_08, task_id, task_text, score_2025, potential25, mean_score_2025
        FROM public.ref_ilo_tasks
        WHERE isco_08 = %s
        ORDER BY task_id
        """,
        (code,),
    )
