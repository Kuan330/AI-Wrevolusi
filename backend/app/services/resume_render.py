"""RenderCV in a short-lived process: compiler caches cannot retain a user's CV."""
import json
import re
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

THEMES = ("classic", "ember", "engineeringclassic", "engineeringresumes", "harvard", "ink", "moderncv", "opal", "sb2nov")
_ALLOWED_DESIGN = {"theme", "page", "colors", "typography", "links", "header", "section_titles", "sections", "entries"}
_ALLOWED_SETTINGS = {"current_date", "bold_keywords", "pdf_title"}
_SLOTS = threading.BoundedSemaphore(2)

class InvalidResume(ValueError):
    pass

class RenderBusy(RuntimeError):
    pass

class RenderFailed(RuntimeError):
    pass

def validate_render_document(document):
    if not isinstance(document, dict) or not isinstance(document.get("cv"), dict):
        raise InvalidResume("A RenderCV document needs a cv mapping.")
    if set(document) - {"cv", "design", "locale", "settings"}:
        raise InvalidResume("Unsupported top-level fields; keep them in YAML and correct them before rendering.")
    design = document.get("design", {})
    if not isinstance(design, dict) or set(design) - _ALLOWED_DESIGN:
        raise InvalidResume("Custom themes and template code are not supported.")
    if design.get("theme", "classic") not in THEMES:
        raise InvalidResume("Select a built-in RenderCV theme.")
    settings = document.get("settings", {})
    if not isinstance(settings, dict) or set(settings) - _ALLOWED_SETTINGS:
        raise InvalidResume("Render commands, external overlays and output paths are not supported.")
    if document["cv"].get("photo") is not None:
        raise InvalidResume("Photos and external resources are not supported in this version.")
    nodes = 0
    characters = 0
    def walk(value, depth=0):
        nonlocal nodes, characters
        nodes += 1
        if depth > 18 or nodes > 10000:
            raise InvalidResume("The document is too complex.")
        if isinstance(value, str):
            characters += len(value)
            if len(value) > 10000 or characters > 100000:
                raise InvalidResume("The document exceeds the text limit.")
            # URL fragments are literal link data, not Typst commands.
            code_text = re.sub(r'https?://[^\s"<>]+', '', value)
            if (re.search(r"#[A-Za-z_]", code_text) and not re.fullmatch(r"#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?(?:[0-9a-fA-F]{2})?", value)) or "$$" in value:
                raise InvalidResume("Raw Typst code is not supported; use plain text or Markdown formatting.")
            if re.search(r"\]\(\s*(?!https?://|mailto:|tel:)[^\s)]", value, re.I) or "![" in value:
                raise InvalidResume("Use safe web/contact links; local file links and embedded resources are not supported.")
        elif isinstance(value, dict):
            for key, item in value.items():
                if not isinstance(key, str) or key in {"__proto__", "constructor", "prototype"}:
                    raise InvalidResume("Invalid document field.")
                walk(key, depth + 1)
                walk(item, depth + 1)
        elif isinstance(value, list):
            for item in value:
                walk(item, depth + 1)
        elif value is not None and not isinstance(value, (bool, int, float)):
            raise InvalidResume("Unsupported document value.")
    walk(document)
    return document

def render_pdf(document, *, timeout=25):
    validate_render_document(document)
    if not _SLOTS.acquire(blocking=False):
        raise RenderBusy("The renderer is busy. Try again shortly.")
    try:
        with tempfile.TemporaryDirectory(prefix="aiw-resume-") as directory:
            try:
                process = subprocess.run(
                    [sys.executable, "-m", "app.services.resume_worker", directory],
                    input=json.dumps(document, ensure_ascii=False).encode("utf-8"),
                    stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, timeout=timeout,
                    cwd=Path(__file__).resolve().parents[2],
                    creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
                )
            except subprocess.TimeoutExpired:
                raise RenderFailed("Resume rendering timed out. Your local draft is unchanged.") from None
            if process.returncode == 2:
                # Worker emits only field names/error classes, never input values.
                try:
                    issues = json.loads(process.stdout).get("fields", [])
                except (ValueError, AttributeError):
                    issues = []
                raise InvalidResume("Check RenderCV values at: " + ", ".join(issues[:5]) if issues else "Check your RenderCV document values.")
            pdf = Path(directory) / "resume.pdf"
            if process.returncode or not pdf.is_file():
                raise RenderFailed("The PDF could not be rendered. Your local draft is unchanged.")
            result = pdf.read_bytes()
            if not result.startswith(b"%PDF-") or len(result) > 4_000_000:
                raise RenderFailed("The rendered PDF exceeds the supported size.")
            return result
    finally:
        _SLOTS.release()
