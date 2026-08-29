from __future__ import annotations

from fastapi import APIRouter

from ..db import fetch_all

router = APIRouter(tags=["wef"])


@router.get("/wef-skills")
def list_wef_skills() -> list:
    return fetch_all(
        """
        SELECT wef_skill_id, core_skill, wef_skill_group,
               future_trend_category, genai_substitution_capacity_category
        FROM public.ref_wef_skills
        ORDER BY wef_skill_id
        """
    )
