import asyncio
import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.services.auth import get_current_user
from app.services.possibilities import (
    chosen_direction_score,
    confirmed_workspace_evidence,
    occupation_required_skills,
    recommend_occupations,
    skill_overlap_score,
)
from app.schemas.possibilities import PossibilitiesResponse
from app.services.workspace import SHORTLIST_KEY, read_workspace_shortlist

logger = logging.getLogger(__name__)
router = APIRouter(prefix='/possibilities', tags=['Possibilities'])
DISCLAIMER = 'Exploratory skill connections only; not job readiness or hiring probability.'

# Reference data is stable per process — avoid re-joining ~2.5k ILO tasks every request.
_skills_cache: dict[int, dict] | None = None
_occupation_rows_cache: list[dict] | None = None


def _json_value(workspace: dict, key: str, default):
    try:
        value = json.loads(workspace.get(key, 'null'))
        return default if value is None else value
    except (TypeError, ValueError):
        return default


def build_direction_payload(row: dict, skills: dict) -> dict:
    from app.services.possibilities import slugify_skill_name

    return {
        'occupation_code': row['occupation_code'],
        'title': row['title'],
        'area': row.get('industry'),
        'description': row.get('description') or '',
        'coverage_pct': row.get('coverage_pct'),
        'skills': [
            {
                'skill_id': skill_id,
                'skill_slug': slugify_skill_name(str(skills[skill_id]['core_skill'])),
                'name': skills[skill_id]['core_skill'],
                'state': row.get('skill_states', {}).get(skill_id, 'missing'),
            }
            for skill_id in row.get('required_skill_ids', [])
        ],
    }


async def _load_reference_data(db: AsyncSession) -> tuple[dict[int, dict], list[dict]]:
    global _skills_cache, _occupation_rows_cache
    if _skills_cache is not None and _occupation_rows_cache is not None:
        return _skills_cache, _occupation_rows_cache

    skill_rows = (await db.execute(text(
        'SELECT wef_skill_id, core_skill, wef_skill_group FROM ref_wef_skills ORDER BY wef_skill_id'
    ))).mappings().all()
    skills = {int(row['wef_skill_id']): dict(row) for row in skill_rows}

    # Unit occupations only — major/minor tree nodes have no ILO tasks and inflate matching.
    occupation_rows = (await db.execute(text(
        "SELECT o.occupation_code, o.title, o.description, NULL AS industry, "
        "COALESCE(array_agg(i.task_text ORDER BY i.task_id) FILTER (WHERE i.task_text IS NOT NULL), '{}') AS tasks "
        "FROM ref_occupations o LEFT JOIN ref_ilo_tasks i ON i.isco_08=o.occupation_code "
        "WHERE o.level = 'unit' "
        "GROUP BY o.occupation_code,o.title,o.description ORDER BY o.occupation_code"
    ))).mappings().all()
    occupations = [dict(row) for row in occupation_rows]

    _skills_cache = skills
    _occupation_rows_cache = occupations
    return skills, occupations


@router.get('', response_model=PossibilitiesResponse)
async def get_possibilities(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> PossibilitiesResponse:
    try:
        skills, occupation_rows = await _load_reference_data(db)
        confirmed_rows = (await db.execute(text(
            "SELECT title, description FROM tasks WHERE user_id=:user_id AND status='confirmed' ORDER BY created_at"
        ), {'user_id': current_user.id})).mappings().all()
    except Exception as e:
        logger.error(f"Error loading reference data or tasks for user {current_user.id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to load user data")
    from app.schemas.skill_matching import SkillMatchCandidate
    from app.services.skill_matching import match_skills
    candidates = [SkillMatchCandidate(id=i, skill=str(row['core_skill'])) for i, row in skills.items()]

    try:
        workspace = (await db.execute(text('SELECT workspace FROM app_accounts WHERE user_id=:id'), {'id': current_user.id})).scalar_one_or_none() or {}
        workspace = workspace if isinstance(workspace, dict) else {}
        confirmed_texts, workspace_role = confirmed_workspace_evidence(workspace, occupation_rows)
    except Exception as e:
        logger.error(f"Error loading workspace for user {current_user.id}: {str(e)}")
        workspace = {}
        confirmed_texts, workspace_role = [], None
    task_texts = set(confirmed_texts)
    task_texts.update(f"{task['title']} {task['description'] or ''}".strip() for task in confirmed_rows)
    owned = {
        item.wef_skill_id
        for task_text in task_texts
        for item in match_skills(task_text, candidates, limit=None)
    }
    has_confirmed_tasks = bool(confirmed_rows or confirmed_texts)
    shortlist_raw = _json_value(workspace, SHORTLIST_KEY, [])
    shortlist = read_workspace_shortlist(shortlist_raw, allowed_skill_ids=set(skills))
    chosen_raw = _json_value(workspace, 'aiwrevolusi.possibilities.chosenDirection', {})
    chosen_code = chosen_raw.get('occupation_code') if isinstance(chosen_raw, dict) else None
    role = workspace_role
    if role is None and current_user.occupation_id:
        try:
            role_row = (await db.execute(text('SELECT masco_code, title FROM occupations WHERE id=:id'), {'id': current_user.occupation_id})).mappings().one_or_none()
            if role_row:
                role = {'occupation_code': role_row['masco_code'], 'title': role_row['title']}
            else:
                logger.warning(f"No occupation found for user {current_user.id} with occupation_id {current_user.occupation_id}")
        except Exception as e:
            logger.error(f"Error loading occupation for user {current_user.id}: {str(e)}")
            # Continue without role - don't fail the entire request

    exclude_codes = {role['occupation_code']} if role and role.get('occupation_code') else set()
    # CPU-heavy ranking — keep the async event loop free on cold cache fills.
    try:
        recommendations = await asyncio.to_thread(
            recommend_occupations, occupation_rows, owned, skills, 3, exclude_codes=exclude_codes
        )
    except Exception as e:
        logger.error(f"Error generating recommendations for user {current_user.id}: {str(e)}")
        recommendations = []
    allowed_codes = {row['occupation_code'] for row in recommendations}
    if chosen_code not in allowed_codes:
        chosen_code = None
    from app.services.possibilities import slugify_skill_name
    skill_items = [{'skill_id': i, 'skill_slug': slugify_skill_name(str(row['core_skill'])), 'name': row['core_skill'], 'state': 'have' if i in owned else ('shortlisted' if i in shortlist else 'missing')} for i, row in skills.items()]
    for row in recommendations:
        row['skill_states'] = {
            skill_id: 'have' if skill_id in owned else ('shortlisted' if skill_id in shortlist else 'missing')
            for skill_id in row['required_skill_ids']
        }
    directions = [build_direction_payload(row, skills) for row in recommendations]
    chosen_score = next((chosen_direction_score(owned, set(shortlist), set(row['required_skill_ids'])) for row in recommendations if row['occupation_code'] == chosen_code), None)
    current_role_coverage_pct = None
    if role:
        current_ref = next(
            (row for row in occupation_rows if row['occupation_code'] == role['occupation_code']),
            None,
        )
        if current_ref is not None:
            required = occupation_required_skills(
                current_ref.get('tasks') or [], skills, occupation=current_ref
            )
            if required:
                current_role_coverage_pct = round(len(owned & required) * 100 / len(required))
    return PossibilitiesResponse(
        disclaimer=DISCLAIMER,
        source='live',
        status='ready' if owned else ('unavailable' if has_confirmed_tasks else 'needs_profile'),
        current_role=role,
        current_role_coverage_pct=current_role_coverage_pct,
        skills=skill_items,
        directions=directions,
        chosen_direction_code=chosen_code,
        chosen_direction_coverage_pct=chosen_score if chosen_score is not None else None,
        shortlisted_skill_ids=shortlist,
    )
