"""Pinned editor-control metadata and full-core, real-render regression (offline)."""
import copy
import json
from pathlib import Path

import pytest
from rendercv.schema.rendercv_model_builder import build_rendercv_dictionary_and_model

from app.services.resume_render import THEMES, render_pdf

CONTROLS = json.loads((Path(__file__).resolve().parents[2] / "frontend/src/features/resume/rendercv-2.8.controls.json").read_text(encoding="utf-8"))

@pytest.mark.parametrize("theme", THEMES)
def test_exported_control_defaults_match_pinned_engine(theme):
    _, model = build_rendercv_dictionary_and_model(json.dumps({"cv": {}, "design": {"theme": theme}}), input_file_path=None)
    actual = model.model_dump(mode="json")["design"]
    actual.pop("templates", None)
    actual["header"] = {key: value for key, value in actual["header"].items() if not key.startswith("photo")}
    assert CONTROLS["version"] == "2.8"
    assert actual == CONTROLS["themes"][theme]

@pytest.mark.parametrize("language", CONTROLS["locales"])
def test_exported_locale_defaults_match_engine(language):
    _, model = build_rendercv_dictionary_and_model(json.dumps({"cv": {}, "locale": {"language": language}}), input_file_path=None)
    assert model.model_dump(mode="json")["locale"] == CONTROLS["locales"][language]

@pytest.mark.parametrize("theme", THEMES)
def test_full_safe_editor_controls_and_nine_entry_types_render_real_pdf(theme):
    # Synthetic, user-entered facts, never official example-person data.
    document = {"cv": {"name": "Synthetic QA", "social_networks": [{"network": "GitHub", "username": "synthetic-qa"}], "custom_connections": [{"fontawesome_icon": "link", "placeholder": "Own site", "url": "https://example.test"}], "sections": {
        "Skills": [{"bullet": "SQL and **analytical thinking**"}],
        "Text": ["User-supplied statement"],
        "One line": [{"label": "Skill", "details": "Own detail"}],
        "Experience": [{"company": "Own organisation", "position": "Own role", "highlights": ["Own fact A", "Own fact B"]}],
        "Education": [{"institution": "Own institution", "area": "Own study"}],
        "Projects": [{"name": "Own project", "summary": "Own project detail"}],
        "Publications": [{"title": "Own title", "authors": ["Own author", "Second author"], "url": "https://example.test"}],
        "Numbered": [{"number": "Own fact"}],
        "Reverse numbered": [{"reversed_number": "Own fact"}],
    }}, "design": copy.deepcopy(CONTROLS["themes"][theme]), "locale": copy.deepcopy(CONTROLS["locales"]["french"]), "settings": {"current_date": "2026-01-01", "bold_keywords": ["SQL"], "pdf_title": "Own CV title"}}
    document["design"]["page"]["top_margin"] = "1cm"
    document["design"]["colors"]["section_titles"] = "#abcdef"
    document["design"]["typography"]["font_family"]["body"] = "Lato"
    pdf = render_pdf(document)
    assert pdf.startswith(b"%PDF-") and len(pdf) > 1000

def test_long_text_section_with_explicit_safe_page_break_control_renders_continuously():
    # Pinned 2.8 defaults keep text-based sections unbreakable through entries.
    # A user can explicitly enable this exported control for a long chapter.
    assert CONTROLS["themes"]["classic"]["entries"]["allow_page_break"] is False
    doc = {"cv": {"sections": {"Skills": [{"bullet": "Analytical thinking. " * 20} for _ in range(90)]}}, "design": {"theme": "classic", "entries": {"allow_page_break": True}}}
    pdf = render_pdf(doc)
    import re
    count = re.search(rb"/Type\s*/Pages\s*/Count\s+(\d+)", pdf)
    assert count and int(count.group(1)) >= 6


def test_footer_page_counters_stay_code_and_preamble_fields_stay_data(monkeypatch):
    import app.services.resume_render as service
    original_run = service.subprocess.run
    def inspect_worker(command, **kwargs):
        process = original_run(command, **kwargs)
        assert process.returncode == 0
        text = (Path(command[-1]) / "resume.typ").read_text(encoding="utf-8")
        line = next(line for line in text.splitlines() if "footer:" in line)
        assert "#str(here().page())" in line
        assert "#str(counter(page).final().first())" in line
        assert r"\#str" not in line
        assert "#emph[" in line  # Built-in italic styling spans the counters.
        assert 'name: "Own \\\"quoted\\\" name"' in text
        assert 'title: "Own \\\"quoted\\\" title"' in text
        assert 'header-connections-separator: "\\\""' in text
        return process
    monkeypatch.setattr(service.subprocess, "run", inspect_worker)
    doc = {"cv": {"name": 'Own "quoted" name', "sections": {"Skills": [{"bullet": "Own skill"}]}}, "design": {"theme": "classic", "header": {"connections": {"separator": '"'}}}, "settings": {"pdf_title": 'Own "quoted" title', "bold_keywords": ["str", "a", "\U000f0000"]}}
    assert service.render_pdf(doc).startswith(b"%PDF-")


def test_typst_quoted_data_never_terminates_the_string():
    from app.services.resume_render_safety import typst_string
    value = '\" , title: read(\"private.txt\"), name: \"'
    escaped = typst_string(value)
    assert escaped == value.replace('"', '\\\"')
    assert typst_string("line\nnext\r\t\\") == r"line\nnext\r\t\\"


@pytest.mark.parametrize("contact", [{}, {"name": None}, {"name": ""}], ids=["omitted", "null", "empty"])
def test_empty_name_footer_keeps_italic_page_numbers_without_literal_markers(monkeypatch, contact):
    import app.services.resume_render as service
    original_run = service.subprocess.run

    def inspect_worker(command, **kwargs):
        process = original_run(command, **kwargs)
        assert process.returncode == 0
        text = (Path(command[-1]) / "resume.typ").read_text(encoding="utf-8")
        line = next(line for line in text.splitlines() if "footer:" in line)
        assert "#emph[" in line
        assert "#str(here().page())" in line
        assert "#str(counter(page).final().first())" in line
        assert r"\*" not in line
        assert r"\#str" not in line
        return process

    monkeypatch.setattr(service.subprocess, "run", inspect_worker)
    document = {"cv": {**contact, "sections": {"Skills": [{"bullet": "Own skill"}]}}, "design": {"theme": "classic"}}
    assert service.render_pdf(document).startswith(b"%PDF-")
