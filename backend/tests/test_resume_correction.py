"""Offline correction and privacy checks using deliberately synthetic content."""
import copy
from types import SimpleNamespace
import pytest
from app.schemas.resume import GenerateRequest, GenerateResponse
from app.services import resume as service
from app.services.ai_gateway import AIProviderError
from app.services.resume_errors import GenerationRejected, GenerationFailure, render_fields, safe_fields
from app.services.resume_render import render_pdf
from tests.test_resume import client, REQUEST, OUTPUT

BAD = {"sections": [{"title": "Skills", "entries": [{"text": "Analytical thinking at PrivateInventedCompany", "skill_ids": ["analytical"]}]}]}

class SequenceProvider:
    def __init__(self, outputs, clock=None, elapsed=0):
        self.outputs, self.calls, self.clock, self.elapsed = list(outputs), [], clock, elapsed
    def complete_json(self, **kwargs):
        self.calls.append(copy.deepcopy(kwargs))
        if self.clock and len(self.calls) == 1: self.clock.value += self.elapsed
        value = self.outputs.pop(0)
        if isinstance(value, Exception): raise value
        return copy.deepcopy(value)

class Clock:
    value = 0
    def monotonic(self): return self.value

@pytest.mark.parametrize("prefix", ["Able to use", "Skilled in", "Comfortable with", "Familiar with"])
def test_normal_capitalised_ability_phrases_are_not_named_entities(prefix):
    request = GenerateRequest.model_validate({"job_requirements": "Use SQL and Excel.", "skills": [{"id": "sql", "name": "SQL"}, {"id": "excel", "name": "Excel"}]})
    result = GenerateResponse.model_validate({"sections": [{"title": "Skills", "entries": [{"text": prefix + " SQL and Excel for data analysis.", "skill_ids": ["sql", "excel"]}]}]})
    assert service.validate_generation(result, request) is result

@pytest.mark.parametrize("verb", ["Cleaned", "Checked", "Summarised", "Summarized", "Collaborated"])
def test_new_generic_past_tense_words_still_require_facts(verb):
    request = GenerateRequest.model_validate(REQUEST)
    result = GenerateResponse.model_validate({"sections": [{"title": "Skills", "entries": [{"text": verb + " analytical thinking", "skill_ids": ["analytical"]}]}]})
    with pytest.raises(GenerationRejected) as failure: service.validate_generation(result, request)
    assert failure.value.code == "unsupported_claim"
    assert failure.value.fields == [["sections", 0, "entries", 0, "text"]]
    request = GenerateRequest.model_validate({**REQUEST, "evidence_reviewed": True, "evidence": [{"id": "fact", "text": verb + " analytical thinking"}]})
    result.sections[0].entries[0].fact_ids = ["fact"]
    service.validate_generation(result, request)

@pytest.mark.parametrize("text,code", [
    ("Google supports analytical thinking", "unverified_name"),
    ("Python for analytical thinking", "unverified_name"),
    ("Expert analytical thinking", "unsupported_claim"),
    ("Analytical thinking for 12 years", "unsupported_fact"),
    ('#std.eval("private")', "unsafe_content"),
    ("PrivatePerson@example.test", "unsafe_content"),
])
def test_true_unbacked_or_unsafe_content_remains_rejected(text, code):
    result = GenerateResponse.model_validate({"sections": [{"title": "Skills", "entries": [{"text": text, "skill_ids": ["analytical"]}]}]})
    with pytest.raises(GenerationRejected) as failure: service.validate_generation(result, GenerateRequest.model_validate(REQUEST))
    assert failure.value.code == code
    assert text not in str(failure.value)

@pytest.mark.parametrize("result,code", [
    ({"sections": OUTPUT["sections"] * 2}, "duplicate_sections"),
    ({"sections": [], "gaps": [{"id": "same", "label": "Synthetic gap"}] * 2}, "duplicate_gaps"),
    ({"sections": [{"title": "Experience", "entries": []}]}, "missing_evidence"),
    ({"sections": [{"title": "Skills", "entries": [{"text": "User text", "skill_ids": ["private-source-id"]}]}]}, "invalid_reference"),
])
def test_fixed_reason_codes_never_include_source_values(result, code):
    with pytest.raises(GenerationRejected) as failure: service.validate_generation(GenerateResponse.model_validate(result), GenerateRequest.model_validate(REQUEST))
    assert failure.value.code == code
    assert "private-source-id" not in str(failure.value) + repr(failure.value.fields)

def test_first_valid_result_is_one_call_without_repair():
    provider = SequenceProvider([OUTPUT])
    service.generate_resume(GenerateRequest.model_validate(REQUEST), provider)
    assert len(provider.calls) == 1
    assert "repair_feedback" not in provider.calls[0]["payload"]

def test_one_correction_uses_same_redacted_input_and_remaining_budget(monkeypatch, caplog):
    clock = Clock()
    monkeypatch.setattr(service, "time", SimpleNamespace(monotonic=clock.monotonic))
    provider = SequenceProvider([BAD, OUTPUT], clock, 12)
    request = GenerateRequest.model_validate(REQUEST)
    before = request.model_dump()
    result = service.generate_resume(request, provider)
    assert result.sections[0].entries[0].text == "Analytical thinking"
    assert len(provider.calls) == 2
    first, second = provider.calls
    assert first["request_timeout_s"] == 45
    assert second["request_timeout_s"] == 33
    feedback = second["payload"].pop("repair_feedback")
    assert feedback == {"code": "unverified_name", "fields": [["sections", 0, "entries", 0, "text"]]}
    assert first["payload"] == second["payload"] == before
    assert request.model_dump() == before
    for call in provider.calls:
        assert call["request_cache_enabled"] is False
        assert call["request_max_retries"] == 0
    assert "PrivateInventedCompany" not in repr(provider.calls) + caplog.text

def test_two_rejections_do_not_produce_partial_success_or_a_third_request(caplog):
    provider = SequenceProvider([BAD, BAD, OUTPUT])
    with pytest.raises(GenerationRejected) as failure: service.generate_resume(GenerateRequest.model_validate(REQUEST), provider)
    assert failure.value.attempts == 2
    assert len(provider.calls) == 2
    assert "PrivateInventedCompany" not in caplog.text + str(failure.value)

@pytest.mark.parametrize("elapsed,expected_calls", [(40, 2), (40.01, 1), (44, 1)])
def test_correction_requires_at_least_five_seconds_remaining(monkeypatch, elapsed, expected_calls):
    clock = Clock()
    monkeypatch.setattr(service, "time", SimpleNamespace(monotonic=clock.monotonic))
    provider = SequenceProvider([BAD, OUTPUT], clock, elapsed)
    if expected_calls == 1:
        with pytest.raises(GenerationRejected) as failure: service.generate_resume(GenerateRequest.model_validate(REQUEST), provider)
        assert failure.value.attempts == 1
    else: service.generate_resume(GenerateRequest.model_validate(REQUEST), provider)
    assert len(provider.calls) == expected_calls

@pytest.mark.parametrize("error", [ValueError("SECRET-INPUT"), RuntimeError("SECRET-INPUT"), AIProviderError("SECRET-INPUT", status_code=401), AIProviderError("SECRET-INPUT", status_code=429), AIProviderError("SECRET-INPUT")])
def test_non_policy_errors_are_never_corrected(error, caplog):
    provider = SequenceProvider([error, OUTPUT])
    with pytest.raises(GenerationFailure) as failure: service.generate_resume(GenerateRequest.model_validate(REQUEST), provider)
    assert failure.value.code == ("ai_provider_error" if isinstance(error, AIProviderError) else "internal_error")
    assert failure.value.attempts == 1
    assert len(provider.calls) == 1
    assert "SECRET-INPUT" not in str(failure.value) + caplog.text

def test_schema_invalid_output_is_not_corrected():
    provider = SequenceProvider([{"unexpected": "SECRET-INPUT"}, OUTPUT])
    with pytest.raises(GenerationFailure) as failure: service.generate_resume(GenerateRequest.model_validate(REQUEST), provider)
    assert failure.value.code == "ai_schema_invalid"
    assert len(provider.calls) == 1
    assert "SECRET-INPUT" not in str(failure.value)

def test_request_errors_have_safe_paths_and_no_input_echo(client):
    http, provider, _ = client
    response = http.post("/api/v1/resume/generate", json={"job_requirements": "x", "SECRET-PERSON": "SECRET-CONTENT"})
    assert response.status_code == 422
    assert response.json()["code"] == "invalid_request"
    assert "SECRET" not in response.text
    assert response.json()["fields"] == [["field"]]
    assert not provider.calls

def test_route_reports_final_code_and_attempt_count_without_content(client, caplog):
    http, provider, db = client
    provider.output = BAD
    response = http.post("/api/v1/resume/generate", json=REQUEST)
    assert response.status_code == 503
    assert response.json()["code"] == "unverified_name"
    assert response.json()["fields"] == [["sections", 0, "entries", 0, "text"]]
    assert isinstance(response.json()["detail"], str)
    assert len(provider.calls) == 2
    assert not db.statements
    assert "attempts=2" in caplog.text
    assert "PrivateInventedCompany" not in response.text + caplog.text
    assert response.headers["cache-control"] == "no-store"

def test_paths_replace_even_schema_named_chapters_and_untrusted_fields():
    doc = {"cv": {"sections": {"email": [], "SECRET-CHAPTER": []}}}
    assert render_fields([["cv", "sections", "email", "0", "start_date"]], doc) == [["cv", "sections", 0, 0, "start_date"]]
    assert render_fields([["cv", "sections", "SECRET-CHAPTER", "0", "SECRET-FIELD"]], doc) == [["cv", "sections", 1, 0, "field"]]
    assert "SECRET" not in repr(safe_fields([["body", "SECRET-PERSON", 0]]))

@pytest.mark.parametrize("title", ["SECRET-CHAPTER", "email"])
def test_real_render_validation_locates_dates_without_echoing_personal_values(client, caplog, title):
    http, _, _ = client
    document = {"cv": {"name": "SECRET-PERSON", "email": "secret@example.test", "sections": {title: [{"company": "SECRET-COMPANY", "position": "SECRET-ROLE", "start_date": "2026-02-31"}]}}, "design": {"theme": "classic"}}
    response = http.post("/api/v1/resume/render", json={"document": document})
    assert response.status_code == 422
    assert response.json()["code"] == "render_values_invalid"
    assert ["cv", "sections", 0, 0, "start_date"] in response.json()["fields"]
    assert "SECRET" not in response.text + caplog.text
    assert "secret@example.test" not in response.text + caplog.text
    assert f"sections/{title}" not in response.json()["detail"]
    assert response.headers["cache-control"] == "no-store"
    document["cv"]["sections"][title][0]["start_date"] = "2026-02-28"
    assert render_pdf(document).startswith(b"%PDF-")


def test_late_provider_result_is_not_applied_or_corrected(monkeypatch):
    clock = Clock()
    monkeypatch.setattr(service, "time", SimpleNamespace(monotonic=clock.monotonic))
    provider = SequenceProvider([OUTPUT, OUTPUT], clock, 46)
    with pytest.raises(GenerationFailure) as failure: service.generate_resume(GenerateRequest.model_validate(REQUEST), provider)
    assert failure.value.code == "ai_budget_exhausted"
    assert failure.value.attempts == 1
    assert len(provider.calls) == 1


def test_provider_failure_during_correction_stops_after_two_calls():
    provider = SequenceProvider([BAD, AIProviderError("SECRET-CONTENT", status_code=429), OUTPUT])
    with pytest.raises(GenerationFailure) as failure: service.generate_resume(GenerateRequest.model_validate(REQUEST), provider)
    assert failure.value.code == "ai_provider_error"
    assert failure.value.attempts == 2
    assert len(provider.calls) == 2
    assert "SECRET-CONTENT" not in str(failure.value)


@pytest.mark.parametrize("kind,status,code", [("busy", 429, "render_busy"), ("timeout", 503, "render_timeout"), ("compile", 503, "render_failed"), ("unknown", 500, "internal_error")])
def test_renderer_failure_branches_never_echo_exception_values(client, monkeypatch, caplog, kind, status, code):
    from app.routers import resume as router
    from app.services.resume_render import RenderBusy, RenderFailed
    errors = {"busy": RenderBusy("SECRET-CONTENT"), "timeout": RenderFailed("SECRET-CONTENT", code="render_timeout"), "compile": RenderFailed("SECRET-CONTENT"), "unknown": RuntimeError("SECRET-CONTENT")}
    def fail(*_): raise errors[kind]
    monkeypatch.setattr(router, "render_pdf", fail)
    http, _, _ = client
    response = http.post("/api/v1/resume/render", json={"document": {"cv": {}}})
    assert response.status_code == status
    assert response.json()["code"] == code
    assert response.headers["cache-control"] == "no-store"
    assert "SECRET-CONTENT" not in response.text + caplog.text
