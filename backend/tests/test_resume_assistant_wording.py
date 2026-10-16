"""Real assistant orchestration and HTTP contract for the small wording path."""
import asyncio
from copy import deepcopy
import json
from types import SimpleNamespace

import httpx
import pytest

from app.schemas.resume import AssistRequest
from app.services import resume_assistant as service
from app.services.ai_gateway import OpenAICompatibleProvider
from app.services.resume_assistant_patches import CompactAssistResponse, PROMPT as GENERAL_PROMPT, compact_context
from app.services.resume_assistant_scope import recent_history
from app.services.resume_assistant_wording import WordingAssistResponse
from app.services.resume_errors import GenerationFailure, GenerationRejected
from tests.test_resume_assistant_async import DOC, Provider, request, run


GOOD = {"sections": [{"section_index": 1, "updates": [
    {"entry_id": "e2", "highlight_updates": {"0": "Built reports: 5 teams."}},
]}]}


def wording_request():
    req = request()
    req.instruction = "Improve the wording without adding facts."
    return req


def test_preset_sends_only_prose_and_restores_identity_without_another_ai_call():
    req = wording_request()
    req.target_context = "Unrelated target requirements"
    req.history = AssistRequest.model_validate({**req.model_dump(), "history": [
        {"role": "user", "content": "Unrelated previous edit"},
        {"role": "assistant", "content": "Unrelated previous result"},
    ]}).history
    original = deepcopy(req.document)
    provider = Provider([GOOD])
    result = run(provider, req)
    assert len(provider.calls) == 1
    call = provider.calls[0]
    assert call["response_model"] is WordingAssistResponse
    assert len(call["system_prompt"]) < len(GENERAL_PROMPT) / 2
    payload = call["payload"]
    assert len(payload["history"]) == 2 and "target_context" not in payload
    assert payload["history"][0]["content"] == "Unrelated previous edit"
    sent = json.dumps(payload)
    assert all(text not in sent for text in ("Acme", "Analyst", "2022-01", "Apr 2026", "Unrelated target requirements"))
    assert "SQL" in sent and "Excel" in sent and "5 teams" in sent
    edited = result.sections[0].entries[0].entry
    assert edited == {**original["cv"]["sections"]["Experience"][0], "highlights": ["Built reports: 5 teams."]}
    assert req.document == original


@pytest.mark.parametrize("kind,limitation", [("no_change", None), ("unsupported", "missing_facts")])
def test_honest_empty_wording_result_uses_one_call_without_generating_a_message(kind, limitation):
    provider = Provider([{"result_kind": kind, "limitation": limitation}])
    result = run(provider, wording_request())
    assert result.result_kind == kind and result.limitation == limitation
    assert not result.sections and len(provider.calls) == 1


@pytest.mark.parametrize("bad", [
    {"message": "Would you like me to polish this?", "result_kind": "no_change"},
    {"sections": []},
    {"design": [{"path": ["theme"], "value": "moderncv"}]},
    {"sections": [{"section_index": 1, "delete": ["e2"]}]},
    {"sections": [{"section_index": 1, "order": ["e2"]}]},
    {"sections": [{"section_index": 1, "updates": [{"entry_id": "e2", "fields": {"company": "Other"}}]}]},
    {"sections": [{"section_index": 1, "updates": [{"entry_id": "e2", "source_ids": ["e3"], "highlight_updates": {"0": "Built reports: 5 teams."}}]}]},
    {"sections": [{"section_index": 1, "updates": [{"entry_id": "e2", "entry": DOC["cv"]["sections"]["Experience"][0]}]}]},
])
def test_wording_cannot_request_questions_or_full_editor_operations(bad):
    provider = Provider([bad, GOOD])
    assert run(provider, wording_request()).sections
    assert len(provider.calls) == 2
    assert provider.calls[1]["payload"]["repair_feedback"]["code"] == "ai_output_invalid"


@pytest.mark.parametrize("text,code", [
    ("Built reports for 6 teams.", "unsupported_fact"),
    ("Built reports for 5 teams at Google.", "unverified_name"),
    ("Expert in SQL and built reports for 5 teams.", "unsupported_claim"),
    ("Built reports for 5 teams [PRIVATE_999].", "unsupported_fact"),
])
def test_changed_wording_still_passes_all_original_fact_checks(text, code):
    bad = deepcopy(GOOD)
    bad["sections"][0]["updates"][0]["highlight_updates"]["0"] = text
    req = wording_request()
    provider = Provider([bad, GOOD])
    assert run(provider, req).sections
    feedback = provider.calls[1]["payload"]["repair_feedback"]
    assert feedback["code"] == code
    assert feedback["targets"] == [{"section_index": 1, "entry_id": "e2"}]
    assert text not in json.dumps(provider.calls[1]["payload"])
    assert req.document == DOC


def test_grouped_original_skills_cannot_disappear_in_wording_contract():
    req = wording_request()
    req.document["cv"]["sections"]["Skills"][0] = {"bullet": "SQL, Python, Excel"}
    bad = {"sections": [{"section_index": 0, "updates": [{"entry_id": "e0", "fields": {"bullet": "SQL"}}]}]}
    provider = Provider([bad])
    with pytest.raises(GenerationRejected) as error:
        run(provider, req)
    assert error.value.code == "unsupported_fact" and len(provider.calls) == 2


@pytest.mark.parametrize("override", [False, True])
def test_real_gateway_sends_same_model_once_and_accepts_small_contract(monkeypatch, override):
    from app.services import ai_gateway, model_overrides
    from app.core.config import settings
    real = httpx.AsyncClient
    sent = []
    async def handler(req):
        sent.append(json.loads(req.content))
        return httpx.Response(200, json={"choices": [{"message": {"content": json.dumps(GOOD)}}]})
    monkeypatch.setattr(ai_gateway.httpx, "AsyncClient", lambda **kw: real(transport=httpx.MockTransport(handler), **kw))
    def factory(model, timeout, tokens):
        return OpenAICompatibleProvider(api_key="synthetic", model=model, timeout_s=45, cache_size=0, max_tokens=tokens)
    monkeypatch.setattr(settings, "ai_api_key", "synthetic")
    monkeypatch.setattr(model_overrides, "model_provider", factory)
    provider = model_overrides.PriorityProvider(("deepseek-v4.1-flash", "unused"), 45, 6500) if override else factory("deepseek-v4.1-flash", 45, 6500)
    try:
        assert run(provider, wording_request()).sections
    finally:
        if not override: provider.close()
    assert len(sent) == 1 and sent[0]["model"] == "deepseek-v4.1-flash"
    assert sent[0]["max_tokens"] == 6500
    assert "Acme" not in json.dumps(sent)
    schema = json.loads(sent[0]["messages"][0]["content"].splitlines()[-1])
    assert "design" not in schema["properties"]
    assert "source_ids" not in schema["$defs"]["WordingUpdate"]["properties"]


@pytest.mark.parametrize("durations,success", [([40, 49], True), ([40, 51], False)])
def test_wording_repair_and_validation_share_the_original_ninety_second_deadline(monkeypatch, durations, success):
    clock = [0.0]
    monkeypatch.setattr(service, "time", SimpleNamespace(monotonic=lambda: clock[0]))
    bad = deepcopy(GOOD)
    bad["sections"][0]["updates"][0]["highlight_updates"]["0"] = "Built reports for 6 teams."
    class Timed(Provider):
        async def complete_json_async(self, **kwargs):
            output = await super().complete_json_async(**kwargs)
            clock[0] += durations[len(self.calls) - 1]
            return output
    provider = Timed([bad, GOOD])
    if success:
        assert run(provider, wording_request()).sections
    else:
        with pytest.raises(GenerationFailure) as error:
            run(provider, wording_request())
        assert error.value.code == "ai_timeout"
    assert len(provider.calls) == 2
    assert [call["request_timeout_s"] for call in provider.calls] == [90, 50]


def test_waiting_for_wording_provider_is_cancellable(monkeypatch):
    real = asyncio.timeout
    monkeypatch.setattr(service.asyncio, "timeout", lambda seconds: real(seconds / 1000))
    class Slow(Provider):
        async def complete_json_async(self, **kwargs):
            self.calls.append(kwargs)
            try: await asyncio.sleep(1)
            finally: self.cancelled = True
    provider = Slow()
    with pytest.raises(GenerationFailure) as error:
        run(provider, wording_request())
    assert error.value.code == "ai_timeout" and provider.cancelled and len(provider.calls) == 1


def test_entire_provider_prompt_including_schema_is_smaller_for_the_same_request():
    req = wording_request()
    req.target_context = "SQL Excel reporting communication " * 40
    req.history = AssistRequest.model_validate({**req.model_dump(), "history": [
        {"role": role, "content": "Previous context " * 30}
        for _ in range(2) for role in ("user", "assistant")
    ]}).history
    provider = Provider([GOOD])
    run(provider, req)
    call = provider.calls[0]
    before = deepcopy(call["payload"])
    before["history"] = recent_history(req.history)
    before["target_context"] = req.target_context
    for section in before["sections"]:
        entries = list(req.document["cv"]["sections"].values())[section["section_index"]]
        for index, row in enumerate(section["entries"]):
            row["entry"] = entries[index]
    transport = OpenAICompatibleProvider(api_key="synthetic", model="synthetic", cache_size=0)
    try:
        old = transport._build_request_body(call["operation"], before, CompactAssistResponse, GENERAL_PROMPT)
        new = transport._build_request_body(call["operation"], call["payload"], call["response_model"], call["system_prompt"])
    finally: transport.close()
    size = lambda body: sum(len(message["content"].encode()) for message in body["messages"])
    assert size(new) < size(old) * .6
    print(f"synthetic_all_prompt_bytes before={size(old)} after={size(new)}")
