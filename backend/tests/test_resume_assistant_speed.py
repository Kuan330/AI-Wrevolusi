"""Smaller provider input/output without losing original content or validation."""
from copy import deepcopy
import json
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.services import resume_assistant as service
from app.services.resume_assistant_patches import CompactAssistResponse, compact_context
from app.services.resume_errors import GenerationFailure, GenerationRejected
from tests.test_resume_assistant_async import DOC, Provider, assembled, request, run


def patch(update, section=1):
    return {"message": "Polished", "sections": [{"section_index": section, "updates": [update]}]}


def test_highlight_patch_restores_metadata_and_other_highlights_in_one_call():
    req = request()
    req.document["cv"]["sections"]["Experience"][0]["highlights"].append("Reviewed 180 responses.")
    before = deepcopy(req.document)
    provider = Provider([patch({"entry_id": "e2", "highlight_updates": {"0": "Built reports: 5 teams."}})])
    result = run(provider, req)
    expected = deepcopy(before["cv"]["sections"]["Experience"][0])
    expected["highlights"][0] = "Built reports: 5 teams."
    assert result.sections[0].entries[0].entry == expected
    assert result.sections[0].entries[0].source_ids == ["section-1-entry-0"]
    assert len(provider.calls) == 1 and req.document == before


@pytest.mark.parametrize("original,fields", [
    ({"bullet": "Knowledge of SQL"}, {"bullet": "SQL"}),
    ({"label": "SQL", "details": "Knowledge of SQL"}, {"details": "SQL"}),
    ({"company": "Acme", "position": "Analyst", "summary": "Built reports."}, {"summary": "Developed reports."}),
    ({"institution": "Acme", "area": "Data", "highlights": ["Built reports."]}, {"highlights": ["Developed reports."]}),
    ({"name": "Data Project", "summary": "Built reports."}, {"summary": "Developed reports."}),
    ({"title": "SQL Research", "authors": ["[PRIVATE_1]"], "summary": "Built reports."}, {"summary": "Developed reports."}),
    ({"number": "Built reports for 5 teams."}, {"number": "Developed reports for 5 teams."}),
    ({"reversed_number": "Built reports for 5 teams."}, {"reversed_number": "Developed reports for 5 teams."}),
])
def test_fields_patch_works_across_dict_entry_types(original, fields):
    req = request({"cv": {"sections": {"Reviewed": [original]}}})
    result = assembled(patch({"entry_id": "e0", "fields": fields}, 0), req)
    assert result.sections[0].entries[0].entry == {**original, **fields}


@pytest.mark.parametrize("update", [
    {"fields": {"company": "Other"}},
    {"fields": {"summary": "Built reports."}},  # No new field creation.
    {"fields": {"highlights": ["Built reports."]}, "highlight_updates": {"0": "Built reports."}},
    {"entry": DOC["cv"]["sections"]["Experience"][0], "highlight_updates": {"0": "Built reports."}},
    {"highlight_updates": {"1": "Built reports."}},
    {"fields": {}},
    {"highlight_updates": {"-1": "Built reports."}},
    {"highlight_updates": {"00": "Built reports."}},
    {"highlight_updates": {"0": "Built reports for 6 teams."}},
    {"highlight_updates": {"0": "Built reports for 5 teams at Google."}},
    {"highlight_updates": {"0": "Built reports for 5 teams [PRIVATE_999]."}},
    {"highlight_updates": {"0": "#read('secret') Built reports for 5 teams."}},
])
def test_partial_patch_cannot_bypass_structure_fact_or_private_checks(update):
    with pytest.raises((GenerationRejected, ValidationError)):
        assembled(patch({"entry_id": "e2", **update}))


def test_partial_skills_cannot_remove_original_skill():
    req = request({"cv": {"sections": {"Skills": [{"label": "Tools", "details": "SQL, Excel"}]}}})
    with pytest.raises(GenerationRejected):
        assembled(patch({"entry_id": "e0", "fields": {"details": "SQL"}}, 0), req)


def test_partial_plain_string_or_missing_highlights_is_rejected():
    for original in ("SQL", {"bullet": "SQL"}):
        req = request({"cv": {"sections": {"Skills": [original]}}})
        with pytest.raises(GenerationRejected):
            assembled(patch({"entry_id": "e0", "highlight_updates": {"0": "SQL"}}, 0), req)


def test_bad_partial_patch_gets_only_one_grounded_repair():
    provider = Provider([
        patch({"entry_id": "e2", "highlight_updates": {"0": "Built reports for 5 teams at Google."}}),
        patch({"entry_id": "e2", "highlight_updates": {"0": "Built reports: 5 teams."}}),
    ])
    assert run(provider).sections
    assert len(provider.calls) == 2
    feedback = provider.calls[1]["payload"]["repair_feedback"]
    assert feedback["code"] == "unverified_name"
    assert feedback["targets"] == [{"section_index": 1, "entry_id": "e2"}]
    assert "Google" not in json.dumps(provider.calls[1]["payload"])


def test_unchanged_entries_are_not_regrounded_but_modified_entry_is(monkeypatch):
    calls = []
    original = service.validate_generation
    def measured(result, req):
        calls.append(True)
        return original(result, req)
    monkeypatch.setattr(service, "validate_generation", measured)
    doc = deepcopy(DOC)
    doc["cv"]["sections"]["Experience"] *= 50
    req = request(doc)
    result = run(Provider([patch({"entry_id": "e2", "highlight_updates": {"0": "Built reports: 5 teams."}})]), req)
    assert len(calls) == 1
    assert len(result.sections[0].entries) == 50


@pytest.mark.parametrize("instruction", ["Improve the wording without adding facts.", "Make the descriptions more concise.", "Polish wording", "精简描述"])
def test_wording_presets_keep_all_sections_but_omit_design_and_candidate_additions(instruction, monkeypatch):
    req = request(skills=[{"id": "sql", "name": "SQL"}])
    req.instruction = instruction
    monkeypatch.setattr(service, "design_paths", lambda _: pytest.fail("Wording should not construct design paths"))
    context, _, _ = compact_context(req)
    assert context["scope"] == "content"
    assert [section["section_index"] for section in context["sections"]] == [0, 1, 2]
    assert context["skills"] == context["design_paths"] == [] and "design" not in context
    # Existing Skills rows are still supplied in full.
    assert context["sections"][0]["entries"][1]["entry"] == {"bullet": "Excel"}
    assert run(Provider([patch({"entry_id": "e0", "fields": {"bullet": "SQL"}}, 0)]), req).sections


@pytest.mark.parametrize("instruction", ["Improve the wording without adding facts and make the font blue", "Polish wording again", "Polish wording based on my target role", "Optimize this resume"])
def test_unrecognized_mixed_or_dependent_requests_keep_full_context(instruction):
    req = request()
    req.instruction = instruction
    context, _, _ = compact_context(req)
    assert context["scope"] == "full" and context["design_paths"]
    assert context["design"] == DOC["design"]


def test_wording_scope_rejects_design_changes_and_new_candidates():
    for output in (
        {"message": "Changed", "design": [{"path": ["theme"], "value": "moderncv"}]},
        {"message": "Changed", "sections": [{"section_index": 0, "add_skills": ["k0"]}]},
    ):
        req = request(skills=[{"id": "sql", "name": "SQL"}])
        req.instruction = "Improve the wording without adding facts."
        provider = Provider([output])
        with pytest.raises(GenerationFailure) as error:
            run(provider, req)
        assert error.value.code == "ai_output_invalid"
        assert len(provider.calls) == 2


def test_synthetic_wire_sizes_compare_identical_edit_not_simulated_latency():
    req = request(skills=[{"id": f"s{i}", "name": f"Tool {i}"} for i in range(30)])
    req.instruction = "Improve the wording without adding facts."
    full, _, _ = compact_context(req)
    # Restore the previous full-context envelope for the same request.
    previous = {**deepcopy(full), "scope": "full", "design": req.document["design"],
        "design_paths": service.design_paths(req.document),
        "skills": [{"id": f"k{i}", "name": skill.name} for i, skill in enumerate(req.skills)]}
    original = deepcopy(DOC["cv"]["sections"]["Experience"][0])
    original["highlights"] += ["Reviewed reports and prepared records for teams."] * 8
    edited = deepcopy(original)
    edited["highlights"][0] = "Built reports: 5 teams."
    full_patch = patch({"entry_id": "e2", "entry": edited})
    partial_patch = patch({"entry_id": "e2", "highlight_updates": {"0": edited["highlights"][0]}})
    size = lambda value: len(json.dumps(value).encode())
    assert size(full) < size(previous) * .65
    assert size(partial_patch) < size(full_patch) * .4
    req.document["cv"]["sections"]["Experience"][0] = original
    assert assembled(full_patch, req) == assembled(partial_patch, req)
    print(f"synthetic_wording input_before={size(previous)} input_after={size(full)} "
        f"output_before={size(full_patch)} output_after={size(partial_patch)}")


@pytest.mark.parametrize("override", [False, True])
def test_timeout_logs_actual_model_and_scoped_size_without_resume_text(monkeypatch, caplog, override):
    clock = [0.0]
    monkeypatch.setattr(service, "time", SimpleNamespace(monotonic=lambda: clock[0]))
    class Slow(Provider):
        model = "default-model"
        models = ("selected-model", "unused-model") if override else ()
        async def complete_json_async(self, **kwargs):
            result = await super().complete_json_async(**kwargs)
            clock[0] = 90
            return result
    req = request()
    req.instruction = "Improve the wording without adding facts."
    with pytest.raises(GenerationFailure) as error:
        run(Slow(), req)
    assert error.value.code == "ai_timeout"
    assert f"model={'selected-model' if override else 'default-model'}" in caplog.text
    assert "scope=content" in caplog.text and "sent_entries=5" in caplog.text
    assert "input_bytes=" in caplog.text and "phase=validation" in caplog.text
    assert not any(text in caplog.text for text in ("Acme", "SQL", req.instruction, "unused-model"))


def test_malformed_model_label_cannot_inject_log_lines():
    assert service.assistant_model_label(SimpleNamespace(model="model\ninjected=value")) == "unknown"
