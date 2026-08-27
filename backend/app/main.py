from __future__ import annotations

from typing import Optional

import psycopg
from fastapi import FastAPI, HTTPException, Query
from psycopg.rows import dict_row

from .db import database_url

app = FastAPI(title="AI-Wrevolusi API", version="0.1.0")

OCC_COLS = "occupation_code, level, parent_code, title, description"


def fetch_all(sql: str, params: tuple = ()) -> list[dict]:
    with psycopg.connect(database_url()) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)
            return list(cur.fetchall())


@app.get("/health")
def health() -> dict:
    rows = fetch_all("SELECT 1 AS ok")
    return {"ok": True, "database": bool(rows)}


@app.get("/occupations")
def list_occupations(parent: Optional[str] = Query(default=None)) -> list:
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


@app.get("/occupations/{code}")
def get_occupation(code: str) -> dict:
    rows = fetch_all(
        f"SELECT {OCC_COLS} FROM public.ref_occupations WHERE occupation_code = %s",
        (code,),
    )
    if not rows:
        raise HTTPException(status_code=404, detail="occupation not found")
    return rows[0]


@app.get("/occupations/{code}/tasks")
def list_tasks(code: str) -> list[dict]:
    occ = fetch_all(
        "SELECT occupation_code, level FROM public.ref_occupations WHERE occupation_code = %s",
        (code,),
    )
    if not occ:
        raise HTTPException(status_code=404, detail="occupation not found")
    if occ[0]["level"] != "unit":
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
