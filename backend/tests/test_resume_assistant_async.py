"""Offline compact-edit/90-second budget regressions; no live AI or real waits."""
import asyncio
from copy import deepcopy
import json
from types import SimpleNamespace
import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.schemas.resume import AssistRequest
from app.services import resume_assistant as service
from app.services.resume_assistant_patches import CompactAssistResponse, compact_context, assemble_assistance
from app.services.resume_errors import GenerationFailure, GenerationRejected
from app.services.ai_gateway import AIProviderError, OpenAICompatibleProvider
from app.services.auth import get_current_user
from app.routers.resume import router, get_resume_provider, assist

DOC = {"cv": {"sections": {"Skills": [{"bullet": "Knowledge of SQL"}, {"bullet": "Excel"}],
    "Experience": [{"company": "Acme", "position": "Analyst", "start_date": "2022-01", "end_date": "2023-01", "highlights": ["Built reports for 5 teams."]}],
    "Projects": [{"name": "Data Project", "date": "Apr 2026", "highlights": ["Built reports for 5 teams."]}, {"name": "Survey Project", "date": "Nov 2025", "highlights": ["Reviewed 180 responses."]}]}}, "design": {"theme": "classic"}}
GOOD = {"message": "Shortened wording.", "sections": [{"section_index": 0, "updates": [{"entry_id": "e0", "entry": {"bullet": "SQL"}, "source_ids": ["e0"]}]}]}

def request(doc=None, skills=None):
    return AssistRequest(instruction="Refine wording", document=deepcopy(doc or DOC), skills=skills or [], context_mode="auto_redacted")

class Provider:
    def __init__(self, outputs=None):
        self.outputs, self.calls, self.cancelled = outputs or [GOOD], [], False
    async def complete_json_async(self, **kwargs):
        self.calls.append(deepcopy(kwargs))
        output = self.outputs[min(len(self.calls)-1, len(self.outputs)-1)]
        if isinstance(output, BaseException): raise output
        return deepcopy(output)
    def complete_json(self, **kwargs): raise AssertionError("Threadpool transport must not be used")

def run(provider, req=None):
    return asyncio.run(service.assist_resume_async(req or request(), provider))

def assembled(patch, req=None):
    req = req or request()
    _, originals, skills = compact_context(req, [])
    return assemble_assistance(CompactAssistResponse.model_validate(patch), req, originals, skills)

def test_compact_update_restores_all_untouched_entries_and_sections(caplog):
    req = request()
    provider = Provider()
    result = run(provider, req)
    assert [e.entry for e in result.sections[0].entries] == [{"bullet": "SQL"}, {"bullet": "Excel"}]
    assert result.sections[0].entries[1].source_ids == ["section-0-entry-1"]
    assert req.document == DOC
    payload = provider.calls[0]["payload"]
    assert "document" not in payload and "context_reviewed" not in payload
    assert len(payload["sections"]) == 3 and len(payload["sections"][2]["entries"]) == 2
    assert provider.calls[0]["response_model"] is CompactAssistResponse
    assert 89 < provider.calls[0]["request_timeout_s"] <= 90
    assert "Acme" not in caplog.text and "SQL" not in caplog.text

@pytest.mark.parametrize("original,edited", [
    ({"bullet":"Knowledge of SQL"},{"bullet":"SQL"}), ("Knowledge of SQL","SQL"),
    ({"label":"SQL","details":"Knowledge of SQL"},{"label":"SQL","details":"SQL"}),
    ({"company":"Acme","position":"Analyst","highlights":["Built reports."]},{"company":"Acme","position":"Analyst","highlights":["Developed reports."]}),
    ({"institution":"Acme","area":"Data","summary":"Built reports."},{"institution":"Acme","area":"Data","summary":"Developed reports."}),
    ({"name":"Data Project","summary":"Built reports."},{"name":"Data Project","summary":"Developed reports."}),
    ({"title":"SQL Research","authors":["[PRIVATE_1]"],"summary":"Built reports."},{"title":"SQL Research","authors":["[PRIVATE_1]"],"summary":"Developed reports."}),
    ({"number":"Built reports for 5 teams."},{"number":"Developed reports for 5 teams."}),
    ({"reversed_number":"Built reports for 5 teams."},{"reversed_number":"Developed reports for 5 teams."}),
])
def test_nine_entry_types(original, edited):
    req = request({"cv":{"sections":{"Reviewed section":[original]}}})
    patch = {"message":"Refined", "sections":[{"section_index":0,"updates":[{"entry_id":"e0","entry":edited,"source_ids":["e0"]}]}]}
    assert assembled(patch, req).sections[0].entries[0].entry == edited

@pytest.mark.parametrize("patch", [
    {"section_index":0,"delete":["e0"],"order":["e1"]},
    {"section_index":0,"order":["e1","e0"]},
    {"section_index":0,"delete":["e0","e1"],"order":[]},
])
def test_explicit_delete_and_complete_reorder(patch):
    result = assembled({"message":"Changed", "sections":[patch]})
    expected = patch["order"]
    assert [e.source_ids[0] for e in result.sections[0].entries] == [f"section-0-entry-{eid[1:]}" for eid in expected]

@pytest.mark.parametrize("bad", [
    {"section_index":0,"updates":[{"entry_id":"e999","entry":{"bullet":"SQL"},"source_ids":["e999"]}]},
    {"section_index":0,"updates":[{"entry_id":"e0","entry":{"bullet":"SQL"},"source_ids":["e0","e0"]}]},
    {"section_index":0,"updates":[{"entry_id":"e0","entry":{"bullet":"SQL"},"source_ids":["e1"]}]},
    {"section_index":0,"updates":[{"entry_id":"e0","entry":{"bullet":"SQL"},"source_ids":["e0","e2"]}]},
    {"section_index":0,"delete":["e2"]}, {"section_index":0,"delete":["e0","e0"]},
    {"section_index":0,"order":["e0"]}, {"section_index":0,"order":["e0","e0"]},
    {"section_index":0,"order":["e0","e1","e999"]}, {"section_index":0,"order":[]},
    {"section_index":0,"add_skills":["k99"]}, {"section_index":1,"add_skills":["k0"]},
    {"section_index":0,"add_skills":["k0","k0"]},
    {"section_index":0,"updates":[{"entry_id":"e0","entry":{"text":"SQL"},"source_ids":["e0"]}]},
    {"section_index":0,"delete":["e0"],"updates":[{"entry_id":"e0","entry":{"bullet":"SQL"},"source_ids":["e0"]}]},
    {"section_index":0,"updates":[{"entry_id":"e0","entry":{"bullet":"SQL"},"source_ids":["e0"]}]*2},
])
def test_unknown_duplicate_cross_section_or_ambiguous_references_rejected(bad):
    with pytest.raises(GenerationRejected): assembled({"message":"Changed","sections":[bad]}, request(skills=[{"id":"sql","name":"SQL"}]))

@pytest.mark.parametrize("patch", [
    {"message":"Changed", "sections":[{"section_index":0},{"section_index":0}]},
    {"message":"Changed", "sections":[{"section_index":49}]},
    {"message":"Changed", "design":[{"path":["templates","normal_entry"],"value":"#read('secret')"}]},
])
def test_sections_and_unsafe_design(patch):
    with pytest.raises(GenerationRejected): assembled(patch)

@pytest.mark.parametrize("name", ["Reading, writing and mathematics", "SQL"])
def test_added_skills_canonical_names_only_and_keep_order(name):
    req = request(skills=[{"id":"user-skill","name":name}])
    result = assembled({"message":"Added", "sections":[{"section_index":0,"add_skills":["k0"],"order":["e1","k0","e0"]}]}, req)
    assert [e.entry for e in result.sections[0].entries] == [{"bullet":"Excel"}, {"bullet":name}, {"bullet":"Knowledge of SQL"}]
    assert result.sections[0].entries[1].source_ids == ["skill-user-skill"]

@pytest.mark.parametrize("field,value", [("name","New Project"),("date","May 2026"),("highlights",["Built reports for 6 teams."]),("highlights",["Built reports for teams."]),("highlights",["Reviewed 180 responses."])])
def test_project_identity_numbers_and_cross_project_prose_protected(field,value):
    old=deepcopy(DOC["cv"]["sections"]["Projects"][0]); old[field]=value
    patch={"message":"Changed","sections":[{"section_index":2,"updates":[{"entry_id":"e3","entry":old,"source_ids":["e3"]}]}]}
    with pytest.raises(GenerationRejected): assembled(patch)

@pytest.mark.parametrize("text", ["Expert SQL","Certified SQL","SQL for 12 years","Python","[PRIVATE_999] SQL","#read('secret')"])
def test_claims_private_tokens_and_unsafe_content_stay_rejected(text):
    bad=deepcopy(GOOD);bad["sections"][0]["updates"][0]["entry"]={"bullet":text}
    with pytest.raises(GenerationRejected): assembled(bad)


def test_noop_does_not_emit_full_unchanged_section():
    bad=deepcopy(GOOD);bad["sections"][0]["updates"][0]["entry"]={"bullet":"Knowledge of SQL"}
    assert not assembled(bad).sections


def test_eighty_limit_is_not_truncated():
    req=request({"cv":{"sections":{"Skills":[{"bullet":"SQL"}]*80}}},[{"id":"extra","name":"SQL"}])
    with pytest.raises(GenerationRejected,match="exceeds"):
        assembled({"message":"Added","sections":[{"section_index":0,"add_skills":["k0"]}]},req)
    result=assembled({"message":"Removed","sections":[{"section_index":0,"delete":["e79"]}]},req)
    assert len(result.sections[0].entries)==79
    req.document["cv"]["sections"]["Skills"].append({"bullet":"SQL"})
    with pytest.raises(Exception,match="Unsupported assistant"):run(Provider(),req)


def test_one_correction_uses_original_input_only():
    bad=deepcopy(GOOD);bad["sections"][0]["updates"][0]["entry"]={"bullet":"Expert SQL"}
    provider=Provider([bad,GOOD]); result=run(provider)
    assert result.sections and len(provider.calls)==2
    first,second=[call["payload"] for call in provider.calls]
    assert "Expert SQL" not in json.dumps(second)
    assert second.pop("repair_feedback")=={"code":"unsupported_claim","fields":[["sections",0,"entries",0]]}
    assert first==second
    assert provider.calls[1]["request_timeout_s"] <= provider.calls[0]["request_timeout_s"]

@pytest.mark.parametrize("output", [{"unexpected":"DO NOT LOG"}, AIProviderError("DO NOT LOG",kind="output")])
def test_output_schema_or_parse_failure_gets_one_correction(output):
    provider=Provider([output,GOOD]); assert run(provider).sections and len(provider.calls)==2
    assert provider.calls[1]["payload"]["repair_feedback"]["code"]=="ai_output_invalid"

@pytest.mark.parametrize("error,code", [
    (AIProviderError("SECRET",kind="timeout"),"ai_timeout"),
    (AIProviderError("SECRET",kind="transport"),"ai_connection_failed"),
    (AIProviderError("SECRET",kind="http",status_code=503),"ai_provider_unavailable"),
    (AIProviderError("SECRET",kind="http",status_code=401),"ai_credentials_invalid"),
    (AIProviderError("SECRET",kind="http",status_code=403),"ai_credentials_invalid"),
    (AIProviderError("SECRET",kind="http",status_code=400),"ai_request_rejected"),
    (AIProviderError("SECRET",kind="http",status_code=429),"ai_rate_limited"),
    (AIProviderError("SECRET",kind="local_limit"),"ai_rate_limited"),
])
def test_transport_auth_timeout_do_not_correct(error,code,caplog):
    provider=Provider([error])
    with pytest.raises(GenerationFailure) as exc:run(provider)
    assert exc.value.code==code and len(provider.calls)==1 and "SECRET" not in str(exc.value) and "SECRET" not in caplog.text

@pytest.mark.parametrize("durations,success,calls", [([46],True,1),([40,49],True,2),([40,51],False,2),([86],False,1)])
def test_simulated_slow_success_shared_budget_and_minimum_repair_time(monkeypatch,durations,success,calls):
    clock=[0.0]
    monkeypatch.setattr(service,"time",SimpleNamespace(monotonic=lambda:clock[0]))
    bad=deepcopy(GOOD);bad["sections"][0]["updates"][0]["entry"]={"bullet":"Expert SQL"}
    class Timed(Provider):
        async def complete_json_async(self,**kwargs):
            result=await super().complete_json_async(**kwargs)
            clock[0]+=durations[len(self.calls)-1]
            return result
    provider=Timed([bad,GOOD] if len(durations)>1 or durations[0]==86 else [GOOD])
    if success: assert run(provider).sections
    else:
        with pytest.raises((GenerationFailure,GenerationRejected)) as exc: run(provider)
        assert exc.value.code==("unsupported_claim" if durations[0]==86 else "ai_timeout")
    assert len(provider.calls)==calls
    assert provider.calls[0]["request_timeout_s"]==90
    if calls==2:assert provider.calls[1]["request_timeout_s"]==50


def test_real_wall_timeout_cancels_coroutine_without_ninety_second_wait(monkeypatch):
    real=asyncio.timeout; budgets=[]
    monkeypatch.setattr(service.asyncio,"timeout",lambda seconds:(budgets.append(seconds) or real(seconds/1000)))
    class Slow(Provider):
        async def complete_json_async(self,**kwargs):
            self.calls.append(kwargs)
            try: await asyncio.sleep(1)
            finally: self.cancelled=True
    provider=Slow()
    with pytest.raises(GenerationFailure) as exc:run(provider)
    assert exc.value.code=="ai_timeout" and provider.cancelled and budgets==[90] and len(provider.calls)==1

@pytest.mark.parametrize("override", [False,True])
def test_default_and_model_override_http_budget_not_cut_to_initial_fortyfive(monkeypatch,override):
    from app.services import ai_gateway, model_overrides
    from app.core.config import settings
    real=httpx.AsyncClient;sent=[];created=[]
    async def handler(req):
        sent.append(json.loads(req.content))
        timeout=req.extensions["timeout"];assert 89 < timeout["read"] <= 90
        return httpx.Response(200,json={"choices":[{"message":{"content":json.dumps(GOOD)}}]})
    monkeypatch.setattr(ai_gateway.httpx,"AsyncClient",lambda **kwargs:real(transport=httpx.MockTransport(handler),**kwargs))
    def factory(model,timeout,max_tokens):
        created.append((model,timeout))
        return OpenAICompatibleProvider(api_key="synthetic",model=model,timeout_s=45,cache_size=0,max_tokens=6500)
    monkeypatch.setattr(settings,"ai_api_key","synthetic")
    monkeypatch.setattr(model_overrides,"model_provider",factory)
    provider=model_overrides.PriorityProvider(("first","second"),45,6500) if override else factory("default",45,6500)
    try:assert run(provider).sections and len(sent)==1
    finally:
        if not override:provider.close()
    assert len(created)==1 and created[0][0]==("first" if override else "default")


def test_repair_uses_same_override_model_and_closes_both_clients(monkeypatch):
    from app.services import model_overrides
    from app.core.config import settings
    monkeypatch.setattr(settings,"ai_api_key","synthetic")
    bad=deepcopy(GOOD);bad["sections"][0]["updates"][0]["entry"]={"bullet":"Expert SQL"}
    provider=Provider([bad,GOOD]);created=[];closed=[]
    class Adapter:
        async def complete_json_async(self,**kwargs):return await provider.complete_json_async(**kwargs)
        def close(self):closed.append(True)
    monkeypatch.setattr(model_overrides,"model_provider",lambda model,timeout,tokens:(created.append((model,timeout)) or Adapter()))
    assert run(model_overrides.PriorityProvider(("first","second"),45,6500)).sections
    assert [r[0] for r in created]==["first","first"] and closed==[True,True]
    assert created[1][1] <= created[0][1]


def test_asgi_disconnect_actually_cancels_http_and_closes_client(monkeypatch):
    from app.services import ai_gateway
    real=httpx.AsyncClient
    async def scenario():
        started=asyncio.Event();cancelled=asyncio.Event();clients=[]
        async def handler(req):
            started.set()
            try:await asyncio.sleep(10)
            finally:cancelled.set()
        def client(**kwargs):
            obj=real(transport=httpx.MockTransport(handler),**kwargs);clients.append(obj);return obj
        monkeypatch.setattr(ai_gateway.httpx,"AsyncClient",client)
        provider=OpenAICompatibleProvider(api_key="synthetic",model="synthetic",timeout_s=45,cache_size=0)
        async def receive():
            await started.wait();return {"type":"http.disconnect"}
        try:
            response=await assist(request(),SimpleNamespace(receive=receive),provider)
            assert response.status_code==499 and cancelled.is_set() and all(c.is_closed for c in clients)
        finally:provider.close()
    asyncio.run(scenario())


def app(provider):
    app=FastAPI();app.include_router(router,prefix="/api/v1")
    app.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id="synthetic")
    app.dependency_overrides[get_resume_provider]=lambda:provider
    return app

@pytest.mark.parametrize("error,status,code", [
    (AIProviderError("SECRET",kind="timeout"),504,"ai_timeout"),
    (AIProviderError("SECRET",kind="transport"),503,"ai_connection_failed"),
    (AIProviderError("SECRET",kind="http",status_code=401),503,"ai_credentials_invalid"),
    (AIProviderError("SECRET",kind="output"),422,"ai_output_invalid"),
])
def test_api_safe_error_classification(error,status,code):
    provider=Provider([error])
    with TestClient(app(provider)) as client:
        response=client.post("/api/v1/resume/assist",json=request().model_dump())
    assert response.status_code==status and response.json()["code"]==code
    assert response.headers["cache-control"]=="no-store" and "SECRET" not in response.text
    if code=="ai_timeout":assert response.json()["detail"]==service.ASSIST_TIMEOUT_MESSAGE


def test_full_asgi_success_returns_without_hanging_disconnect_cleanup():
    async def scenario():
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app(Provider())),base_url="http://synthetic") as client:
            async with asyncio.timeout(2):
                response=await client.post("/api/v1/resume/assist",json=request().model_dump())
        assert response.status_code==200 and len(response.json()["sections"][0]["entries"])==2
    asyncio.run(scenario())


def test_compact_wire_size_comparison_synthetic(tmp_path):
    req=request({"cv":{"sections":{"Skills":[{"bullet":"Knowledge of SQL and report analysis"} for i in range(80)]}}})
    compact=deepcopy(GOOD)
    response=assembled(compact,req)
    compact_bytes=len(json.dumps(compact).encode())
    full_bytes=len(response.model_dump_json().encode())
    assert compact_bytes < full_bytes/10
    payload,_,_=compact_context(req,[])
    assert len(payload["sections"][0]["entries"])==80
    print(f"synthetic_assist_size entries=80 compact_bytes={compact_bytes} full_bytes={full_bytes} reduction_pct={100*(1-compact_bytes/full_bytes):.1f}")
@pytest.mark.parametrize("code", ["ai_not_configured", "ai_configuration_invalid", "ai_models_invalid", "ai_credentials_invalid"])
def test_configuration_codes_are_explicit_and_do_not_trigger_correction(code):
    from app.services.model_overrides import ModelOverrideError
    provider=Provider([ModelOverrideError(code)])
    with pytest.raises(GenerationFailure) as exc:run(provider)
    assert exc.value.code==code and "unchanged" in exc.value.detail and len(provider.calls)==1


def test_two_invalid_attempts_leave_original_request_unchanged():
    provider=Provider([{"message":"Invalid", "sections":[{"section_index":0,"order":["e0"]}]}])
    req=request();original=req.model_dump()
    with pytest.raises(GenerationRejected) as exc:run(provider,req)
    assert exc.value.code=="invalid_reference" and exc.value.attempts==2
    assert len(provider.calls)==2 and req.model_dump()==original


def test_timeout_during_correction_does_not_make_third_call():
    provider=Provider([{"unexpected":"Output"},AIProviderError("SECRET",kind="timeout")])
    with pytest.raises(GenerationFailure) as exc:run(provider)
    assert exc.value.code=="ai_timeout" and exc.value.attempts==2 and len(provider.calls)==2


def test_real_read_timeout_is_not_a_validation_error(monkeypatch):
    from app.services import ai_gateway
    real=httpx.AsyncClient;calls=[]
    async def handler(req):calls.append(True);raise httpx.ReadTimeout("SECRET",request=req)
    monkeypatch.setattr(ai_gateway.httpx,"AsyncClient",lambda **kwargs:real(transport=httpx.MockTransport(handler),**kwargs))
    provider=OpenAICompatibleProvider(api_key="synthetic",model="synthetic",timeout_s=45,cache_size=0)
    try:
        with pytest.raises(GenerationFailure) as exc:run(provider)
        assert exc.value.code=="ai_timeout" and exc.value.detail==service.ASSIST_TIMEOUT_MESSAGE and len(calls)==1
    finally:provider.close()


def test_missing_configuration_api_error_is_fixed_without_secrets(monkeypatch):
    from app.main import create_app
    from app.core.config import settings
    from app.services.resume import resume_provider
    monkeypatch.setattr(settings,"ai_api_key","")
    resume_provider.cache_clear()
    application=create_app();application.dependency_overrides[get_current_user]=lambda:SimpleNamespace(id="synthetic")
    try:
        with TestClient(application) as client:
            response=client.post("/api/v1/resume/assist",json=request().model_dump())
        assert response.status_code==503 and response.json()["code"]=="ai_not_configured"
        assert "not configured" in response.json()["detail"] and "unchanged" in response.json()["detail"]
        assert response.headers["cache-control"]=="no-store"
    finally:resume_provider.cache_clear()

def test_added_skills_keep_existing_plain_text_entry_type():
    req=request({"cv":{"sections":{"Skills":["SQL"]}}},[{"id":"excel","name":"Excel"}])
    result=assembled({"message":"Added", "sections":[{"section_index":0,"add_skills":["k0"]}]},req)
    assert [e.entry for e in result.sections[0].entries]==["SQL","Excel"]


def test_unknown_private_placeholder_in_assistant_message_rejected():
    with pytest.raises(GenerationRejected):assembled({"message":"Edited [PRIVATE_999]", "sections":[]})
    req=request();req.instruction="Please edit [PRIVATE_1] without adding facts"
    assert assembled({"message":"Edited [PRIVATE_1]", "sections":[]},req).message=="Edited [PRIVATE_1]"

def test_untrusted_patch_tree_is_bounded_before_recursive_checks():
    nested="SQL"
    for _ in range(25):nested={"details":nested}
    bad=deepcopy(GOOD);bad["sections"][0]["updates"][0]["entry"]={"bullet":"SQL","details":nested}
    with pytest.raises(GenerationRejected) as exc:assembled(bad)
    assert exc.value.code=="unsafe_content"
