"""Offline aggregation tests using synthetic sources and a mocked provider."""
import asyncio
import copy

import pytest
from pydantic import ValidationError

from app.schemas.resume import GenerateRequest
from app.services.ai_gateway import AIProviderError
from app.services.resume_generation import generate_reviewed_resume
from tests.test_resume_new_skills import source, event_role
from tests.test_resume_relevance import skill_names


class Provider:
    def __init__(self, error=None, transform=None):
        self.calls = []
        self.error = error
        self.transform = transform

    async def complete_json_async(self, **kwargs):
        self.calls.append(kwargs)
        if self.error:
            raise self.error
        payload = kwargs["payload"]
        result = {
            "patches": [{"fact_id": f["id"], "text": f["text"].lstrip("- ")} for f in payload["facts"]],
            "summary": [{"fact_id": "f-4", "text": "Managed 250+ clients, achieving a 92% renewal rate."}],
            "project_order": [p["id"] for p in payload["source_projects"]],
        }
        if self.transform:
            self.transform(result)
        return result


def request_data():
    return {**source(), "skill_selection": "aggregate"}


def generate(data=None, provider=None):
    return asyncio.run(generate_reviewed_resume(
        GenerateRequest.model_validate(data or request_data()), provider or Provider(), event_role()))


def test_keeps_every_source_skill_without_role_classification(monkeypatch):
    from app.services import resume_role_generation

    def forbidden(*args, **kwargs):
        pytest.fail("Aggregation must not run role relevance selection")

    monkeypatch.setattr(resume_role_generation, "candidates_for_role", forbidden)
    monkeypatch.setattr(resume_role_generation, "select_related", forbidden)
    data = request_data()
    before = copy.deepcopy(data)
    provider = Provider()
    result = generate(data, provider)
    assert set(skill_names(result)) == {s["name"] for s in data["skills"]}
    assert len(skill_names(result)) == len(data["skills"])
    assert "Life, medical, motor, property, and travel insurance" in skill_names(result)
    assert result.skill_filter_version == "all_sources_v1"
    assert result.tailoring_version == "career_evidence_v2"
    assert result.role_alignment is None and result.gaps == []
    assert len(provider.calls) == 1 and provider.calls[0]["request_timeout_s"] == 60
    assert provider.calls[0]["payload"]["skill_candidates"] == []
    assert "Do not assess, filter, rank" in provider.calls[0]["system_prompt"]
    assert data == before


@pytest.mark.parametrize("error", [TimeoutError(), AIProviderError("synthetic", kind="timeout"), AIProviderError("synthetic", kind="transport")])
def test_failure_keeps_all_skills_and_reviewed_projects(error):
    data = request_data()
    provider = Provider(error=error)
    result = generate(data, provider)
    assert set(skill_names(result)) == {s["name"] for s in data["skills"]}
    assert result.outcome == "source_preserved"
    assert "skill_relevance_incomplete" not in result.notices
    assert len(provider.calls) == 1
    projects = next(s for s in result.sections if s.title == "Projects")
    assert [entry.project.name for entry in projects.entries] == [p["name"] for p in data["source_projects"]]


def test_model_decisions_cannot_filter_or_add_skills():
    provider = Provider(transform=lambda output: output.update(
        skill_decisions=[None, {"candidate_id": "user-0", "requirement_skill_id": None}],
        evidence_links=[None], gaps=[None]))
    result = generate(provider=provider)
    assert set(skill_names(result)) == {s["name"] for s in request_data()["skills"]}
    assert "skill_relevance_incomplete" not in result.notices
    assert "alignment_incomplete" not in result.notices


@pytest.mark.parametrize("count", [1, 81, 250])
def test_complete_deduplicated_skill_bullets(count):
    data = request_data()
    names = ["C", "C++", "C#", "SQL", " sql "][:count]
    names += [f"Original skill {i}" for i in range(len(names), count)]
    data["skills"] = [{"id": f"s{i}", "name": name} for i, name in enumerate(names)]
    data["source_metadata"]["skill_sources"] = [
        {"skill_id": skill["id"], "origins": [{"kind": "reviewed_resume", "label": "Original Skills", "fact_ids": []}]}
        for skill in data["skills"]]
    result = generate(data)
    actual = skill_names(result)
    assert len(actual) == len({name.strip().casefold() for name in names})
    assert {name.casefold() for name in actual} == {name.strip().casefold() for name in names}
    if count > 5:
        assert {"C", "C++", "C#", "SQL"} <= set(actual)


def test_no_skills_returns_explicit_empty_chapter_with_reviewed_experience():
    data = request_data()
    data["skills"] = []
    data["source_metadata"]["skill_sources"] = []
    result = generate(data)
    assert next(s for s in result.sections if s.title == "Skills").entries == []
    assert next(s for s in result.sections if s.title == "Experience").entries
    assert "no_related_skills" not in result.notices


def test_aggregation_requires_current_source_contract():
    data = request_data()
    data.pop("source_metadata")
    with pytest.raises(ValidationError):
        GenerateRequest.model_validate(data)


def test_auto_redacted_source_generates_without_claiming_manual_review():
    data = request_data()
    data.update(evidence_reviewed=False, evidence_mode="auto_redacted")
    parsed = GenerateRequest.model_validate(data)
    assert parsed.evidence_reviewed is False
    result = generate(data)
    assert set(skill_names(result)) == {s["name"] for s in data["skills"]}
    assert next(section for section in result.sections if section.title == "Experience").entries


@pytest.mark.parametrize("text", ["private@example.test", "+61 412 345 678"])
def test_auto_redacted_mode_still_rejects_contacts_in_evidence(text):
    data = request_data()
    data.update(evidence_reviewed=False, evidence_mode="auto_redacted")
    data["evidence"][0]["text"] = text
    with pytest.raises(ValidationError, match="contact details"):
        GenerateRequest.model_validate(data)
