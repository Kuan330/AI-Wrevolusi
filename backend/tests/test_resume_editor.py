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


@pytest.mark.parametrize("contacts", [
    {"email": "", "phone": "", "website": ""},
    {"email": "  ", "phone": "\t", "website": "\n"},
    {"email": [""], "phone": ["", " "], "website": ["\t"]},
    {"email": ["", "first@example.com", "second@example.com", " "], "phone": ["", "+61 412 345 678"], "website": ["", "https://example.com"]},
    {"email": [], "phone": [], "website": []},
])
def test_blank_optional_contacts_in_legacy_drafts_and_list_rows_render_real_pdf(contacts):
    from app.services.resume_render import normalize_render_contacts
    document = {"cv": {**contacts, "sections": {"Skills": [{"bullet": "Own skill"}]}}, "design": {"theme": "classic"}}
    before = copy.deepcopy(document)
    normalized = normalize_render_contacts(document)
    assert document == before
    assert normalize_render_contacts(normalized) == normalized
    assert render_pdf(document).startswith(b"%PDF-")
    assert document == before


@pytest.mark.parametrize("contacts", [
    {"email": "not an email", "phone": "0412345678", "website": "www.example.com"},
    {"email": ["", "Contact me directly", "second address"], "phone": ["Office: 12345", "Local 0400 000 000"], "website": "Personal site coming soon"},
    {"email": 'Own "quoted" contact', "phone": "12345 ext. 9", "website": "https://example.test/path/"},
])
def test_free_text_contacts_render_exact_literals_without_format_restrictions(monkeypatch, contacts):
    import app.services.resume_render as service
    from app.services.resume_render_safety import typst_string
    original_run = service.subprocess.run

    def inspect_worker(command, **kwargs):
        process = original_run(command, **kwargs)
        assert process.returncode == 0
        text = (Path(command[-1]) / "resume.typ").read_text(encoding="utf-8")
        for value in contacts.values():
            for item in value if isinstance(value, list) else [value]:
                if item:
                    assert '#text("' + typst_string(item) + '")' in text
        return process

    monkeypatch.setattr(service.subprocess, "run", inspect_worker)
    document = {"cv": {**contacts, "sections": {"Skills": []}}}
    before = copy.deepcopy(document)
    assert service.render_pdf(document).startswith(b"%PDF-")
    assert document == before


@pytest.mark.parametrize("literal", [
    '#read("private.txt")',
    '") #read("private.txt") #text("',
    "$$read(private)$$",
    "[label](file:///private)",
    "![photo](https://example.test/photo.png)",
    "**Keep stars** _and underscores_ `and backticks`",
    "javascript:alert(1)",
])
def test_contact_code_markup_and_schemes_are_inert_text_not_commands_or_links(monkeypatch, literal):
    import app.services.resume_render as service
    from app.services.resume_render_safety import typst_string
    original_run = service.subprocess.run

    def inspect_worker(command, **kwargs):
        process = original_run(command, **kwargs)
        assert process.returncode == 0
        text = (Path(command[-1]) / "resume.typ").read_text(encoding="utf-8")
        assert '#text("' + typst_string(literal) + '")' in text
        assert '#link("file:' not in text
        assert '#link("javascript:' not in text
        return process

    monkeypatch.setattr(service.subprocess, "run", inspect_worker)
    assert service.render_pdf({"cv": {"email": literal, "phone": literal, "website": literal, "sections": {"Skills": []}}}).startswith(b"%PDF-")
    # The exemption is narrowly scoped to literal contacts. Editable Markdown
    # chapters still reject executable/resource syntax.
    if literal.startswith(("#read", "$$", "[label]", "![photo]")):
        with pytest.raises(service.InvalidResume):
            service.validate_render_document({"cv": {"sections": {"Skills": [{"bullet": literal}]}}})


@pytest.mark.parametrize("value", [123, {"unexpected": "object"}, [None], ["Text", 123]])
def test_free_text_contacts_still_require_a_renderable_text_shape(value):
    from app.services.resume_render import InvalidResume
    with pytest.raises(InvalidResume, match="must be text or a list of text values"):
        render_pdf({"cv": {"email": value}})


def test_free_text_header_contacts_keep_original_order_with_social_and_custom_connections(monkeypatch):
    import app.services.resume_render as service
    original_run = service.subprocess.run

    def inspect_worker(command, **kwargs):
        process = original_run(command, **kwargs)
        assert process.returncode == 0
        text = (Path(command[-1]) / "resume.typ").read_text(encoding="utf-8")
        markers = ['#text("Own site label")', 'github.com/own-user', '#text("Own phone label")', 'Own custom label', '#text("Own email label")']
        indices = [text.index(marker) for marker in markers]
        assert indices == sorted(indices)
        return process

    monkeypatch.setattr(service.subprocess, "run", inspect_worker)
    document = {"cv": {"website": "Own site label", "social_networks": [{"network": "GitHub", "username": "own-user"}], "phone": "Own phone label", "custom_connections": [{"fontawesome_icon": "link", "placeholder": "Own custom label", "url": None}], "email": "Own email label", "sections": {"Skills": []}}}
    assert service.render_pdf(document).startswith(b"%PDF-")


def test_contact_normalization_preserves_other_fields_and_invalid_array_types():
    from app.services.resume_render import normalize_render_contacts
    document = {"cv": {"name": "", "email": ["", None, 7], "unknown_fact": "Keep this fact"}, "settings": {"pdf_title": ""}}
    normalized = normalize_render_contacts(document)
    assert normalized["cv"]["email"] == [None, 7]
    assert normalized["cv"]["unknown_fact"] == "Keep this fact"
    assert normalized["cv"]["name"] == ""
    assert normalized["settings"] == document["settings"]
    assert "phone" not in normalized["cv"] and "website" not in normalized["cv"]
