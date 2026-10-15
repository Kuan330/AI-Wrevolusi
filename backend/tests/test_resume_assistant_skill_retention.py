"""Existing skills cannot disappear while the assistant polishes a resume."""
from copy import deepcopy

import pytest

from app.schemas.resume import AssistRequest, AssistResponse
from app.services.resume_assistant import validate_assistance
from app.services.resume_errors import GenerationRejected
from tests.test_resume_assistant_async import GOOD, Provider, assembled, request, run


@pytest.mark.parametrize("instruction", [
    "Optimize this resume", "Shorten Skills", "Make my skills relevant to the target role",
    "Highlight SQL for this role", "Remove irrelevant skills for the SQL role",
    "Remove redundant wording in SQL", "Deduplicate skills",
    "\u4f18\u5316\u4e00\u4e0b", "\u7cbe\u7b80\u6280\u80fd\u63cf\u8ff0", "\u7a81\u51fa SQL \u76f8\u5173\u6280\u80fd",
])
@pytest.mark.parametrize("patch", [
    {"section_index": 0, "delete": ["e1"]},
    {"section_index": 0, "delete": ["e0", "e1"]},
])
def test_generic_edit_never_authorizes_skill_loss(instruction, patch):
    req = request()
    req.instruction = instruction
    with pytest.raises(GenerationRejected) as error:
        assembled({"message": "Updated", "sections": [patch]}, req)
    assert error.value.code == "unsupported_fact"


@pytest.mark.parametrize("original,edited", [
    ({"bullet": "SQL, Excel and Python"}, {"bullet": "SQL and Excel"}),
    ({"label": "Tools", "details": "SQL, Excel"}, {"label": "Tools", "details": "SQL"}),
    ("C, C++, C#, .NET, Node.js", "C, C#, .NET, Node.js"),
    ("Data analysis; Data entry; Financial analysis", "Data entry; Financial analysis"),
    ("Knowledge management; Project management", "Project management"),
    ("\u6570\u636e\u5206\u6790\u3001\u9879\u76ee\u7ba1\u7406", "\u6570\u636e\u5206\u6790"),
])
def test_rewriting_a_grouped_skill_entry_cannot_drop_names(original, edited):
    req = request({"cv": {"sections": {"Skills": [original]}}})
    patch = {"message": "Shortened", "sections": [{"section_index": 0, "updates": [
        {"entry_id": "e0", "entry": edited, "source_ids": ["e0"]},
    ]}]}
    with pytest.raises(GenerationRejected):
        assembled(patch, req)


@pytest.mark.parametrize("instruction,deleted", [
    ("Remove SQL", ["e0"]),
    ("Remove SQL from the Skills section", ["e0"]),
    ("Remove Excel but keep SQL", ["e1"]),
    ("Remove SQL and keep Excel", ["e0"]),
    ("Remove SQL, not Excel", ["e0"]),
    ("Do not remove SQL, remove Excel", ["e1"]),
    ("Remove SQL and Excel", ["e0", "e1"]),
    ("Remove the Skills section", ["e0", "e1"]),
    ("Delete all skills from my resume", ["e0", "e1"]),
    ("\u5220\u9664 SQL", ["e0"]),
    ("\u5220\u9664 SQL\uff0c\u4fdd\u7559 Excel", ["e0"]),
    ("\u5220\u9664\u6240\u6709\u6280\u80fd", ["e0", "e1"]),
])
def test_explicit_named_or_whole_section_deletion_is_allowed(instruction, deleted):
    req = request()
    req.instruction = instruction
    result = assembled({"message": "Removed", "sections": [{"section_index": 0, "delete": deleted}]}, req)
    assert len(result.sections[0].entries) == 2 - len(deleted)


@pytest.mark.parametrize("instruction", [
    "Do not remove SQL", "Don't remove SQL", "Never delete SQL", "Refine without removing SQL",
    "Avoid remove or delete actions for SQL", "Remove Excel but preserve SQL", "Remove Excel, not SQL",
    "Remove duplicate SQL", "Remove redundant descriptions around SQL", "Remove anything except SQL",
    "\u4e0d\u8981\u5220\u9664 SQL", "\u5220\u9664 Excel\uff0c\u4e0d\u8981\u5220\u9664 SQL",
])
def test_negation_other_targets_and_deduplication_cannot_authorize_losing_sql(instruction):
    req = request()
    req.instruction = instruction
    with pytest.raises(GenerationRejected):
        assembled({"message": "Removed", "sections": [{"section_index": 0, "delete": ["e0"]}]}, req)


def test_named_removal_does_not_delete_other_skills_in_the_same_entry():
    req = request({"cv": {"sections": {"Skills": [{"bullet": "SQL, Python and Excel"}]}}})
    req.instruction = "Remove SQL"
    patch = {"message": "Removed", "sections": [{"section_index": 0, "updates": [
        {"entry_id": "e0", "entry": {"bullet": "Python and Excel"}, "source_ids": ["e0"]},
    ]}]}
    assert assembled(patch, req).sections[0].entries[0].entry == {"bullet": "Python and Excel"}
    patch["sections"][0]["updates"][0]["entry"] = {"bullet": "Excel"}
    with pytest.raises(GenerationRejected):
        assembled(patch, req)


@pytest.mark.parametrize("originals,instruction,patch", [
    (["Data analysis", "Financial analysis"], "Remove Data analysis", {
        "delete": ["e0"],
        "updates": [{"entry_id": "e1", "entry": "Financial", "source_ids": ["e1"]}],
    }),
    (["SQL", "SQL Server"], "Remove SQL", {
        "delete": ["e0"],
        "updates": [{"entry_id": "e1", "entry": "Server", "source_ids": ["e1"]}],
    }),
    (["SQL", "SQL Server"], "Remove SQL Server", {"delete": ["e0", "e1"]}),
    (["Data entry", "Financial analysis", "Data analysis"], "Remove Data entry and Financial analysis", {
        "delete": ["e0", "e1", "e2"],
    }),
])
def test_removing_one_named_skill_never_authorizes_parts_of_other_skill_names(originals, instruction, patch):
    req = request({"cv": {"sections": {"Skills": originals}}})
    req.instruction = instruction
    with pytest.raises(GenerationRejected):
        assembled({"message": "Removed", "sections": [{"section_index": 0, **patch}]}, req)


@pytest.mark.parametrize("originals,instruction,deleted,remaining", [
    (["Data analysis", "Financial analysis"], "Remove Data analysis", ["e0"], ["Financial analysis"]),
    (["SQL", "SQL Server"], "Remove SQL", ["e0"], ["SQL Server"]),
    (["SQL", "SQL Server"], "Remove SQL Server", ["e1"], ["SQL"]),
    (["Data entry", "Financial analysis", "Data analysis"], "Remove Data entry and Financial analysis", ["e0", "e1"], ["Data analysis"]),
])
def test_exact_named_deletions_preserve_other_skills_with_shared_terms(originals, instruction, deleted, remaining):
    req = request({"cv": {"sections": {"Skills": originals}}})
    req.instruction = instruction
    result = assembled({"message": "Removed", "sections": [{"section_index": 0, "delete": deleted}]}, req)
    assert [entry.entry for entry in result.sections[0].entries] == remaining


@pytest.mark.parametrize("originals", [
    ["SQL", "SQL Server"], ["Data analysis", "Financial data analysis"], ["Python", "Python scripting"],
])
def test_a_longer_unchanged_skill_name_does_not_replace_a_deleted_distinct_skill(originals):
    req = request({"cv": {"sections": {"Skills": originals}}})
    with pytest.raises(GenerationRejected):
        assembled({"message": "Polished", "sections": [{"section_index": 0, "delete": ["e0"]}]}, req)


def test_legacy_combined_source_citations_cannot_hide_a_removed_distinct_skill():
    req = request({"cv": {"sections": {"Skills": ["SQL", "SQL Server"]}}})
    result = AssistResponse(message="Polished", sections=[{"section_index": 0, "entries": [
        {"entry": "SQL Server", "source_ids": ["section-0-entry-0", "section-0-entry-1"]},
    ]}])
    with pytest.raises(GenerationRejected):
        validate_assistance(result, req)


def test_existing_entry_can_keep_its_skill_within_reworded_text():
    req = request({"cv": {"sections": {"Skills": ["SQL", "SQL Server"]}}})
    result = assembled({"message": "Polished", "sections": [{"section_index": 0, "updates": [
        {"entry_id": "e0", "entry": "SQL capabilities", "source_ids": ["e0"]},
    ]}]}, req)
    assert [entry.entry for entry in result.sections[0].entries] == ["SQL capabilities", "SQL Server"]


@pytest.mark.parametrize("title,originals", [
    ("Languages", ["English", "French"]),
    ("Programming languages", ["Python", "Java"]),
    ("Technical expertise", ["SQL", "Excel"]),
    ("\u8bed\u8a00", ["English", "French"]),
])
def test_skill_and_language_heading_variants_preserve_every_skill(title, originals):
    req = request({"cv": {"sections": {title: originals}}})
    with pytest.raises(GenerationRejected):
        assembled({"message": "Polished", "sections": [{"section_index": 0, "delete": ["e1"]}]}, req)
    req.instruction = "Remove " + originals[1]
    result = assembled({"message": "Removed", "sections": [{"section_index": 0, "delete": ["e1"]}]}, req)
    assert [entry.entry for entry in result.sections[0].entries] == [originals[0]]


@pytest.mark.parametrize("instruction", [
    "Explain what would happen if I remove SQL", "Should I remove SQL?", "Can I remove SQL?",
    "How do I remove SQL?", "Polish my resume; for example, remove SQL",
    "Explain why we should remove SQL", "Polish this phrase: remove SQL",
    "\u5982\u679c\u5220\u9664 SQL \u4f1a\u600e\u4e48\u6837", "\u89e3\u91ca\u4e3a\u4ec0\u4e48\u8981\u5220\u9664 SQL",
])
def test_hypothetical_explanatory_or_example_removal_is_not_a_deletion_instruction(instruction):
    req = request()
    req.instruction = instruction
    with pytest.raises(GenerationRejected):
        assembled({"message": "Removed", "sections": [{"section_index": 0, "delete": ["e0"]}]}, req)


@pytest.mark.parametrize("instruction", ["Please remove SQL", "Can you remove SQL?", "I want you to remove SQL"])
def test_direct_polite_removal_requests_remain_supported(instruction):
    req = request()
    req.instruction = instruction
    result = assembled({"message": "Removed", "sections": [{"section_index": 0, "delete": ["e0"]}]}, req)
    assert [entry.entry for entry in result.sections[0].entries] == [{"bullet": "Excel"}]


def test_duplicate_removal_and_reordering_preserve_the_distinct_skills():
    req = request({"cv": {"sections": {"Skills": ["SQL", "SQL", "Excel"]}}})
    req.instruction = "Deduplicate and reorder Skills"
    result = assembled({"message": "Updated", "sections": [{"section_index": 0, "delete": ["e1"], "order": ["e2", "e0"]}]}, req)
    assert [entry.entry for entry in result.sections[0].entries] == ["Excel", "SQL"]


@pytest.mark.parametrize("old,new", [
    ("Knowledge of SQL and Excel", "Excel, SQL"),
    ("C++, C#, .NET, Node.js", "Node.js, .NET, C#, C++"),
    ("Problem solving and data analysis", "Data analysis; Problem solving"),
    ("Knowledge of SQL", "SQL"),
    ("Knowledge and understanding of SQL", "SQL"),
    ("Machine learning (ML)", "Machine learning"),
    ("Node.js", "Node JS"),
])
def test_wording_and_order_can_change_without_removing_skills(old, new):
    req = request({"cv": {"sections": {"Skills": [old]}}})
    result = assembled({"message": "Updated", "sections": [{"section_index": 0, "updates": [
        {"entry_id": "e0", "entry": new, "source_ids": ["e0"]},
    ]}]}, req)
    assert result.sections[0].entries[0].entry == new


@pytest.mark.parametrize("old,new", [
    ("Machine learning (Python)", "Machine learning"),
    ("Statistical analysis (SAS)", "Statistical analysis"),
    ("Node.js", "Node"),
    ("Knowledge management", "Management"),
])
def test_safe_spelling_normalization_does_not_erase_other_named_skills(old, new):
    req = request({"cv": {"sections": {"Skills": [old]}}})
    with pytest.raises(GenerationRejected):
        assembled({"message": "Polished", "sections": [{"section_index": 0, "updates": [
            {"entry_id": "e0", "entry": new, "source_ids": ["e0"]},
        ]}]}, req)


def test_missing_skills_use_the_existing_single_correction():
    bad = {"message": "Polished", "sections": [{"section_index": 0, "delete": ["e1"]}]}
    provider = Provider([bad, GOOD])
    result = run(provider)
    assert [entry.entry for entry in result.sections[0].entries] == [{"bullet": "SQL"}, {"bullet": "Excel"}]
    assert len(provider.calls) == 2
    assert provider.calls[1]["payload"]["repair_feedback"]["code"] == "unsupported_fact"
    assert provider.calls[1]["request_timeout_s"] <= provider.calls[0]["request_timeout_s"]


def test_two_omissions_fail_without_mutating_original_or_extra_requests():
    provider = Provider([{"message": "Polished", "sections": [{"section_index": 0, "delete": ["e1"]}]}])
    req = request()
    original = deepcopy(req.document)
    with pytest.raises(GenerationRejected) as error:
        run(provider, req)
    assert error.value.attempts == 2 and len(provider.calls) == 2
    assert req.document == original


def test_legacy_full_section_response_obeys_the_same_retention_rule():
    result = AssistResponse(message="Updated", sections=[{"section_index": 0, "entries": [
        {"entry": {"bullet": "SQL"}, "source_ids": ["section-0-entry-0"]},
    ]}])
    with pytest.raises(GenerationRejected):
        validate_assistance(result, request())


def test_history_does_not_authorize_a_deletion_in_the_current_instruction():
    req = AssistRequest.model_validate({**request().model_dump(), "history": [
        {"role": "user", "content": "Remove SQL"}, {"role": "assistant", "content": "Done"},
    ]})
    with pytest.raises(GenerationRejected):
        assembled({"message": "Updated", "sections": [{"section_index": 0, "delete": ["e0"]}]}, req)
