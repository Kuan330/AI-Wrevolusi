"""Offline privacy/grounding/rendering regression tests. All examples are synthetic."""
import json
import re
import subprocess
from pathlib import Path
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.main import create_app
from app.db.session import get_db
from app.schemas.resume import GenerateRequest, GenerateResponse, SkillGap
from app.services.auth import get_current_user
from app.services.resume import validate_generation, generate_resume, recommend_courses, course_candidates, resume_provider
from app.services.resume_render import InvalidResume, RenderFailed, THEMES, render_pdf, validate_render_document
from app.routers.resume import get_resume_provider

JD = "Analyse data and communicate findings. Cybersecurity knowledge is also required."
SKILLS = [{"id": "analytical", "name": "Analytical thinking"}]
REQUEST = {"job_requirements": JD, "skills": SKILLS}
OUTPUT = {"sections": [{"title": "Skills", "entries": [{"text": "Analytical thinking", "skill_ids": ["analytical"], "fact_ids": []}]}], "gaps": []}

class Provider:
    def __init__(self, output=OUTPUT): self.output, self.calls = output, []
    def complete_json(self, **kwargs): self.calls.append(kwargs); return self.output

class DB:
    def __init__(self, rows=()): self.rows = rows; self.statements = []
    async def execute(self, statement):
        sql = str(statement); self.statements.append(sql)
        assert sql.lstrip().upper().startswith("SELECT"), "Resume endpoints must not write to the database"
        return SimpleNamespace(mappings=lambda: SimpleNamespace(all=lambda: self.rows))

@pytest.fixture
def client():
    app = create_app()
    provider, db = Provider(), DB()
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="resume-test-account")
    app.dependency_overrides[get_resume_provider] = lambda: provider
    app.dependency_overrides[get_db] = lambda: db
    with TestClient(app) as http:
        yield http, provider, db

@pytest.mark.parametrize("payload", [
    {"job_requirements": " "},
    {**REQUEST, "job_requirements": "x" * 20001},
    {**REQUEST, "name": "DO-NOT-ECHO-PERSON"},
    {**REQUEST, "evidence": [{"id": "a", "text": "DO-NOT-ECHO-PERSON"}]},
    {**REQUEST, "evidence_reviewed": True, "evidence": [{"id": "a", "text": "private@example.test"}]},
    {"job_requirements": JD, "skills": [], "evidence": []},
])
def test_invalid_or_unreviewed_inputs_do_not_reach_ai(client, payload):
    http, provider, _ = client
    response = http.post("/api/v1/resume/generate", json=payload)
    assert response.status_code == 422
    assert "DO-NOT-ECHO-PERSON" not in response.text
    assert "private@example.test" not in response.text
    assert not provider.calls
    assert response.headers["cache-control"] == "no-store"

def test_only_skill_sections_with_no_original_resume(client):
    http, provider, db = client
    response = http.post("/api/v1/resume/generate", json=REQUEST)
    assert response.status_code == 200
    assert [s["title"] for s in response.json()["sections"]] == ["Skills"]
    assert not db.statements
    call = provider.calls[0]
    assert call["request_cache_enabled"] is False
    assert call["request_max_retries"] == 0
    assert "name" not in call["payload"]
    assert "phone" not in call["payload"]

@pytest.mark.parametrize("section,entry", [
    ("Experience", {"text": "Managed teams", "skill_ids": ["analytical"]}),
    ("Skills", {"text": "Python", "skill_ids": ["invented"]}),
    ("Skills", {"text": "Expert analytical thinking", "skill_ids": ["analytical"]}),
    ("Skills", {"text": "Analytical thinking for 12 years", "skill_ids": ["analytical"]}),
    ("Skills", {"text": "Worked at Google", "skill_ids": ["analytical"]}),
    ("Skills", {"text": "Proficient analytical thinking", "skill_ids": ["analytical"]}),
    ("Skills", {"text": "Analytical thinking for a senior analyst", "skill_ids": ["analytical"]}),
    ("Skills", {"text": "Analytical thinking at 京都大学", "skill_ids": ["analytical"]}),
    ("Skills", {"text": "Built analytical reports", "skill_ids": ["analytical"]}),
    ("Skills", {"text": "#read(\"/etc/passwd\")", "skill_ids": ["analytical"]}),
])
def test_unbacked_model_content_is_rejected(section, entry):
    result = GenerateResponse.model_validate({"sections": [{"title": section, "entries": [entry]}]})
    with pytest.raises(ValueError): validate_generation(result, GenerateRequest.model_validate(REQUEST))

def test_original_evidence_supports_rewording_but_not_new_numbers():
    request = GenerateRequest.model_validate({**REQUEST, "evidence_reviewed": True, "evidence": [{"id": "fact", "text": "Built reports for Acme in 2022."}]})
    result = GenerateResponse.model_validate({"sections": [{"title": "Experience", "entries": [{"text": "Developed reports for Acme in 2022.", "fact_ids": ["fact"]}]}]})
    validate_generation(result, request)
    result.sections[0].entries[0].text = "Developed reports for Acme in 2024."
    with pytest.raises(ValueError): validate_generation(result, request)

def test_explicit_provider_only_no_keyless_or_free_fallback(monkeypatch):
    from app.core.config import settings
    resume_provider.cache_clear()
    monkeypatch.setattr(settings, "ai_api_key", "")
    monkeypatch.setattr(settings, "ai_keyless", True)
    monkeypatch.setattr(settings, "ai_fallback_enabled", True)
    with pytest.raises(RuntimeError): resume_provider()
    resume_provider.cache_clear()

def test_provider_failure_has_no_content_logs_or_fake_success(client, caplog):
    http, provider, _ = client
    def failed(**_): raise RuntimeError("SECRET-RESUME-CONTENT")
    provider.complete_json = failed
    response = http.post("/api/v1/resume/generate", json=REQUEST)
    assert response.status_code == 503
    assert "SECRET-RESUME-CONTENT" not in caplog.text + response.text

GAPS = [SkillGap(id="security", label="Cybersecurity", keywords=["cybersecurity", "networks"], skill_slugs=["networks-and-cybersecurity"])]
ROWS = [{"course_code": "security-1", "title": "Cybersecurity fundamentals", "course_description": "Protect networks", "outcomes": "Assess security risks", "core_skill": "Networks and cybersecurity"},
        {"course_code": "unrelated", "title": "Creative drawing", "course_description": "Paint portraits", "outcomes": "Sketch shapes", "core_skill": "Networks and cybersecurity"}]

def test_real_course_ids_only_deduplicated_and_no_broad_tag_padding():
    candidates = course_candidates(GAPS, ROWS)
    assert [c["course_id"] for c in candidates] == ["security-1"]
    provider = Provider({"courses": [{"course_id": "security-1", "gap_ids": ["security"], "reason": "Covers cybersecurity"}, {"course_id": "invented", "gap_ids": ["security"], "reason": "Invented"}, {"course_id": "security-1", "gap_ids": ["security"], "reason": "Duplicate"}]})
    result = recommend_courses(GAPS, ROWS, provider)
    assert [c.course_id for c in result.courses] == ["security-1"]
    assert provider.calls[0]["request_cache_enabled"] is False

def test_no_matching_courses_does_not_call_ai():
    provider = Provider()
    assert recommend_courses(GAPS, ROWS[1:], provider).courses == []
    assert not provider.calls

def test_courses_db_failure_is_optional_silent_and_readonly(client):
    http, _, db = client
    async def failed(_): raise RuntimeError("PRIVATE-GAP-TEXT")
    db.execute = failed
    response = http.post("/api/v1/resume/recommend-courses", json={"gaps": [g.model_dump() for g in GAPS]})
    assert response.status_code == 200 and response.json() == {"courses": []}
    assert response.headers["cache-control"] == "no-store"

@pytest.mark.parametrize("document", [
    {"cv": {}, "design": {"theme": "../../unsafe"}},
    {"cv": {"photo": "https://example.test/private"}},
    {"cv": {}, "settings": {"render_command": {"pdf_path": "../../private.pdf"}}},
    {"cv": {}, "design": {"templates": {"bullet_entry": "#read(\"/etc/passwd\")"}}},
    {"cv": {"sections": {"Skills": [{"bullet": "#read(\"/etc/passwd\")"}]}}},
    {"cv": {}, "extra": "not-supported"},
])
def test_unsafe_render_inputs_are_rejected_before_subprocess(document):
    with pytest.raises(InvalidResume): validate_render_document(document)

def test_render_requires_authentication_and_all_responses_are_private():
    app = create_app()
    # The missing cookie fails before the database is used.
    with TestClient(app) as http:
        response = http.post("/api/v1/resume/render", json={"document": {"cv": {}}})
        assert response.status_code == 401
        assert response.headers["cache-control"] == "no-store"

@pytest.mark.parametrize("theme", THEMES)
def test_all_builtin_themes_produce_real_pdf_without_a_name(theme):
    data = render_pdf({"cv": {"sections": {"Skills": [{"bullet": "Analytical thinking and digital literacy."}]}}, "design": {"theme": theme}})
    assert data.startswith(b"%PDF-") and len(data) > 5000

def test_multi_page_render_and_private_api_headers(client):
    http, _, _ = client
    response = http.post("/api/v1/resume/render", json={"document": {"cv": {"sections": {"Skills": [{"bullet": "Analytical thinking. " * 20} for _ in range(30)]}}, "design": {"theme": "classic"}}})
    assert response.status_code == 200
    assert response.content.startswith(b"%PDF-")
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["cache-control"] == "no-store"
    pages = re.search(rb"/Type\s*/Pages\s*/Count\s+(\d+)", response.content)
    assert pages and int(pages.group(1)) >= 2

def test_render_timeout_and_failures_clean_up_temp_directory(monkeypatch):
    import app.services.resume_render as service
    directories = []
    def timeout(command, **kwargs):
        directories.append(Path(command[-1]))
        raise subprocess.TimeoutExpired(command, 1)
    monkeypatch.setattr(service.subprocess, "run", timeout)
    with pytest.raises(RenderFailed): service.render_pdf({"cv": {}}, timeout=1)
    assert directories and all(not d.exists() for d in directories)
    # The semaphore is also released after every failure.
    with pytest.raises(RenderFailed): service.render_pdf({"cv": {}}, timeout=1)

def test_contract_maximum_is_five_courses():
    from app.schemas.resume import RecommendResponse
    with pytest.raises(ValidationError): RecommendResponse.model_validate({"courses": [{"course_id": str(i), "gap_ids": ["security"], "reason": "Relevant"} for i in range(6)]})


@pytest.mark.parametrize("text", ['#std.eval("danger")', '$$read("private")$$', '[link](file:///private)', '![image](https://example.test/img)'])
def test_no_raw_typst_or_resources(text):
    with pytest.raises(InvalidResume):
        validate_render_document({"cv": {"sections": {"Skills": [{"bullet": text}]}}})

def test_network_guard_allows_only_internal_socketpairs():
    import socket
    for method in ["connect", "connect_ex"]:
        with socket.socket() as connection:
            with pytest.raises(AssertionError, match="must not connect"):
                getattr(connection, method)(("127.0.0.1", 5432))
    left, right = socket.socketpair()
    try:
        left.send(b"offline-self-pipe")
        assert right.recv(64) == b"offline-self-pipe"
    finally:
        left.close(); right.close()

def test_markdown_links_and_design_controls_render_safely():
    pdf = render_pdf({"cv": {"sections": {"Skills": [{"bullet": 'SQL and **analytical thinking**, [portfolio](https://example.test/?q=%22)'}]}},
        "design": {"theme": "moderncv", "typography": {"font_family": "Lato", "font_size": {"body": "11pt"}, "line_spacing": "0.7em"},
        "colors": {"section_titles": "#abcdef"}, "page": {"size": "us-letter", "top_margin": "1cm"}}})
    assert pdf.startswith(b"%PDF-")


def test_oversized_request_is_bounded_private_and_never_calls_ai(client):
    http, provider, _ = client
    response = http.post("/api/v1/resume/generate", content=b"PRIVATE-OVERSIZE" * 100000, headers={"content-type": "application/json"})
    assert response.status_code == 413
    assert response.headers["cache-control"] == "no-store"
    assert "PRIVATE-OVERSIZE" not in response.text
    assert not provider.calls


def test_unicode_proper_names_must_be_original_evidence():
    request = GenerateRequest.model_validate({**REQUEST, "evidence_reviewed": True, "evidence": [{"id": "fact", "text": "Built reports for 北京大学 in 2022."}]})
    result = GenerateResponse.model_validate({"sections": [{"title": "Experience", "entries": [{"text": "Developed reports for 北京大学 in 2022.", "fact_ids": ["fact"]}]}]})
    validate_generation(result, request)


def test_renderer_preserves_original_unicode_names_across_windows_process_boundary(monkeypatch):
    import app.services.resume_render as service
    original_run = service.subprocess.run
    def inspect_worker(command, **kwargs):
        process = original_run(command, **kwargs)
        if process.returncode == 0:
            source = (Path(command[-1]) / "resume.typ").read_text(encoding="utf-8")
            assert "张示例" in source
        return process
    monkeypatch.setattr(service.subprocess, "run", inspect_worker)
    pdf = service.render_pdf({"cv": {"name": "张示例", "sections": {"Skills": [{"bullet": "Analytical thinking"}]}}, "design": {"theme": "classic"}})
    assert pdf.startswith(b"%PDF-")
