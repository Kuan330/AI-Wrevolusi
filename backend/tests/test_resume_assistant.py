"""Synthetic reviewed contexts; no database writes, credentials or live AI."""
from copy import deepcopy
import json
from types import SimpleNamespace
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError
from app.main import create_app
from app.schemas.resume import AssistRequest, AssistResponse
from app.services.resume_assistant import assist_resume, validate_assistance
from app.services.resume_errors import GenerationRejected
from app.services.resume_render import render_pdf
from app.services.auth import get_current_user
from app.routers.resume import get_resume_provider

DOC = {"cv": {"sections": {"Skills": [{"bullet": "Knowledge of SQL"}], "Experience": [{"company":"Acme", "position":"Analyst", "start_date":"2022-01", "end_date":"2023-01", "highlights":["Built reports for 5 teams."]}]}}, "design":{"theme":"classic"}}
REQ = {"instruction":"Make wording concise", "document":DOC, "context_reviewed": True}
GOOD = {"message":"Shortened the description.", "sections":[{"section_index":0,"entries":[{"entry":{"bullet":"SQL"},"source_ids":["section-0-entry-0"]}]}],"design":[]}
class Provider:
    def __init__(self, outputs): self.outputs, self.calls = outputs, []
    def complete_json(self, **kwargs): self.calls.append(kwargs); return deepcopy(self.outputs[min(len(self.calls)-1,len(self.outputs)-1)])

def test_good_result_once_and_no_content_cache():
    provider=Provider([GOOD]); result=assist_resume(AssistRequest.model_validate(REQ),provider)
    assert result.sections[0].entries[0].entry == {"bullet":"SQL"} and len(provider.calls)==1
    assert provider.calls[0]["request_cache_enabled"] is False
    assert provider.calls[0]["request_max_retries"]==0

def test_single_correction_only_original_context():
    bad=deepcopy(GOOD);bad["sections"][0]["entries"][0]["entry"]["bullet"]="Expert SQL"
    provider=Provider([bad,GOOD]);assist_resume(AssistRequest.model_validate(REQ),provider)
    assert len(provider.calls)==2 and "Expert SQL" not in json.dumps(provider.calls[1]["payload"])
    assert provider.calls[1]["payload"]["repair_feedback"]["code"] == "unsupported_claim"

@pytest.mark.parametrize("text", ["Expert SQL", "Certified SQL", "SQL for 12 years", "Google SQL", "Cleaned data using SQL", "Collaborated on SQL reports", "#read(\"secret\")", "[data](file:///secret)", "Python", "SQL boosted performance", "SQL optimised workflows"])
def test_unbacked_changes_rejected_twice(text):
    result=deepcopy(GOOD); result["sections"][0]["entries"][0]["entry"]["bullet"]=text
    provider=Provider([result])
    with pytest.raises(GenerationRejected):assist_resume(AssistRequest.model_validate(REQ),provider)
    assert len(provider.calls)==2

@pytest.mark.parametrize("field,value", [("company","Google"),("start_date","2025-01"),("position","Senior Analyst"),("highlights",["Built reports for 55 teams."])])
def test_names_dates_titles_numbers_stay_grounded(field,value):
    entry={**DOC["cv"]["sections"]["Experience"][0],field:value}
    result=AssistResponse.model_validate({"message":"Change", "sections":[{"section_index":1,"entries":[{"entry":entry,"source_ids":["section-1-entry-0"]}]}]})
    with pytest.raises(GenerationRejected):validate_assistance(result,AssistRequest.model_validate(REQ))

def test_private_tokens_preserved_in_nested_authors():
    document={"cv":{"sections":{"Publications":[{"title":"SQL Research","authors":["[PRIVATE_1]"],"date":"2024","journal":"Data Research"}]}},"design":{"theme":"classic"}}
    request=AssistRequest(instruction="Shorten",document=document,context_reviewed=True)
    original=document["cv"]["sections"]["Publications"][0]
    proposal=AssistResponse(message="Change",sections=[{"section_index":0,"entries":[{"entry":original,"source_ids":["section-0-entry-0"]}]}])
    validate_assistance(proposal,request)
    proposal.sections[0].entries[0].entry={**original,"authors":["Alex Doe"]}
    with pytest.raises(GenerationRejected):validate_assistance(proposal,request)

@pytest.mark.parametrize("document", [{"cv":{"name":"DO-NOT-ECHO"}}, {"cv":{"sections":{"Skills":["private@example.test"]}}}, {"cv":{"sections":{}},"settings":{"pdf_title":"private"}}])
def test_personal_or_unreviewed_context_never_sent(document):
    with pytest.raises(ValidationError):AssistRequest(instruction="Change",document=document,context_reviewed=True)
    with pytest.raises(ValidationError):AssistRequest(instruction="Change",document={"cv":{"sections":{}}})

@pytest.mark.parametrize("path,value", [(["templates","normal_entry"],"code"),(["theme"],"../custom"),(["page","size"],"invalid"),(["header","photo_width"],"1cm")])
def test_prohibited_design_rejected(path,value):
    result=AssistResponse(message="Change",design=[{"path":path,"value":value}])
    with pytest.raises(GenerationRejected):validate_assistance(result,AssistRequest.model_validate(REQ))

@pytest.mark.parametrize("theme", ["classic","moderncv","sb2nov","engineeringresumes","engineeringclassic","harvard","ember","ink","opal"])
def test_safe_theme_change_on_blank_draft(theme):
    request=AssistRequest(instruction="Adjust design",document={"cv":{"sections":{"Skills":[]}}},context_reviewed=True)
    result=AssistResponse(message="Changed theme",design=[{"path":["theme"],"value":theme}])
    assert validate_assistance(result,request).design[0].value==theme

def test_blank_draft_cannot_invent_content_but_saved_skill_can_be_used():
    document={"cv":{"sections":{"Skills":[]}}}; result=AssistResponse(message="Add SQL",sections=[{"section_index":0,"entries":[{"entry":{"bullet":"SQL"},"source_ids":["skill-sql"]}]}])
    with pytest.raises(GenerationRejected):validate_assistance(result,AssistRequest(instruction="Add SQL",document=document,context_reviewed=True))
    validate_assistance(result,AssistRequest(instruction="Add SQL",document=document,skills=[{"id":"sql","name":"SQL"}],context_reviewed=True))

def test_endpoint_safe_errors_no_database_or_logs(caplog):
    app=create_app(); provider=Provider([GOOD])
    app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id="synthetic")
    app.dependency_overrides[get_resume_provider]=lambda:provider
    with TestClient(app) as client:
        response=client.post("/api/v1/resume/assist",json=REQ)
        assert response.status_code==200 and response.headers["cache-control"]=="no-store"
        invalid=client.post("/api/v1/resume/assist",json={**REQ,"document":{"cv":{"email":"private@example.test","name":"DO-NOT-ECHO"}}})
        assert invalid.status_code==422
        assert "DO-NOT-ECHO" not in invalid.text and "private@example.test" not in invalid.text
        assert len(provider.calls)==1
    assert "DO-NOT-ECHO" not in caplog.text and "private@example.test" not in caplog.text

def test_assistant_proposal_produces_real_pdf():
    provider=Provider([GOOD]); result=assist_resume(AssistRequest.model_validate(REQ),provider)
    doc=deepcopy(DOC);doc["cv"]["sections"]["Skills"]=[e.entry for e in result.sections[0].entries]
    assert render_pdf(doc).startswith(b"%PDF")


@pytest.mark.parametrize("original,edited", [
 ({"bullet":"Knowledge of SQL"},{"bullet":"SQL"}),
 ("Knowledge of SQL","SQL"),
 ({"label":"SQL","details":"Knowledge of SQL"},{"label":"SQL","details":"SQL"}),
 ({"company":"Acme","position":"Analyst","highlights":["Built reports."]},{"company":"Acme","position":"Analyst","highlights":["Developed reports."]}),
 ({"institution":"Acme","area":"Data","summary":"Built reports."},{"institution":"Acme","area":"Data","summary":"Developed reports."}),
 ({"name":"Data Project","summary":"Built reports."},{"name":"Data Project","summary":"Developed reports."}),
 ({"title":"SQL Research","authors":["[PRIVATE_1]"],"summary":"Built reports."},{"title":"SQL Research","authors":["[PRIVATE_1]"],"summary":"Developed reports."}),
 ({"number":"Built reports for 5 teams."},{"number":"Developed reports for 5 teams."}),
 ({"reversed_number":"Built reports for 5 teams."},{"reversed_number":"Developed reports for 5 teams."}),
])
def test_nine_entry_types_support_grounded_edits(original,edited):
    request=AssistRequest(instruction="Refine wording",document={"cv":{"sections":{"My section":[original]}}},context_reviewed=True)
    result=AssistResponse(message="Refined",sections=[{"section_index":0,"entries":[{"entry":edited,"source_ids":["section-0-entry-0"]}]}])
    assert validate_assistance(result,request).sections[0].entries[0].entry==edited


def test_long_nested_entry_grounding_uses_rendercv_not_bullet_length_limits():
    highlights=["Built reports for 5 teams using SQL." for _ in range(65)]
    old={"company":"Acme","position":"Analyst","highlights":highlights}
    request=AssistRequest(instruction="Refine",document={"cv":{"sections":{"Experience":[old]}}},context_reviewed=True)
    result=AssistResponse(message="Refined",sections=[{"section_index":0,"entries":[{"entry":old,"source_ids":["section-0-entry-0"]}]}])
    assert validate_assistance(result,request).sections[0].entries[0].entry==old

def test_proposed_complexity_is_bounded_before_grounding():
    result=AssistResponse(message="Change",sections=[{"section_index":0,"entries":[{"entry":{"bullet":"x"*10001},"source_ids":["section-0-entry-0"]}]}])
    with pytest.raises(GenerationRejected) as caught:validate_assistance(result,AssistRequest.model_validate(REQ))
    assert caught.value.code=="unsafe_content"
