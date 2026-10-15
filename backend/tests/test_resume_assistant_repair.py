"""Ordinary polish uses program-owned citations and actionable compact repair."""
from copy import deepcopy
import json

import pytest
from pydantic import ValidationError

from app.services.resume_assistant_patches import CompactAssistResponse
from app.services.resume_errors import GenerationRejected
from tests.test_resume_assistant_async import DOC, GOOD, Provider, assembled, request, run


@pytest.mark.parametrize("sources", ["omitted", None])
def test_ordinary_polish_gets_own_entry_evidence_without_model_citation(sources):
    patch = deepcopy(GOOD)
    update = patch["sections"][0]["updates"][0]
    if sources == "omitted":
        del update["source_ids"]
    else:
        update["source_ids"] = None
    provider = Provider([patch])
    result = run(provider)
    assert len(provider.calls) == 1
    assert result.sections[0].entries[0].source_ids == ["section-0-entry-0"]
    assert result.sections[0].entries[0].entry == {"bullet": "SQL"}
    assert result.sections[0].entries[1].entry == DOC["cv"]["sections"]["Skills"][1]


def test_empty_explicit_sources_are_still_schema_invalid():
    patch = deepcopy(GOOD)
    patch["sections"][0]["updates"][0]["source_ids"] = []
    with pytest.raises(ValidationError):
        CompactAssistResponse.model_validate(patch)


@pytest.mark.parametrize("text", ["Expert SQL", "Python", "SQL for 12 years", "[PRIVATE_999] SQL"])
def test_implicit_evidence_does_not_bypass_fact_or_skill_checks(text):
    patch = deepcopy(GOOD)
    update = patch["sections"][0]["updates"][0]
    update.pop("source_ids")
    update["entry"] = {"bullet": text}
    with pytest.raises(GenerationRejected):
        assembled(patch)


@pytest.mark.parametrize("deleted,order", [([], None), (["e3"], None), ([], ["e4", "e3"])])
def test_grounding_repair_maps_sparse_reordered_patch_to_original_target(deleted, order):
    req = request()
    req.instruction = "Polish and reorder projects without adding facts."
    original = DOC["cv"]["sections"]["Projects"][1]
    bad = {**deepcopy(original), "highlights": ["Reviewed 180 responses for Google."]}
    good = {**deepcopy(original), "highlights": ["Reviewed responses: 180."]}
    section = {"section_index": 2, "delete": deleted,
        "updates": [{"entry_id": "e4", "entry": bad}]}
    if order is not None:
        section["order"] = order
    corrected = deepcopy(section)
    corrected["updates"][0]["entry"] = good
    provider = Provider([
        {"message": "Polished", "sections": [section]},
        {"message": "Polished", "sections": [corrected]},
    ])
    result = run(provider, req)
    assert len(provider.calls) == 2
    feedback = provider.calls[1]["payload"]["repair_feedback"]
    assert feedback["code"] == "unverified_name"
    assert feedback["fields"] == [["sections", 0, "updates", 0]]
    assert feedback["targets"] == [{"section_index": 2, "entry_id": "e4"}]
    assert "names and tool labels exactly" in feedback["hint"]
    assert "Google" not in json.dumps(provider.calls[1]["payload"])
    assert any(entry.entry == good for entry in result.sections[0].entries)
    assert req.document == DOC
    assert provider.calls[1]["request_timeout_s"] <= provider.calls[0]["request_timeout_s"]


def test_bad_explicit_reference_can_repair_with_implicit_own_evidence():
    bad = deepcopy(GOOD)
    bad["sections"][0]["updates"][0]["source_ids"] = ["e1"]
    good = deepcopy(GOOD)
    good["sections"][0]["updates"][0].pop("source_ids")
    provider = Provider([bad, good])
    result = run(provider)
    feedback = provider.calls[1]["payload"]["repair_feedback"]
    assert feedback["code"] == "invalid_reference"
    assert feedback["fields"] == [["sections", 0, "updates", 0, "source_ids"]]
    assert feedback["targets"] == [{"section_index": 0, "entry_id": "e0"}]
    assert "Omit source_ids" in feedback["hint"]
    assert result.sections[0].entries[0].source_ids == ["section-0-entry-0"]
    assert len(provider.calls) == 2


def test_unknown_target_id_is_not_replaced_with_a_valid_entry():
    bad = deepcopy(GOOD)
    update = bad["sections"][0]["updates"][0]
    update.pop("source_ids")
    update["entry_id"] = "e999"
    provider = Provider([bad])
    with pytest.raises(GenerationRejected) as error:
        run(provider)
    assert error.value.code == "invalid_reference"
    assert "targets" not in provider.calls[1]["payload"]["repair_feedback"]
    assert len(provider.calls) == 2
