"""Synthetic source and learning selections; no live AI."""
import pytest
from pydantic import ValidationError
from app.schemas.resume import GenerateRequest, GenerateResponse
from app.services.resume import generate_resume, validate_generation
from app.services.resume_assembly import assemble_generation
from app.services.resume_errors import GenerationRejected


def request():
    return GenerateRequest.model_validate({
        "job_requirements": "Management and Organization Analysts: Service orientation and customer service",
        "skills": [{"id": "excel", "name": "Excel"}, {"id": "sql", "name": "SQL"}, {"id": "learning", "name": "Creative thinking"}, {"id": "planned", "name": "Leadership and social influence"}],
        "evidence_reviewed": True,
        "evidence": [
            {"id": "s1", "text": "Excel, SQL"},
            {"id": "p1", "text": "Retail Sales Analysis | Apr 2026"},
            {"id": "h1", "text": "• Cleaned 2,400 transaction records in Excel and removed 36 duplicates."},
            {"id": "h2", "text": "• Used SQL joins to compare monthly sales by product category."},
            {"id": "h3", "text": "• Prepared pivot tables and presented three findings to a four-person team."},
            {"id": "p2", "text": "Student Survey Data Quality Review | Nov 2025"},
            {"id": "h4", "text": "• Reviewed 180 anonymous survey responses for missing values."},
            {"id": "h5", "text": "• Documented cleaning rules and prepared a one-page participation summary."},
        ],
        "source_projects": [
            {"id": "project-1", "mode": "structured", "name": "Retail Sales Analysis", "date": "Apr 2026", "fact_ids": ["p1", "h1", "h2", "h3"], "highlight_fact_ids": ["h1", "h2", "h3"]},
            {"id": "project-2", "mode": "structured", "name": "Student Survey Data Quality Review", "date": "Nov 2025", "fact_ids": ["p2", "h4", "h5"], "highlight_fact_ids": ["h4", "h5"]},
        ],
    })

class Provider:
    def __init__(self, output): self.output = output; self.calls = []
    def complete_json(self, **kw): self.calls.append(kw); return self.output

def copied_skills():
    return GenerateResponse.model_validate({"sections": [{"title": "Skills", "entries": [{"text": "Excel, SQL", "fact_ids": ["s1"]}]}]})

def test_skill_omission_reproduction_is_fixed_in_generation_not_assistant_grounding():
    req = request()
    raw = copied_skills()
    assert validate_generation(raw, req) == raw  # Shared partial-entry validator remains compatible.
    result = generate_resume(req, Provider(raw.model_dump()))
    skills = next(s for s in result.sections if s.title == "Skills")
    assert {i for entry in skills.entries for i in entry.skill_ids} == {s.id for s in req.skills}
    assert "Service orientation" not in " ".join(e.text for e in skills.entries)
    assert "proficient" not in " ".join(e.text for e in skills.entries).lower()
    projects = next(s for s in result.sections if s.title == "Projects")
    assert [e.project.name for e in projects.entries] == [p.name for p in req.source_projects]
    assert [e.project.date for e in projects.entries] == ["Apr 2026", "Nov 2025"]
    assert [len(e.project.highlights) for e in projects.entries] == [3, 2]

def project_response(req):
    p = req.source_projects[0]
    facts = {f.id: f.text for f in req.evidence}
    return GenerateResponse.model_validate({"sections": [{"title": "Projects", "entries": [{
        "text": p.name, "project_id": p.id, "fact_ids": p.fact_ids,
        "project": {"name": p.name, "date": p.date, "highlights": [facts[i] for i in p.highlight_fact_ids]},
    }]}]})

@pytest.mark.parametrize("change", ["new_project", "rename", "date", "number", "merge", "cross_project", "achievement", "credential", "unsafe", "performance", "quantity_word", "implicit_outcome", "extra_scope"])
def test_project_identity_boundaries_and_claims_cannot_change(change):
    req = request(); output = project_response(req).model_dump()
    entry = output["sections"][0]["entries"][0]
    if change == "new_project": entry["project_id"] = "invented"
    if change == "rename": entry["project"]["name"] = "New project"
    if change == "date": entry["project"]["date"] = "May 2026"
    if change == "number": entry["project"]["highlights"][0] = entry["project"]["highlights"][0].replace("36", "50")
    if change == "merge": entry["project"]["highlights"] = [" ".join(entry["project"]["highlights"])]
    if change == "cross_project": entry["fact_ids"].append("h4")
    if change == "achievement": entry["project"]["highlights"][1] += " Managed a team."
    if change == "implicit_outcome": entry["project"]["highlights"][1] += " to detect fraud."
    if change == "extra_scope": entry["project"]["highlights"][1] += " for an insurance client."
    if change == "performance": entry["project"]["highlights"][1] += " increased profits."
    if change == "quantity_word": entry["project"]["highlights"][2] = entry["project"]["highlights"][2].replace("three", "five")
    if change == "credential": entry["project"]["highlights"][1] += " Certified analyst."
    if change == "unsafe": entry["project"]["highlights"][1] += ' #read("/private")'
    with pytest.raises(GenerationRejected): assemble_generation(GenerateResponse.model_validate(output), req)

def test_valid_project_polish_preserves_individual_highlights():
    req = request(); output = project_response(req)
    output.sections[0].entries[0].project.highlights[0] = "Cleaned 2,400 transaction records in Excel; removed 36 duplicates."
    result = assemble_generation(output, req)
    project = next(s for s in result.sections if s.title == "Projects").entries[0].project
    assert project.name == req.source_projects[0].name
    assert "2,400" in project.highlights[0] and "36" in project.highlights[0]
    assert len(project.highlights) == 3

def test_ambiguous_project_is_preserved_verbatim_and_not_rewritten():
    data = request().model_dump(); data["source_projects"] = [{"id": "raw", "mode": "verbatim", "fact_ids": ["p1", "h1"], "highlight_fact_ids": []}]
    req = GenerateRequest.model_validate(data)
    result = assemble_generation(copied_skills(), req)
    entries = next(s for s in result.sections if s.title == "Projects").entries
    assert [e.text for e in entries] == [next(f.text for f in req.evidence if f.id == i) for i in ["p1", "h1"]]
    assert all(e.project is None for e in entries)

def test_project_facts_cannot_be_recast_as_work_history():
    req = request()
    output = GenerateResponse.model_validate({"sections": [{"title": "Experience", "entries": [{"text": "Cleaned records", "fact_ids": ["h1"]}]}]})
    with pytest.raises(GenerationRejected): assemble_generation(output, req)

def test_all_250_long_names_fit_without_truncation_and_punctuation_survives():
    data = request().model_dump(); data["skills"] = [{"id": str(i), "name": f"Skill {i:03} " + "x" * 145} for i in range(247)] + [{"id": "c", "name": "C"}, {"id": "cpp", "name": "C++"}, {"id": "cs", "name": "C#"}]
    req = GenerateRequest.model_validate(data)
    output = assemble_generation(GenerateResponse(sections=[]), req)
    entries = output.sections[0].entries
    assert len(entries) == 250 and all(len(e.text) <= 2000 and len(e.skill_ids) == 1 for e in entries)
    assert sum(len(e.skill_ids) for e in entries) == 250

@pytest.mark.parametrize("field,value", [("name", "Invented"), ("date", "Jan 2030"), ("fact_ids", ["missing"])])
def test_unreviewed_project_metadata_fails_input_validation(field, value):
    data = request().model_dump(); data["source_projects"][0][field] = value
    with pytest.raises(ValidationError): GenerateRequest.model_validate(data)

def test_legacy_payload_can_still_generate_without_new_metadata():
    data = request().model_dump(); del data["source_projects"]
    result = generate_resume(GenerateRequest.model_validate(data), Provider(copied_skills().model_dump()))
    assert next(s for s in result.sections if s.title == "Skills")
    assert not any(s.title == "Projects" for s in result.sections)


@pytest.mark.parametrize("count", [1, 80, 81, 250])
def test_each_skill_has_its_own_entry_and_response_roundtrips(count):
    data = request().model_dump()
    data["skills"] = [{"id": f"s-{i}", "name": f"Skill {i:03}"} for i in reversed(range(count))]
    result = assemble_generation(GenerateResponse(sections=[]), GenerateRequest.model_validate(data))
    result = GenerateResponse.model_validate_json(result.model_dump_json())
    entries = next(s for s in result.sections if s.title == "Skills").entries
    assert [(e.text, e.skill_ids, e.fact_ids) for e in entries] == [
        (f"Skill {i:03}", [f"s-{i}"], []) for i in range(count)]


def test_complete_comma_labels_and_stable_dedup_are_preserved():
    data = request().model_dump()
    data["skills"] = [
        {"id": "reading", "name": "Reading, writing and mathematics"},
        {"id": "insurance", "name": "Life, medical, motor, property, and travel insurance"},
        {"id": "sql", "name": "SQL"}, {"id": "dup", "name": "sql"}]
    result = assemble_generation(GenerateResponse(sections=[]), GenerateRequest.model_validate(data))
    entries = next(s for s in result.sections if s.title == "Skills").entries
    assert [(e.text, e.skill_ids) for e in entries] == [
        (data["skills"][1]["name"], ["insurance"]),
        (data["skills"][0]["name"], ["reading"]), ("SQL", ["sql"])]


def test_skills_capacity_does_not_relax_other_or_assistant_sections():
    from app.schemas.resume import AssistSection, GeneratedSection
    entries = [{"text": "SQL", "skill_ids": ["sql"]}] * 81
    with pytest.raises(ValidationError):
        GenerateResponse.model_validate({"sections": [{"title": "Experience", "entries": entries}]})
    with pytest.raises(ValidationError):
        GenerateResponse.model_validate({"sections": [{"title": "Skills", "entries": entries * 4}]})
    with pytest.raises(ValidationError):
        GeneratedSection(title="Skills", entries=entries)
    with pytest.raises(ValidationError):
        AssistSection(section_index=0, entries=[{"entry": {"bullet": "SQL"}, "source_ids": ["sql"]}] * 81)


def test_250_individual_skill_bullets_render_as_real_multi_page_pdf():
    import re
    from app.services.resume_render import render_pdf
    data = request().model_dump()
    data["skills"] = [{"id": f"skill-{i}", "name": f"Synthetic skill {i:03} with a long complete descriptive label"} for i in range(250)]
    data["skills"][1]["name"] = "Reading, writing and mathematics"
    result = assemble_generation(GenerateResponse(sections=[]), GenerateRequest.model_validate(data))
    entries = next(s for s in result.sections if s.title == "Skills").entries
    pdf = render_pdf({"cv": {"name": "Synthetic Example", "sections": {"Skills": [{"bullet": e.text} for e in entries]}}, "design": {"theme": "engineeringresumes"}})
    assert pdf.startswith(b"%PDF-")
    pages = re.search(rb"/Type\s*/Pages\s*/Count\s+(\d+)", pdf)
    # A single overflowing list plus two almost-empty pages is not pagination.
    assert pages and int(pages.group(1)) >= 5



def test_text_pagination_adapter_only_changes_trusted_text_block(tmp_path):
    from app.services.resume_render_safety import install_text_section_pagination
    text = "breakable: entries-allow-page-break,\n    below: sections-space-between-text-based-entries\nregular-entry: entries-allow-page-break"
    library = tmp_path / "lib.typ"
    library.write_text(text, encoding="utf-8")
    install_text_section_pagination(tmp_path)
    assert library.read_text(encoding="utf-8") == text.replace(
        "breakable: entries-allow-page-break,", 'breakable: config.at("sections-allow-page-break"),', 1)
    library.write_text("Unknown engine template", encoding="utf-8")
    with pytest.raises(RuntimeError): install_text_section_pagination(tmp_path)
