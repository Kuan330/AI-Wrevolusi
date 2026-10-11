"""Shared read-only possibilities reference data and uncapped role requirements."""
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.services.occupation_text import occupation_description_sql
from app.services.possibilities import occupation_required_skills
from app.schemas.possibilities import OccupationRequirements

# Reference data is stable per process — avoid re-joining ~2.5k ILO tasks every request.
_skills_cache: dict[int, dict] | None = None
_occupation_rows_cache: list[dict] | None = None
_occupation_taxonomy_cache: dict[str, dict] | None = None


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


async def load_reference_data(db: AsyncSession) -> tuple[dict[int, dict], list[dict], dict[str, dict]]:
    global _skills_cache, _occupation_rows_cache, _occupation_taxonomy_cache
    if (_skills_cache is not None and _occupation_rows_cache is not None
            and _occupation_taxonomy_cache is not None):
        return _skills_cache, _occupation_rows_cache, _occupation_taxonomy_cache

    skill_rows = (await db.execute(text(
        'SELECT wef_skill_id, core_skill, wef_skill_group FROM ref_wef_skills ORDER BY wef_skill_id'
    ))).mappings().all()
    skills = {int(row['wef_skill_id']): dict(row) for row in skill_rows}

    taxonomy_rows = (await db.execute(text(
        'SELECT occupation_code, level, parent_code FROM ref_occupations'
    ))).mappings().all()
    occupation_taxonomy = {
        str(row['occupation_code']): dict(row) for row in taxonomy_rows
    }

    # Unit occupations only — major/minor tree nodes have no ILO tasks and inflate matching.
    occupation_rows = (await db.execute(text(
        f"SELECT o.occupation_code, o.level, o.parent_code, o.title, {occupation_description_sql('o.description')}, NULL AS industry, "
        "COALESCE(array_agg(i.task_text ORDER BY i.task_id) FILTER (WHERE i.task_text IS NOT NULL), '{}') AS tasks "
        "FROM ref_occupations o LEFT JOIN ref_ilo_tasks i ON i.isco_08=o.occupation_code "
        "WHERE o.level = 'unit' "
        "GROUP BY o.occupation_code,o.level,o.parent_code,o.title,o.description ORDER BY o.occupation_code"
    ))).mappings().all()
    occupations = [dict(row) for row in occupation_rows]

    _skills_cache = skills
    _occupation_rows_cache = occupations
    _occupation_taxonomy_cache = occupation_taxonomy
    return skills, occupations, occupation_taxonomy



def build_occupation_requirements(code, skills, occupations, *, matcher=occupation_required_skills):
    occupation = next((row for row in occupations if row['occupation_code'] == code), None)
    if occupation is None:
        return None
    required = matcher(occupation.get('tasks') or [], skills, occupation=occupation)
    payload = build_direction_payload({**occupation, 'required_skill_ids': sorted(required)}, skills)
    return OccupationRequirements(occupation_code=code, title=payload['title'],
        skills=[{key: skill[key] for key in ('skill_id', 'skill_slug', 'name')} for skill in payload['skills']])


def requirements_text(role):
    return "\n".join([role.title, 'Required skills:', *[f'- {skill.name}' for skill in role.skills]])
