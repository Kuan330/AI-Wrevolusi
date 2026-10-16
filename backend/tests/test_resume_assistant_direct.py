"""Direct editing, conservative scoping and context-size regressions."""
from copy import deepcopy
import json
import pytest
from pydantic import ValidationError
from app.schemas.resume import AssistRequest
from app.services.resume_assistant_patches import PROMPT, compact_context
from app.services.resume_errors import GenerationFailure, GenerationRejected
from tests.test_resume_assistant_async import DOC, GOOD, Provider, request, run


@pytest.mark.parametrize("instruction", ["Shorten the Skills section", "Highlight my skills for the target role", "精简技能描述"])
def test_section_scope_keeps_original_ids(instruction):
    req = request(skills=[{"id": "sql", "name": "SQL"}])
    req.instruction = instruction
    provider = Provider()
    assert run(provider, req).result_kind == "edit"
    payload = provider.calls[0]["payload"]
    assert payload["scope"] == "sections"
    assert [s["section_index"] for s in payload["sections"]] == [0]
    assert [row["id"] for row in payload["sections"][0]["entries"]] == ["e0", "e1"]
    assert "design" not in payload and payload["design_paths"] == []
    assert len(payload["skills"]) == 1


def test_experience_scope_omits_skills_but_preserves_nonzero_index():
    req = request(skills=[{"id": "sql", "name": "SQL"}])
    req.instruction = "Polish work experience"
    payload, originals, _ = compact_context(req, [])
    assert payload["skills"] == []
    assert payload["sections"][0]["section_index"] == 1
    assert payload["sections"][0]["entries"][0]["id"] == "e2"
    assert len(originals) == 5


@pytest.mark.parametrize("instruction", ["Use the moderncv theme with a clean blue colour palette.", "把字体改成 Arial"])
def test_design_scope_excludes_content_history_and_career(instruction):
    req = request()
    req.instruction = instruction
    req.target_context = "Data analyst"
    req.history = []
    provider = Provider([{"message": "Updated", "design": [{"path": ["theme"], "value": "moderncv"}]}])
    assert run(provider, req).design
    payload = provider.calls[0]["payload"]
    assert payload["scope"] == "design"
    assert payload["sections"] == payload["skills"] == payload["history"] == []
    assert "target_context" not in payload and "Acme" not in json.dumps(payload)
    assert payload["design_paths"] and payload["design"] == DOC["design"]


@pytest.mark.parametrize("instruction", ["Optimize this resume", "优化一下", "更专业", "Make it shorter", "Refine everything, especially skills", "Improve summary based on experience", "Polish skills and use moderncv"])
def test_general_mixed_or_context_dependent_instructions_keep_full_context(instruction):
    req = request()
    req.instruction = instruction
    payload, _, _ = compact_context(req, [["theme"]])
    assert payload["scope"] == "full" and len(payload["sections"]) == 3


@pytest.mark.parametrize("instruction,patch", [
    ("Polish experience", GOOD),
    ("Use moderncv theme", GOOD),
    ("Shorten skills", {"message": "Changed", "design": [{"path": ["theme"], "value": "moderncv"}]}),
])
def test_out_of_scope_edits_rejected_twice(instruction, patch):
    req = request()
    req.instruction = instruction
    provider = Provider([patch])
    with pytest.raises(GenerationRejected):
        run(provider, req)
    assert len(provider.calls) == 2 and req.document == DOC


@pytest.mark.parametrize("output", [
    {"message": "Would you like me to improve the wording?"},
    {"message": "Updated the resume.", "result_kind": "edit"},
    {"message": "Please provide your preferred style.", "result_kind": "no_change"},
    {"message": "你希望修改什么？", "result_kind": "unsupported"},
    {**GOOD, "result_kind": "no_change"},
    {**GOOD, "sections": [{"section_index": 0, "updates": [{"entry_id": "e0", "entry": {"bullet": "Knowledge of SQL"}, "source_ids": ["e0"]}]}]},
])
def test_questions_or_claimed_edits_without_effective_patches_get_one_repair(output):
    provider = Provider([output, GOOD])
    result = run(provider)
    assert len(provider.calls) == 2 and result.result_kind == "edit"
    assert "?" not in result.message
    assert provider.calls[1]["payload"]["repair_feedback"]["code"] == "ai_output_invalid"
    assert "NEVER ask questions" in provider.calls[0]["system_prompt"]


def test_two_empty_edit_responses_fail_without_changing_document():
    req = request()
    provider = Provider([{"message": "Updated everything."}])
    with pytest.raises(GenerationFailure) as exc:
        run(provider, req)
    assert exc.value.code == "ai_output_invalid" and len(provider.calls) == 2
    assert req.document == DOC


@pytest.mark.parametrize("kind,limitation", [("no_change", None), ("unsupported", "missing_facts"), ("unsupported", "unsupported_edit")])
def test_honest_nonediting_results_do_not_retry(kind, limitation):
    provider = Provider([{"message": "A short statement.", "result_kind": kind, "limitation": limitation}])
    result = run(provider)
    assert result.result_kind == kind and result.limitation == limitation
    assert not result.sections and not result.design and len(provider.calls) == 1


def test_partial_edits_keep_limitation_and_do_not_surface_model_questions():
    result = run(Provider([{**GOOD, "message": "Which qualification should I add?", "limitation": "missing_facts"}]))
    assert result.sections and result.limitation == "missing_facts" and "?" not in result.message


def test_history_is_last_two_complete_pairs_and_target_is_separate():
    data = request().model_dump()
    data.update(instruction="Refine", target_context="Analyst", history=[{"role": role, "content": f"{index}-{role}"} for index in range(5) for role in ("user", "assistant")])
    req = AssistRequest.model_validate(data)
    payload, _, _ = compact_context(req, [])
    assert [h["content"] for h in payload["history"]] == ["3-user", "3-assistant", "4-user", "4-assistant"]
    assert payload["instruction"] == "Refine" and payload["target_context"] == "Analyst"
    data["target_context"] = "private@example.test"
    with pytest.raises(ValidationError):
        AssistRequest.model_validate(data)


def test_scoped_payload_size_is_measured_against_same_full_document():
    doc = deepcopy(DOC)
    doc["cv"]["sections"]["Projects"] *= 20
    req = request(doc)
    full, _, _ = compact_context(req, [["theme"]])
    req.instruction = "Shorten Skills"
    scoped, _, _ = compact_context(req, [["theme"]])
    full_bytes, scoped_bytes = (len(json.dumps(value).encode()) for value in (full, scoped))
    assert scoped_bytes < full_bytes / 2
    print(f"synthetic_scope full_bytes={full_bytes} scoped_bytes={scoped_bytes} reduction_pct={100 * (1 - scoped_bytes / full_bytes):.1f}")


def test_prompt_defaults_are_direct_and_fact_preserving():
    assert "for shortening remove redundant wording" in PROMPT
    assert "professional tone use concise formal resume language" in PROMPT
    assert "Preserve all skills" in PROMPT
