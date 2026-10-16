"""Providers need row shapes even when runtime validation isolates bad rows."""
import pytest

from app.schemas.resume import ResumeCareerEnvelope
from app.schemas.resume_learning import LearningSkillsEnvelope
from app.services.resume_role_generation import validated_components


@pytest.mark.parametrize("field,required", [
    ("patches", {"fact_id", "text"}),
    ("summary", {"fact_id", "text"}),
    ("skill_decisions", {"candidate_id", "requirement_skill_id", "task_id"}),
    ("evidence_links", {"candidate_id", "fact_id", "quote"}),
    ("gaps", {"id", "label", "keywords", "skill_slugs"}),
])
def test_career_provider_schema_names_each_row_field(field, required):
    schema = ResumeCareerEnvelope.model_json_schema()
    assert required <= schema["properties"][field]["items"]["properties"].keys()


def test_curriculum_provider_schema_describes_nested_skill_references():
    course = LearningSkillsEnvelope.model_json_schema()["properties"]["courses"]["items"]
    assert {"course_id", "skills"} <= course["properties"].keys()
    skill = course["properties"]["skills"]["items"]
    assert skill["required"] == ["name", "quote"]
    assert skill["additionalProperties"] is False


def test_described_schema_still_isolates_invalid_components():
    output, notices = validated_components({
        "patches": [{"fact_id": "original", "text": "Built 12 reports."}, {"fact_id": "bad", "text": 3}],
        "summary": "invalid component",
        "project_order": ["original-project"],
    }, aggregate=True)
    assert [row.fact_id for row in output.patches] == ["original"]
    assert output.summary == [] and output.project_order == ["original-project"]
    assert set(notices) == {"unsupported_polish", "career_summary_unavailable"}
    envelope = LearningSkillsEnvelope.model_validate({"courses": [{"course_id": "one", "skills": [{"unexpected": "bad row"}]}]})
    assert envelope.courses[0]["skills"] == [{"unexpected": "bad row"}]


def test_summary_candidates_match_the_grounding_validator():
    import asyncio
    from app.schemas.resume import GenerateRequest
    from app.services.resume_career import summary_fact_ids
    from app.services.resume_generation import generate_reviewed_resume
    from tests.test_resume_skill_aggregation import request_data, Provider
    from tests.test_resume_new_skills import event_role
    request = GenerateRequest.model_validate(request_data())
    provider = Provider()
    asyncio.run(generate_reviewed_resume(request, provider, event_role()))
    sent = provider.calls[0]["payload"]
    eligible = summary_fact_ids(request)
    assert set(sent["summary_fact_ids"]) == eligible
    assert "f-4" in eligible and "f-9" in eligible
    assert "f-1" not in eligible and "f-8" not in eligible
    assert "copy the chosen fact verbatim" in provider.calls[0]["system_prompt"]
