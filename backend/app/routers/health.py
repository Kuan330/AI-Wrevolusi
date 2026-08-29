from __future__ import annotations

from fastapi import APIRouter

from ..db import fetch_all

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    rows = fetch_all("SELECT 1 AS ok")
    return {"ok": True, "database": bool(rows)}
