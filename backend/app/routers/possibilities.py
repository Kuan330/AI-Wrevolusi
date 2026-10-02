import json
import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.services.auth import get_current_user
from app.services.occupation_text import occupation_description_sql
from app.services.possibilities import (
    MODERN_PROFILE_KEY,
    PROFILE_RECOVERY_MESSAGE,
    completed_course_wef_skill_ids,
    confirmed_workspace_evidence,
    occupation_required_skills,
    recommend_occupations,
    wef_career_evidence,
)
from app.schemas.possibilities import PossibilitiesResponse
from app.services.workspace import SHORTLIST_KEY, read_workspace_shortlist
from app.services.journey import apply_skill_review

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
        f"SELECT o.occupation_code, o.title, {occupation_description_sql('o.description')}, NULL AS industry, "
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
    except Exception:
        logger.exception('Failed to load Possibilities reference data')
        raise HTTPException(status_code=503, detail='Reference data is unavailable. Please retry.') from None
    from app.schemas.skill_matching import SkillMatchCandidate
    from app.services.skill_matching import match_skills
    candidates = [SkillMatchCandidate(id=i, skill=str(row['core_skill'])) for i, row in skills.items()]

    try:
        workspace = (await db.execute(
            text('SELECT workspace FROM app_accounts WHERE user_id=:id'), {'id': current_user.id}
        )).scalar_one_or_none()
    except Exception:
        logger.exception('Failed to load the account workspace for Possibilities')
        raise HTTPException(status_code=503, detail='Your saved account could not be loaded. Please retry before viewing Possibilities.') from None
    if workspace is None:
        workspace = {}
    try:
        confirmed_texts, workspace_role = confirmed_workspace_evidence(workspace, occupation_rows)
    except ValueError:
        raise HTTPException(status_code=409, detail=PROFILE_RECOVERY_MESSAGE) from None
    modern_profile = MODERN_PROFILE_KEY in workspace
    confirmed_rows = []
    if not modern_profile:
        try:
            confirmed_rows = (await db.execute(text(
                "SELECT title, description FROM tasks WHERE user_id=:user_id AND status='confirmed' ORDER BY created_at"
            ), {'user_id': current_user.id})).mappings().all()
        except Exception:
            logger.exception('Failed to load legacy confirmed tasks for Possibilities')
            raise HTTPException(status_code=503, detail='Your saved task evidence could not be loaded. Please retry.') from None
    task_texts = set(confirmed_texts)
    task_texts.update(f"{task['title']} {task['description'] or ''}".strip() for task in confirmed_rows)
    owned = {
        item.wef_skill_id
        for task_text in task_texts
        for item in match_skills(task_text, candidates, limit=None)
    }
    inferred_wef = set(owned)
    try:
        owned = apply_skill_review(owned, workspace)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None
    has_confirmed_tasks = bool(confirmed_rows or confirmed_texts)
    shortlist_raw = _json_value(workspace, SHORTLIST_KEY, [])
    shortlist = read_workspace_shortlist(shortlist_raw, allowed_skill_ids=set(skills))
    chosen_raw = _json_value(workspace, 'aiwrevolusi.possibilities.chosenDirection', {})
    chosen_code = chosen_raw.get('occupation_code') if isinstance(chosen_raw, dict) else None
    chosen_uri = chosen_raw.get('occupation_uri') if isinstance(chosen_raw, dict) else None
    role = workspace_role
    if not modern_profile and role is None and current_user.occupation_id:
        try:
            role_row = (await db.execute(text('SELECT masco_code, title FROM occupations WHERE id=:id'), {'id': current_user.occupation_id})).mappings().one_or_none()
            if role_row:
                role = {'occupation_code': role_row['masco_code'], 'title': role_row['title']}
            else:
                logger.warning(f"No occupation found for user {current_user.id} with occupation_id {current_user.occupation_id}")
        except Exception as e:
            logger.error(f"Error loading occupation for user {current_user.id}: {str(e)}")
            # Continue without role - don't fail the entire request

    try:
        current_wef, suggested_wef, developing_wef = wef_career_evidence(
            workspace, inferred_wef, set(skills)
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None

    try:
        from app.services.catalogue import load_catalogue_scope

        catalogue_scope = await load_catalogue_scope(db)
        progress_rows = (await db.execute(text(
            'SELECT skill_id, course_id, chapter_index, value '
            'FROM learning_progress WHERE user_id=:user_id'
        ), {'user_id': current_user.id})).mappings().all()
        course_skills = completed_course_wef_skill_ids(skills, catalogue_scope, progress_rows)
        developing_wef |= course_skills - current_wef
        suggested_wef -= developing_wef
    except Exception:
        logger.exception('Failed to load completed-course evidence for Possibilities')

    ranked = recommend_occupations(
        occupation_rows, current_wef, skills, limit=3,
        developing_skill_ids=developing_wef,
        suggested_skill_ids=suggested_wef,
        exclude_codes={role['occupation_code']} if role else None,
    )
    directions = []
    for row in ranked:
        direction = build_direction_payload(row, skills)
        direction.update({
            'occupation_uri': None,
            'requirements': [],
            'source': None,
            'current_skill_overlap': row['overlap_count'],
            'developing_skill_overlap': row['developing_overlap_count'],
            'suggested_skill_overlap': row['suggested_overlap_count'],
            'essential_not_yet_evidenced': row['missing_count'],
        })
        directions.append(direction)
    if chosen_code not in {direction['occupation_code'] for direction in directions}:
        chosen_code = None
    chosen_uri = None
    selected_direction = next((row for row in directions if row['occupation_code'] == chosen_code), None)
    chosen_score = selected_direction['coverage_pct'] if selected_direction else None
    reviewed_esco_skills = []
    career_source_note = 'Roles are matched from WEF skills and occupation task descriptions.'
    from app.services.possibilities import slugify_skill_name
    skill_items = [{'skill_id': i, 'skill_slug': slugify_skill_name(str(row['core_skill'])), 'name': row['core_skill'], 'state': 'have' if i in current_wef else ('learning' if i in developing_wef else ('suggested' if i in suggested_wef else ('shortlisted' if i in shortlist else 'missing')))} for i, row in skills.items()]
    chosen_score = None
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
        status='ready' if (current_wef or suggested_wef or developing_wef) else ('needs_skill_review' if has_confirmed_tasks else 'needs_profile'),
        current_role=role,
        current_role_coverage_pct=current_role_coverage_pct,
        skills=skill_items,
        directions=directions,
        chosen_direction_code=chosen_code,
        chosen_direction_uri=chosen_uri,
        chosen_direction_coverage_pct=chosen_score if chosen_score is not None else None,
        shortlisted_skill_ids=shortlist,
        reviewed_esco_skills=reviewed_esco_skills,
        career_source_note=career_source_note,
    )
