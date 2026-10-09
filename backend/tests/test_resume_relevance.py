"""Offline role relevance: no supplier, real personal data, or database writes."""
import asyncio
import copy
from types import SimpleNamespace
from unittest.mock import AsyncMock
import pytest
from pydantic import ValidationError
from app.schemas.possibilities import OccupationRequirements
from app.schemas.resume import GenerateRequest
from app.services.possibilities_reference import requirements_text
from app.services import resume_generation as service
from app.services import resume_relevance
from app.services.ai_gateway import AIProviderError
from app.services.resume_errors import GenerationFailure
from tests.test_resume_generation import payload, Provider


def role():
    return OccupationRequirements(occupation_code="2421", title="Management and Organization Analysts", skills=[
        {"skill_id": 1, "skill_slug": "analytical-thinking", "name": "Analytical thinking"},
        {"skill_id": 2, "skill_slug": "leadership", "name": "Leadership"}])


def data():
    original = payload()
    original.update(occupation_code="2421", job_requirements=requirements_text(role()), skills=[
        {"id": "confirmed", "name": "Analytical thinking"},
        {"id": "uploaded", "name": "SQL"},
        {"id": "learning", "name": "Programming"},
        {"id": "unrelated", "name": "Life insurance"}])
    return original


class RoleProvider(Provider):
    def __init__(self, transform=None, **kwargs):
        super().__init__(**kwargs)
        self.transform = transform
    async def complete_json_async(self, **kwargs):
        output = await super().complete_json_async(**kwargs)
        if self.output is None:
            output["skill_decisions"] = [{"candidate_id": c["candidate_id"], "requirement_skill_id": None if c["name"] == "Life insurance" else 1} for c in kwargs["payload"]["skill_candidates"]]
        if self.transform: self.transform(output, kwargs["payload"])
        return output


def run(provider=None, original=None, target=None):
    return asyncio.run(service.generate_reviewed_resume(GenerateRequest.model_validate(original or data()), provider or RoleProvider(), target or role()))


def skill_names(result):
    return [entry.text for section in result.sections if section.title == "Skills" for entry in section.entries]


def test_direct_and_semantic_matches_keep_original_names_without_target_injection():
    original = data(); before = copy.deepcopy(original); provider = RoleProvider()
    result = run(provider, original)
    assert skill_names(result) == ["Analytical thinking", "Programming", "SQL"]
    assert result.skill_filter_version == "role_relevance_v1" and result.outcome == "tailored"
    assert len(provider.calls) == 1 and provider.calls[0]["request_timeout_s"] == 60
    sent = provider.calls[0]["payload"]
    assert all(c["candidate_id"].startswith("c") and len(c["candidate_id"]) < 5 for c in sent["skill_candidates"])
    assert not any(c["name"] == "Analytical thinking" for c in sent["skill_candidates"])
    assert "Leadership" not in skill_names(result) and "Life insurance" not in skill_names(result)
    assert "related" in provider.calls[0]["system_prompt"] and sent["target_role"]["required_skills"][0]["skill_id"] == 1
    assert original == before
    projects = next(s for s in result.sections if s.title == "Projects").entries
    assert [(p.project.name, p.project.date) for p in projects] == [("Retail Sales Analysis", "Apr 2026"), ("Student Survey Review", "Nov 2025")]


@pytest.mark.parametrize("kind", ["unknown_candidate", "unknown_requirement", "duplicate", "missing"])
def test_invalid_or_missing_decisions_are_excluded_but_good_polishing_survives(kind):
    def corrupt(output, sent):
        sql = next(c["candidate_id"] for c in sent["skill_candidates"] if c["name"] == "SQL")
        if kind == "unknown_candidate": output["skill_decisions"].append({"candidate_id": "invented", "requirement_skill_id": 1})
        if kind == "unknown_requirement": next(d for d in output["skill_decisions"] if d["candidate_id"] == sql)["requirement_skill_id"] = 999
        if kind == "duplicate": output["skill_decisions"].append({"candidate_id": sql, "requirement_skill_id": None})
        if kind == "missing": output["skill_decisions"] = [d for d in output["skill_decisions"] if d["candidate_id"] != sql]
    provider = RoleProvider(corrupt)
    result = run(provider)
    assert result.outcome == "source_preserved" and "skill_relevance_incomplete" in result.notices
    assert "Analytical thinking" in skill_names(result) and "Leadership" not in skill_names(result)
    assert ("SQL" in skill_names(result)) == (kind == "unknown_candidate")
    assert len(provider.calls) == 1
    assert next(s for s in result.sections if s.title == "Projects").entries[0].project.highlights[0] == "Cleaned 2,400 records."
    assert result.gaps == []


@pytest.mark.parametrize("error", [AIProviderError("synthetic", kind="timeout"), AIProviderError("synthetic", kind="transport"), AIProviderError("synthetic", kind="output")])
def test_failures_return_only_standard_matches_and_original_evidence(error):
    provider = RoleProvider(error=error); result = run(provider)
    assert skill_names(result) == ["Analytical thinking"]
    assert result.outcome == "source_preserved" and "skill_relevance_incomplete" in result.notices
    assert len(provider.calls) == 1 and result.gaps == []
    assert next(s for s in result.sections if s.title == "Experience").entries[1].text == data()["evidence"][4]["text"]


@pytest.mark.parametrize("output", [{}, {"patches": [], "gaps": [], "skill_decisions": [{"candidate_id": "c1", "requirement_skill_id": "1"}]}, {"patches": [], "gaps": [], "skill_decisions": [], "skills": ["Certified expert"]}])
def test_unparseable_contract_has_conservative_full_fallback(output):
    result = run(RoleProvider(output=output))
    assert skill_names(result) == ["Analytical thinking"]
    assert result.notices == ["ai_output_invalid", "skill_relevance_incomplete"]


def test_no_related_skills_preserves_reviewed_experience_and_offers_empty_skills_update():
    original = data(); original["skills"] = [{"id": "unrelated", "name": "Life insurance"}]
    result = run(original=original)
    assert skill_names(result) == [] and result.outcome == "tailored"
    assert result.sections[0].title == "Skills" and result.sections[0].entries == []
    assert result.notices == ["no_related_skills"] and any(s.title == "Experience" for s in result.sections)


def test_skills_only_semantic_matching_calls_ai_without_turning_learning_into_facts():
    original = {"occupation_code": "2421", "job_requirements": requirements_text(role()), "skills": [{"id": "planned", "name": "Programming"}], "source_projects": [], "source_sections": []}
    provider = RoleProvider(); result = run(provider, original)
    assert skill_names(result) == ["Programming"] and len(provider.calls) == 1
    assert provider.calls[0]["payload"]["facts"] == []
    assert result.sections[0].entries[0].fact_ids == []


def test_direct_skills_only_skips_ai_and_does_not_relabel():
    original = {"occupation_code": "2421", "job_requirements": requirements_text(role()), "skills": [{"id": "confirmed", "name": "ANALYTICAL THINKING"}], "source_projects": [], "source_sections": []}
    provider = RoleProvider(); result = run(provider, original)
    assert not provider.calls and skill_names(result) == ["ANALYTICAL THINKING"] and result.outcome == "tailored"


@pytest.mark.parametrize("failed", [False, True])
def test_no_relevant_skill_and_no_other_facts_is_not_an_empty_resume(failed):
    original = {"occupation_code": "2421", "job_requirements": requirements_text(role()), "skills": [{"id": "unrelated", "name": "Life insurance"}], "source_projects": [], "source_sections": []}
    provider = RoleProvider(error=AIProviderError("synthetic", kind="transport")) if failed else RoleProvider()
    with pytest.raises(GenerationFailure) as info: run(provider, original)
    assert info.value.code == "no_related_input"


def test_classification_exclusion_never_creates_missing_ability_gaps():
    def gaps(output, sent): output["gaps"] = [{"id": "missing", "label": "Leadership", "keywords": ["Leadership"], "skill_slugs": []}]
    assert run(RoleProvider(gaps)).gaps == []


def test_changed_requirements_rejected_before_ai():
    original = data(); original["job_requirements"] = "Tampered target"
    provider = RoleProvider()
    with pytest.raises(GenerationFailure) as info: run(provider, original)
    assert info.value.code == "target_role_changed" and not provider.calls


@pytest.mark.parametrize("count", [1, 80, 81, 250])
def test_all_related_candidates_fit_as_individual_bullets(count):
    original = data(); original["skills"] = [{"id": str(i), "name": f"Synthetic skill {i:03}"} for i in range(count)]
    result = run(original=original)
    assert len(skill_names(result)) == count
    assert all(len(e.skill_ids) == 1 for e in result.sections[0].entries)


def test_compound_skill_name_is_not_split():
    original = data(); original["skills"] = [{"id": "whole", "name": "Reading, writing and mathematics"}]
    assert skill_names(run(original=original)) == ["Reading, writing and mathematics"]


def test_real_total_deadline_cancels_semantic_request(monkeypatch):
    class Slow(RoleProvider):
        stopped = False
        async def complete_json_async(self, **kwargs):
            self.calls.append(kwargs)
            try: await asyncio.sleep(10)
            finally: self.stopped = True
    monkeypatch.setattr(service, "GENERATION_BUDGET_SECONDS", 0.02)
    provider = Slow(); result = run(provider)
    assert provider.stopped and len(provider.calls) == 1
    assert skill_names(result) == ["Analytical thinking"] and result.notices[:2] == ["ai_timeout", "skill_relevance_incomplete"]


@pytest.mark.parametrize("status", [400, 401, 403, 404, 422])
def test_configuration_failures_still_error(status):
    with pytest.raises(GenerationFailure): run(RoleProvider(error=AIProviderError("synthetic", kind="http", status_code=status)))


def test_unrelated_standard_name_cannot_match_by_substring_or_numeric_custom_id():
    original = data(); original["skills"] = [{"id": "1", "name": "Critical thinking"}, {"id": "2", "name": "Analytical thinking proficiency"}]
    direct, pending, _ = resume_relevance.candidates_for_role(GenerateRequest.model_validate(original), role())
    assert direct == [] and len(pending) == 2


@pytest.mark.parametrize("kind,code", [("unknown", "target_role_not_found"), ("empty", "role_has_no_skills"), ("failed", "role_reference_unavailable")])
def test_database_role_lookup_errors_are_explicit(monkeypatch, kind, code):
    if kind == "failed": loader = AsyncMock(side_effect=RuntimeError("private database value"))
    elif kind == "unknown": loader = AsyncMock(return_value=({}, [], {}))
    else: loader = AsyncMock(return_value=({}, [{"occupation_code": "2421", "title": "Empty", "tasks": []}], {}))
    monkeypatch.setattr(resume_relevance, "load_reference_data", loader)
    with pytest.raises(GenerationFailure) as info: asyncio.run(resume_relevance.load_role(SimpleNamespace(), "2421"))
    assert info.value.code == code and "private" not in info.value.detail


def test_new_role_code_requires_modern_reviewed_sources():
    original = data(); del original["source_sections"]
    with pytest.raises(ValidationError): GenerateRequest.model_validate(original)


def test_real_route_uses_server_role_loader_and_emits_filter_version():
    import httpx
    from fastapi import FastAPI
    from app.routers.resume import router, get_resume_provider, get_resume_role_loader
    from app.services.auth import get_current_user
    async def scenario():
        app = FastAPI(); app.include_router(router, prefix="/api/v1")
        provider = RoleProvider(); loader = AsyncMock(return_value=role())
        app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="synthetic")
        app.dependency_overrides[get_resume_provider] = lambda: provider
        app.dependency_overrides[get_resume_role_loader] = lambda: loader
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://synthetic") as client:
            response = await client.post("/api/v1/resume/generate", json=data())
        assert response.status_code == 200 and response.json()["skill_filter_version"] == "role_relevance_v1"
        assert [e["text"] for e in response.json()["sections"][0]["entries"]] == ["Analytical thinking", "Programming", "SQL"]
        loader.assert_awaited_once_with("2421")
        changed = data(); changed["job_requirements"] = "Old requirements"
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app), base_url="http://synthetic") as client:
            response = await client.post("/api/v1/resume/generate", json=changed)
        assert response.status_code == 409 and response.json()["code"] == "target_role_changed"
        assert len(provider.calls) == 1
    asyncio.run(scenario())


def test_disconnect_during_database_role_lookup_cancels_without_ai():
    from app.routers.resume import generate
    async def scenario():
        started, stopped = asyncio.Event(), asyncio.Event()
        provider = RoleProvider()
        async def slow_loader(code):
            assert code == "2421"
            started.set()
            try:
                await asyncio.sleep(10)
            finally:
                stopped.set()
        async def receive():
            await started.wait()
            return {"type": "http.disconnect"}
        async with asyncio.timeout(2):
            response = await generate(GenerateRequest.model_validate(data()), SimpleNamespace(receive=receive), provider, slow_loader)
        assert response.status_code == 499 and stopped.is_set()
        assert not provider.calls
    asyncio.run(scenario())


def test_generator_reference_matches_requirements_and_full_card_mapper(monkeypatch):
    from app.routers import possibilities as route
    from app.services.possibilities import occupation_required_skills
    from app.services.possibilities_reference import build_direction_payload
    skills = {1: {"core_skill": "Analytical thinking"}, 2: {"core_skill": "Leadership"}, 3: {"core_skill": "Programming"}}
    occupation = {"occupation_code": "synthetic-relevance-map", "title": "Synthetic role", "tasks": ["Analytical thinking, leadership and programming"]}
    loader = AsyncMock(return_value=(skills, [occupation], {}))
    monkeypatch.setattr(resume_relevance, "load_reference_data", loader)
    monkeypatch.setattr(route, "_load_reference_data", loader)
    async def scenario():
        db = SimpleNamespace()
        server_role = await resume_relevance.load_role(db, occupation["occupation_code"])
        public_role = await route.get_occupation_requirements(occupation["occupation_code"], SimpleNamespace(), db)
        mapped = occupation_required_skills(occupation["tasks"], skills, occupation=occupation)
        assert mapped
        card = build_direction_payload({**occupation, "required_skill_ids": sorted(mapped)}, skills)
        assert server_role == public_role
        assert [skill.model_dump() for skill in server_role.skills] == [{key: skill[key] for key in ("skill_id", "skill_slug", "name")} for skill in card["skills"]]
    asyncio.run(scenario())
