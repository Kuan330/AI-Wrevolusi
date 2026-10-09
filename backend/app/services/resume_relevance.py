"""Generation-only candidate selection; never mutates source/profile skills."""
import unicodedata
import re
from app.services.resume_errors import GenerationFailure
from app.services.possibilities_reference import load_reference_data, build_occupation_requirements

FILTER_VERSION = "role_relevance_v1"


def skill_key(name):
    # Preserve C/C++/C# and complete compound labels; no substring matching.
    return re.sub(r"\s+", " ", unicodedata.normalize("NFKC", name).strip()).casefold()


async def load_role(db, code):
    try:
        skills, occupations, _ = await load_reference_data(db)
        role = build_occupation_requirements(code, skills, occupations)
    except Exception:
        raise GenerationFailure("Role requirements are unavailable. Retry role requirements before generating.", code="role_reference_unavailable") from None
    if role is None:
        raise GenerationFailure("This target role is no longer available. Choose another career direction.", code="target_role_not_found")
    if not role.skills:
        raise GenerationFailure("This target role has no required skills. Choose another career direction.", code="role_has_no_skills")
    return role


def candidates_for_role(request, role):
    required = {skill_key(skill.name): skill.skill_id for skill in role.skills}
    unique = {}
    for candidate in request.skills:
        unique.setdefault(skill_key(candidate.name), candidate)
    direct, pending, covered = [], {}, set()
    for key in sorted(unique):
        candidate = unique[key]
        if key in required:
            direct.append(candidate)
            covered.add(required[key])
        else:
            pending[f"c{len(pending)+1}"] = candidate
    return direct, pending, covered


def select_related(direct, pending, covered, role, decisions):
    allowed = {skill.skill_id for skill in role.skills}
    grouped, incomplete = {}, False
    for decision in decisions or []:
        if decision.candidate_id not in pending:
            incomplete = True
            continue
        grouped.setdefault(decision.candidate_id, []).append(decision)
    selected = list(direct)
    covered = set(covered)
    for alias, candidate in pending.items():
        entries = grouped.get(alias, [])
        if len(entries) != 1:
            incomplete = True
            continue
        anchor = entries[0].requirement_skill_id
        if anchor is None:
            continue  # Explicitly unrelated, not an omitted decision.
        if anchor not in allowed:
            incomplete = True
            continue
        selected.append(candidate)
        covered.add(anchor)
    return selected, covered, incomplete
