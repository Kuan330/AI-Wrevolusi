"""Epic 8 synthetic references. Mock tests validate contracts, not model relevance."""
import asyncio
import copy
import pytest
from pydantic import ValidationError
from app.schemas.resume import GenerateRequest
from app.schemas.resume_sources import section_heading
from app.services.resume_generation import generate_reviewed_resume
from app.services.ai_gateway import AIProviderError
from tests.test_resume_relevance import data, role, skill_names


def career_data():
    original = data()
    original["source_metadata"] = {"version": "career_evidence_v1", "skill_sources": [
        {"skill_id": "confirmed", "origins": [{"kind": "platform_confirmed", "label": "User confirmed", "fact_ids": []}]},
        {"skill_id": "uploaded", "origins": [{"kind": "reviewed_resume", "label": "Original Skills", "fact_ids": ["f-1"]}, {"kind": "learning_intention", "label": "Selected goal", "fact_ids": []}]},
        {"skill_id": "learning", "origins": [{"kind": "learning_intention", "label": "Learning choice", "fact_ids": []}]},
        {"skill_id": "unrelated", "origins": [{"kind": "reviewed_resume", "label": "Original Skills", "fact_ids": []}]}], "learning_facts": []}
    return original


class CareerProvider:
    def __init__(self, transform=None, error=None): self.calls = []; self.transform = transform; self.error = error
    async def complete_json_async(self, **kwargs):
        self.calls.append(kwargs)
        if self.error: raise self.error
        sent = kwargs["payload"]
        output = {"patches": [{"fact_id": f["id"], "text": f["text"].lstrip("• ")} for f in sent["facts"]],
            "gaps": [], "skill_decisions": [{"candidate_id": c["candidate_id"], "requirement_skill_id": None if c["name"] == "Life insurance" else 1} for c in sent["skill_candidates"]],
            "summary": [{"fact_id": "f-4", "text": "Managed 250+ clients, achieving a 92% renewal rate."}],
            "project_order": ["p2", "p1"], "evidence_links": []}
        if self.transform: self.transform(output, sent)
        return output


def run(original=None, provider=None, target=None):
    return asyncio.run(generate_reviewed_resume(GenerateRequest.model_validate(original or career_data()), provider or CareerProvider(), target or role()))


def test_one_call_role_objective_full_tasks_and_multisource_provenance():
    original = career_data(); before = copy.deepcopy(original); provider = CareerProvider()
    target = role().model_copy(update={"tasks": ["Study organisational processes", "Analyse operations"]})
    result = run(original, provider, target)
    assert result.tailoring_version == "career_evidence_v1" and result.outcome == "tailored"
    assert len(provider.calls) == 1 and provider.calls[0]["request_timeout_s"] == 60
    assert provider.calls[0]["operation"] == "resume.career.v1"
    sent = provider.calls[0]["payload"]
    assert sent["career_tasks"] == target.tasks
    assert not set(f["id"] for f in sent["facts"]) & set(f["id"] for f in sent["reviewed_context"])
    summary = next(s for s in result.sections if s.title == "Summary").entries[0]
    assert summary.text.startswith("Career objective: Management and Organization Analysts.")
    assert "250+" in summary.text and "92%" in summary.text and summary.fact_ids == ["f-4"]
    assert skill_names(result) == ["Analytical thinking", "SQL", "Programming"]
    uploaded = next(link for link in result.role_alignment.links if link.skill_id == "uploaded")
    assert len(uploaded.origins) == 2 and uploaded.method == "ai_semantic"
    assert all(link.requirement_skill_id == 1 for link in result.role_alignment.links)
    assert original == before


def test_projects_reorder_as_whole_records_preserving_all_facts():
    result = run()
    projects = next(s for s in result.sections if s.title == "Projects").entries
    assert [(e.project_id, e.project.name, e.project.date) for e in projects] == [("p2", "Student Survey Review", "Nov 2025"), ("p1", "Retail Sales Analysis", "Apr 2026")]
    assert projects[0].project.highlights == ["Reviewed 180 responses."]
    assert projects[1].project.highlights == ["Cleaned 2,400 records.", "Removed 36 duplicates."]
    assert projects[1].fact_ids == ["f-8", "f-9", "f-10"]
    assert next(s for s in result.sections if s.title == "Experience").entries[0].text == "ABC Insurance Berhad, Kuala Lumpur"


@pytest.mark.parametrize("order", [[], ["p1"], ["p1", "p1"], ["p1", "foreign"]])
def test_invalid_project_permutation_preserves_original_order(order):
    result = run(provider=CareerProvider(lambda o, _: o.update(project_order=order)))
    assert [e.project_id for s in result.sections if s.title == "Projects" for e in s.entries] == ["p1", "p2"]
    assert "project_order_unverified" in result.notices


def test_verbatim_projects_never_reorder_or_rewrite():
    original = career_data(); refs = [fid for project in original["source_projects"] for fid in project["fact_ids"]]
    original["source_projects"] = [{"id": "raw", "mode": "verbatim", "fact_ids": refs, "highlight_fact_ids": []}]
    result = run(original)
    assert result.role_alignment.project_order == ["raw"]
    assert [e.text for s in result.sections if s.title == "Projects" for e in s.entries] == [f["text"] for f in original["evidence"] if f["id"] in refs]


@pytest.mark.parametrize("fragment", [
    {"fact_id": "f-4", "text": "Managed 999 clients, achieving a 92% renewal rate."},
    {"fact_id": "f-4", "text": "Managed 250+ clients, achieving a 92% renewal rate and completed a certificate."},
    {"fact_id": "f-1", "text": "SQL, Excel"},
    {"fact_id": "foreign", "text": "Software Developer at Fictional Company"},
    {"fact_id": "f-9", "text": "Removed 36 duplicates."},
])
def test_summary_never_fabricates_numbers_employment_or_skills_evidence(fragment):
    result = run(provider=CareerProvider(lambda o, _: o.update(summary=[fragment])))
    assert "career_summary_unavailable" in result.notices
    assert not any(s.title == "Summary" for s in result.sections)
    assert result.outcome == "source_preserved" and "SQL" in skill_names(result)


def test_reviewed_instance_prioritises_skill_and_references_actual_project_position():
    def with_link(output, sent):
        candidate = next(c["candidate_id"] for c in sent["all_candidates"] if c["name"] == "Programming")
        output["evidence_links"] = [{"candidate_id": candidate, "fact_id": "f-9", "quote": "Cleaned 2,400 records."}]
    result = run(provider=CareerProvider(with_link))
    assert skill_names(result) == ["Programming", "Analytical thinking", "SQL"]
    link = next(l for l in result.role_alignment.links if l.name == "Programming")
    assert link.examples[0].text == "• Cleaned 2,400 records."
    assert [(l.section, l.entry_index) for l in link.locations] == [("Skills", 0), ("Projects", 1)]


@pytest.mark.parametrize("fact_id,quote", [("f-3", "ABC Insurance Berhad"), ("f-1", "SQL, Excel"), ("f-9", "Invented quote with no source"), ("unknown", "Cleaned 2,400 records.")])
def test_unknown_or_nonexample_references_do_not_certify_support(fact_id, quote):
    def with_link(output, sent):
        output["evidence_links"] = [{"candidate_id": sent["all_candidates"][0]["candidate_id"], "fact_id": fact_id, "quote": quote}]
    result = run(provider=CareerProvider(with_link))
    assert not any(l.examples for l in result.role_alignment.links)
    assert "alignment_incomplete" in result.notices


@pytest.mark.parametrize("error", [AIProviderError("synthetic", kind="timeout"), AIProviderError("synthetic", kind="transport")])
def test_fallback_preserves_sources_and_only_standard_skills(error):
    provider = CareerProvider(error=error); result = run(provider=provider)
    assert len(provider.calls) == 1 and result.outcome == "source_preserved"
    assert skill_names(result) == ["Analytical thinking"] and result.tailoring_version == "career_evidence_v1"
    assert not any(s.title == "Summary" for s in result.sections)
    assert result.role_alignment.project_order == ["p1", "p2"]
    assert all(l.method == "standard_mapping" for l in result.role_alignment.links)


def add_learning(original):
    original["evidence"] += [{"id": "lh", "text": "Professional Development"}, {"id": "lc", "text": "Self-recorded course completion: Data tools. All chapters recorded at 100%; not external certification."}, {"id": "ph", "text": "Learning practice"}, {"id": "lp", "text": "Course practice: (2026-09-20): Used SQL joins on a synthetic dataset."}]
    original["source_sections"] += [{"title": "Professional Development", "heading_fact_id": "lh", "fact_ids": ["lc"], "polishable_fact_ids": []}, {"title": "Learning practice", "heading_fact_id": "ph", "fact_ids": ["lp"], "polishable_fact_ids": []}]
    original["source_metadata"]["learning_facts"] = [{"fact_id": "lc", "record_id": "course:a", "kind": "course_completion", "label": "Data tools"}, {"fact_id": "lp", "record_id": "practice:a", "kind": "course_practice", "label": "SQL"}]
    original["source_metadata"]["skill_sources"][1]["origins"].append({"kind": "reviewed_learning", "label": "Data tools", "fact_ids": ["lc", "lp"]})
    return original


def test_learning_is_literal_and_reviewed_not_a_project_or_certificate():
    original = add_learning(career_data()); result = run(original)
    for title, fid in [("Professional Development", "lc"), ("Learning practice", "lp")]:
        assert next(s for s in result.sections if s.title == title).entries[0].text == next(f["text"] for f in original["evidence"] if f["id"] == fid)
    assert len(next(s for s in result.sections if s.title == "Projects").entries) == 2
    link = next(l for l in result.role_alignment.links if l.name == "SQL")
    assert {e.kind for e in link.examples} == {"course_completion", "course_practice"}
    assert skill_names(result)[0] == "SQL"


def test_completed_learning_cannot_be_used_as_a_summary_achievement():
    result = run(add_learning(career_data()), CareerProvider(lambda o, _: o.update(summary=[{"fact_id": "lc", "text": "Self-recorded course completion: Data tools. All chapters recorded at 100%; not external certification."}])))
    assert "career_summary_unavailable" in result.notices


@pytest.mark.parametrize("corrupt", [
    lambda m: m["skill_sources"].pop(),
    lambda m: m["skill_sources"].append(copy.deepcopy(m["skill_sources"][0])),
    lambda m: m["learning_facts"][0].update(fact_id="f-4"),
    lambda m: m["skill_sources"][1]["origins"][-1].update(fact_ids=["unknown"]),
    lambda m: m["skill_sources"][1]["origins"][0].update(fact_ids=["f-4"]),
])
def test_bad_provenance_fails_before_provider(corrupt):
    original = add_learning(career_data()); corrupt(original["source_metadata"])
    with pytest.raises(ValidationError): GenerateRequest.model_validate(original)

@pytest.mark.parametrize("code", ["2421", "2512", "4111"])
def test_fixed_career_contrast_uses_explicit_mock_references_and_distinct_objectives(code):
    import json
    from pathlib import Path
    from app.schemas.possibilities import OccupationRequirements
    from app.services.possibilities_reference import requirements_text
    manifest = json.loads((Path(__file__).parent / "fixtures/resume_career_cases.json").read_text(encoding="utf-8"))
    fixture = next(r for r in manifest["contrast_roles"] if r["occupation_code"] == code)
    target = OccupationRequirements(occupation_code=code, title=fixture["title"], skills=fixture["synthetic_requirements"], tasks=["Synthetic reference: prepare appropriate records and reports."])
    original = career_data(); original.update(occupation_code=code, job_requirements=requirements_text(target))
    def decisions(output, sent):
        output["skill_decisions"] = [{"candidate_id": row["candidate_id"], "requirement_skill_id": target.skills[0].skill_id if row["name"] in fixture["acceptable_semantic_candidates"] else None} for row in sent["skill_candidates"]]
    result = run(original, CareerProvider(decisions), target)
    assert result.role_alignment.occupation_code == code
    assert next(s for s in result.sections if s.title == "Summary").entries[0].text.startswith(f"Career objective: {fixture['title']}.")
    assert set(skill_names(result)) <= {s["name"] for s in original["skills"]}
    assert "Leadership" not in skill_names(result)
    if code == "4111": assert manifest["known_reference_gaps"][code]


def test_bundled_reference_gap_is_explicit_rather_than_fake_career_data():
    import json
    from pathlib import Path
    manifest = json.loads((Path(__file__).parent / "fixtures/resume_career_cases.json").read_text(encoding="utf-8"))
    assert {r["occupation_code"] for r in manifest["reference_snapshots"]} == {"2421", "2512", "4111"}
    office = next(r for r in manifest["reference_snapshots"] if r["occupation_code"] == "4111")
    assert office["skills"] == [] and office["tasks"] == []
    assert manifest["synthetic_only"] and not manifest["real_model_evaluation_authorized"]
    assert len(manifest["human_rubric"]["criteria"]) == 4


def test_new_career_deadline_cancels_upstream_and_returns_conservative_alignment(monkeypatch):
    from app.services import resume_generation
    monkeypatch.setattr(resume_generation, "GENERATION_BUDGET_SECONDS", 0.01)
    class SlowProvider:
        calls = 0
        cancelled = False
        async def complete_json_async(self, **kwargs):
            self.calls += 1
            try: await asyncio.Event().wait()
            except asyncio.CancelledError:
                self.cancelled = True
                raise
    provider = SlowProvider(); result = run(provider=provider)
    assert provider.calls == 1 and provider.cancelled
    assert result.outcome == "source_preserved" and "ai_timeout" in result.notices
    assert skill_names(result) == ["Analytical thinking"]
    assert all(link.method == "standard_mapping" for link in result.role_alignment.links)
    assert not any(s.title == "Summary" for s in result.sections)


def test_same_reviewed_cv_can_have_distinct_mock_role_emphasis_without_losing_facts():
    """Assembler contract, not an empirical test of real-model relevance."""
    import json
    from pathlib import Path
    from app.schemas.possibilities import OccupationRequirements
    from app.services.possibilities_reference import requirements_text
    manifest = json.loads((Path(__file__).parent / "fixtures/resume_career_cases.json").read_text(encoding="utf-8"))
    original = career_data()
    original["skills"].append({"id": "excel", "name": "Excel"})
    original["source_metadata"]["skill_sources"].append({"skill_id": "excel", "origins": [{"kind": "reviewed_resume", "label": "Original Skills", "fact_ids": ["f-1"]}]})
    expected = {"2421": ("f-9", ["p1", "p2"], {"Analytical thinking", "SQL", "Excel"}),
                "2512": ("f-10", ["p1", "p2"], {"Analytical thinking", "Programming", "SQL"}),
                "4111": ("f-12", ["p2", "p1"], {"Excel"})}
    outputs = []
    for fixture in manifest["contrast_roles"]:
        code = fixture["occupation_code"]
        target = OccupationRequirements(occupation_code=code, title=fixture["title"], skills=fixture["synthetic_requirements"], tasks=["Explicit mock reference for assembly tests."])
        source = copy.deepcopy(original)
        source.update(occupation_code=code, job_requirements=requirements_text(target))
        fid, order, names = expected[code]
        def emphasis(output, sent):
            output["skill_decisions"] = [{"candidate_id": c["candidate_id"], "requirement_skill_id": target.skills[0].skill_id if c["name"] in fixture["acceptable_semantic_candidates"] else None} for c in sent["skill_candidates"]]
            fact = next(f for f in source["evidence"] if f["id"] == fid)
            output["summary"] = [{"fact_id": fid, "text": fact["text"].lstrip("• ")}]
            output["project_order"] = order
        provider = CareerProvider(emphasis)
        result = run(source, provider, target)
        assert len(provider.calls) == 1
        assert set(skill_names(result)) == names
        assert result.role_alignment.summary_fact_ids == [fid]
        projects = next(s for s in result.sections if s.title == "Projects").entries
        assert [e.project_id for e in projects] == order
        for entry in projects:
            reviewed = next(p for p in source["source_projects"] if p["id"] == entry.project_id)
            assert entry.project.name == reviewed["name"] and entry.project.date == reviewed["date"]
            assert entry.fact_ids == reviewed["fact_ids"]
            assert entry.project.highlights == [next(f["text"] for f in source["evidence"] if f["id"] == ref).lstrip("• ") for ref in reviewed["highlight_fact_ids"]]
        outputs.append(result)
    assert len({tuple(o.role_alignment.summary_fact_ids) for o in outputs}) == 3
    assert len({tuple(o.role_alignment.project_order) for o in outputs}) == 2
