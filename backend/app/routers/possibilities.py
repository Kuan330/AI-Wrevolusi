import json
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.services.auth import get_current_user
from app.services.possibilities import (
    chosen_direction_score,
    recommend_occupations,
    validate_shortlist_ids,
)
from app.schemas.possibilities import PossibilitiesResponse

router = APIRouter(prefix='/possibilities', tags=['Possibilities'])
DISCLAIMER = 'Exploratory skill connections only; not job readiness or hiring probability.'


def _json_value(workspace: dict, key: str, default):
    try:
        value = json.loads(workspace.get(key, 'null'))
        return default if value is None else value
    except (TypeError, ValueError):
        return default


@router.get('', response_model=PossibilitiesResponse)
async def get_possibilities(
    current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)
) -> PossibilitiesResponse:
    skill_rows = (await db.execute(text(
        'SELECT wef_skill_id, core_skill, wef_skill_group FROM ref_wef_skills ORDER BY wef_skill_id'
    ))).mappings().all()
    skills = {int(row['wef_skill_id']): dict(row) for row in skill_rows}
    confirmed_rows = (await db.execute(text(
        "SELECT title, description FROM tasks WHERE user_id=:user_id AND status='confirmed' ORDER BY created_at"
    ), {'user_id': current_user.id})).mappings().all()
    from app.schemas.skill_matching import SkillMatchCandidate
    from app.services.skill_matching import match_skills
    candidates = [SkillMatchCandidate(id=i, skill=str(row['core_skill'])) for i, row in skills.items()]
    owned = {item.wef_skill_id for task in confirmed_rows for item in match_skills(
        f"{task['title']} {task['description'] or ''}", candidates
    )}

    occupation_rows = (await db.execute(text(
        "SELECT o.occupation_code, o.title, o.description, NULL AS industry, "
        "COALESCE(array_agg(i.task_text ORDER BY i.task_id) FILTER (WHERE i.task_text IS NOT NULL), '{}') AS tasks "
        "FROM ref_occupations o LEFT JOIN ref_ilo_tasks i ON i.isco_08=o.occupation_code "
        "GROUP BY o.occupation_code,o.title,o.description ORDER BY o.occupation_code"
    ))).mappings().all()
    workspace = (await db.execute(text('SELECT workspace FROM app_accounts WHERE user_id=:id'), {'id': current_user.id})).scalar_one_or_none() or {}
    shortlist_raw = _json_value(workspace, 'aiwrevolusi.possibilities.shortlist', [])
    shortlist = validate_shortlist_ids(shortlist_raw, allowed_skill_ids=set(skills), limit=60) if isinstance(shortlist_raw, list) else []
    chosen_raw = _json_value(workspace, 'aiwrevolusi.possibilities.chosenDirection', {})
    chosen_code = chosen_raw.get('occupation_code') if isinstance(chosen_raw, dict) else None
    recommendations = recommend_occupations(occupation_rows, owned, skills)
    allowed_codes = {row['occupation_code'] for row in recommendations}
    if chosen_code not in allowed_codes:
        chosen_code = None
    role = None
    if current_user.occupation_id:
        role_row = (await db.execute(text('SELECT masco_code, title FROM occupations WHERE id=:id'), {'id': current_user.occupation_id})).mappings().one_or_none()
        if role_row:
            role = {'occupation_code': role_row['masco_code'], 'title': role_row['title']}
    skill_items = [{'skill_id': i, 'skill_slug': str(row['core_skill']).lower().replace(' ', '-'), 'name': row['core_skill'], 'state': 'have' if i in owned else ('shortlisted' if i in shortlist else 'missing')} for i, row in skills.items()]
    directions = [{k: v for k, v in row.items() if k != 'required_skill_ids'} | {'skills': [{'skill_id': i, 'skill_slug': str(skills[i]['core_skill']).lower().replace(' ', '-'), 'name': skills[i]['core_skill'], 'state': 'have' if i in owned else ('shortlisted' if i in shortlist else 'missing')} for i in row['required_skill_ids']]} for row in recommendations]
    chosen_score = next((chosen_direction_score(owned, set(shortlist), set(row['required_skill_ids'])) for row in recommendations if row['occupation_code'] == chosen_code), None)
    return PossibilitiesResponse(disclaimer=DISCLAIMER, source='live', status='ready' if owned else 'needs_profile', current_role=role, skills=skill_items, directions=directions, chosen_direction_code=chosen_code, chosen_direction_coverage_pct=chosen_score if chosen_score is not None else None, shortlisted_skill_ids=shortlist)
