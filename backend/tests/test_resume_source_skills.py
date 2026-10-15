"""Skill source boundaries retain all labelled blocks and their original facts."""
import asyncio

import pytest

from app.schemas.resume import GenerateRequest
from app.schemas.resume_sources import section_heading
from app.services.resume_generation import generate_reviewed_resume


@pytest.mark.parametrize("heading", ["Core competencies", "Key competencies", "Technical expertise", "\u2022 Technical Skills"])
def test_skill_heading_aliases_keep_source_ownership(heading):
    assert section_heading(heading) == "Skills"
    request = GenerateRequest.model_validate({
        "job_requirements": "Target role",
        "skills": [{"id": "sql", "name": "SQL"}],
        "evidence": [{"id": "heading", "text": heading}, {"id": "skill", "text": "SQL"}],
        "evidence_reviewed": True,
        "source_sections": [{"title": "Skills", "heading_fact_id": "heading", "fact_ids": ["skill"], "polishable_fact_ids": []}],
        "source_projects": [],
    })
    assert request.source_sections[0].fact_ids == ["skill"]


@pytest.mark.parametrize("inline", ["Technical Skills: Data visualization", "\u2022 Core competencies\uff1aData visualization"])
def test_inline_skill_heading_ends_projects_and_keeps_original_fact(inline):
    request = GenerateRequest.model_validate({
        "job_requirements": "Target role",
        "skills": [{"id": "visualization", "name": "Data visualization"}],
        "evidence": [{"id": f"f-{i}", "text": text} for i, text in enumerate([
            "Projects", "Sales | Apr 2026", "- Cleaned 36 records.", inline,
        ])],
        "evidence_reviewed": True,
        "source_sections": [
            {"title": "Projects", "heading_fact_id": "f-0", "fact_ids": ["f-1", "f-2"], "polishable_fact_ids": []},
            {"title": "Skills", "heading_fact_id": None, "fact_ids": ["f-3"], "polishable_fact_ids": []},
        ],
        "source_projects": [{"id": "p1", "mode": "verbatim", "fact_ids": ["f-1", "f-2"], "highlight_fact_ids": []}],
    })

    class UnusedProvider:
        async def complete_json_async(self, **kwargs):
            pytest.fail("Verbatim project and skill blocks do not need AI polishing")

    result = asyncio.run(generate_reviewed_resume(request, UnusedProvider()))
    assert next(section for section in result.sections if section.title == "Skills").entries[0].text == "Data visualization"
    assert [entry.text for section in result.sections if section.title == "Projects" for entry in section.entries] == ["Sales | Apr 2026", "- Cleaned 36 records."]
    assert not any(section.title == "Additional information" for section in result.sections)


def test_inline_section_ownership_matches_full_source_and_polishable_boundaries():
    lines = ["Skills: SQL", "Experience: Analyst", "- Managed reports", "Summary: Experienced analyst", "Education: Example University", "Technical Skills: Python"]
    sections = [
        {"title": "Skills", "heading_fact_id": None, "fact_ids": ["f-1"], "polishable_fact_ids": []},
        {"title": "Experience", "heading_fact_id": None, "fact_ids": ["f-2", "f-3"], "polishable_fact_ids": ["f-3"]},
        {"title": "Summary", "heading_fact_id": None, "fact_ids": ["f-4"], "polishable_fact_ids": ["f-4"]},
        {"title": "Education", "heading_fact_id": None, "fact_ids": ["f-5"], "polishable_fact_ids": []},
        {"title": "Skills", "heading_fact_id": None, "fact_ids": ["f-6"], "polishable_fact_ids": []},
    ]
    request = GenerateRequest.model_validate({
        "job_requirements": "Target role",
        "skills": [{"id": "sql", "name": "SQL"}, {"id": "python", "name": "Python"}],
        "evidence": [{"id": f"f-{i}", "text": text} for i, text in enumerate(lines, 1)],
        "evidence_reviewed": True,
        "source_sections": sections,
        "source_projects": [],
    })
    assert [section.model_dump() for section in request.source_sections] == sections
    assert [fact.text for fact in request.evidence] == lines
