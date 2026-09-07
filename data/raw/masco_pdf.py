"""Extract MASCO 2020 unit-group tasks from the source PDF.

The raw table deliberately uses one row per Unit Group task.  The four-level
MASCO hierarchy is repeated on each row so the later reference builder can
construct the occupation tree without storing task text in that table.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Iterable

import fitz


MASCO_COLUMNS = [
    "major_code", "major_title", "sub_major_code", "sub_major_title",
    "minor_code", "minor_title", "unit_code", "unit_title",
    "unit_description", "skill_level", "task_letter", "task_text",
    "source", "source_year",
]

_MAJOR_RE = re.compile(r"^MAJOR GROUP\s+(\d+)\s+(.+)$", re.I)
_SUB_MAJOR_RE = re.compile(r"^SUB-MAJOR(?: GROUP)?\s+(\d+)\s+(.+)$", re.I)
_MINOR_RE = re.compile(r"^MINOR GROUP\s+(\d+)\s+(.+)$", re.I)
_UNIT_RE = re.compile(r"^UNIT GROUP\s+(\d{4})(?:\s+(.+))?$", re.I)
_TASK_RE = re.compile(r"^([a-z])\s*\)\s*(.*)$", re.I)
_EXAMPLES_RE = re.compile(r"^Examples of the occupations classified here:", re.I)
MAJOR_TITLES = {
    "0": "ARMED FORCES", "1": "MANAGERS", "2": "PROFESSIONALS",
    "3": "TECHNICIANS AND ASSOCIATE PROFESSIONALS",
    "4": "CLERICAL SUPPORT WORKERS", "5": "SERVICE AND SALES WORKERS",
    "6": "SKILLED AGRICULTURAL, FORESTRY, LIVESTOCK AND FISHERY WORKERS",
    "7": "CRAFT AND RELATED TRADES WORKERS",
    "8": "PLANT AND MACHINE OPERATORS AND ASSEMBLERS",
    "9": "ELEMENTARY OCCUPATIONS",
}

_NOISE_RE = re.compile(
    r"^(?:MALAYSIA STANDARD CLASSIFICATION OF OCCUPATIONS.*|\d+|INTRODUCTION|"
    r"MANAGERS|PROFFESIONALS|PROFESSIONALS|TECHNICIANS.*|CLERICAL.*|SERVICE.*)$",
    re.I,
)


def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value.replace("\u00a0", " ")).strip()


def _lines_from_pdf(pdf_path: Path) -> Iterable[str]:
    with fitz.open(pdf_path) as document:
        for page in document:
            yield from page.get_text("text").splitlines()


def _append_text(target: list[str], line: str) -> None:
    line = _clean(line)
    if line and not _NOISE_RE.match(line):
        target.append(line)


def _normalise_header_lines(lines: list[str]) -> list[str]:
    """Join classification headers whose title is on the next PDF line."""
    combined: list[str] = []
    index = 0
    header_re = re.compile(
        r"^(MAJOR GROUP|SUB-MAJOR(?: GROUP)?|MINOR GROUP|UNIT GROUP)\s+(\d{1,4})\s*$",
        re.I,
    )
    while index < len(lines):
        line = _clean(lines[index])
        match = header_re.match(line)
        if match:
            candidate = index + 1
            while candidate < len(lines):
                title = _clean(lines[candidate])
                if not title or "MALAYSIA STANDARD CLASSIFICATION" in title.upper():
                    candidate += 1
                    continue
                if title.isdigit():
                    break
                if match.group(1).upper() == "MAJOR GROUP" and title.upper() in {
                    "MANAGERS", "PROFESSIONALS", "TECHNICIANS AND ASSOCIATE PROFESSIONALS",
                    "CLERICAL SUPPORT WORKERS", "SERVICE AND SALES WORKERS",
                    "SKILLED AGRICULTURAL, FORESTRY, LIVESTOCK AND FISHERY WORKERS",
                    "CRAFT AND RELATED TRADES WORKERS",
                    "PLANT AND MACHINE OPERATORS AND ASSEMBLERS",
                    "ELEMENTARY OCCUPATIONS", "ARMED FORCES",
                }:
                    line = f"{line} {title}"
                    index = candidate
                elif not title.startswith(("Occupations in", "Examples of", "Tasks include")):
                    line = f"{line} {title}"
                    index = candidate
                break
        combined.append(line)
        index += 1
    return combined


def parse_masco_text(text: str) -> list[dict[str, str]]:
    """Parse unit-group descriptions and task lists from extracted PDF text."""
    hierarchy = {"major": None, "sub_major": None, "minor": None}
    current: dict[str, str] | None = None
    description: list[str] = []
    tasks: dict[str, list[str]] = {}
    in_tasks = False
    in_examples = False
    rows: list[dict[str, str]] = []

    def finish_unit() -> None:
        nonlocal current, description, tasks, in_tasks, in_examples
        if current is None:
            return
        description_text = _clean(" ".join(description))
        if not tasks:
            row = {column: "" for column in MASCO_COLUMNS}
            row.update(current)
            row["unit_description"] = description_text
            row["source"] = "MASCO 2020"
            row["source_year"] = "2020"
            rows.append(row)
        else:
            for letter, parts in tasks.items():
                row = {column: "" for column in MASCO_COLUMNS}
                row.update(current)
                row["unit_description"] = description_text
                row["task_letter"] = letter
                row["task_text"] = _clean(" ".join(parts))
                row["source"] = "MASCO 2020"
                row["source_year"] = "2020"
                rows.append(row)
        current = None
        description = []
        tasks = {}
        in_tasks = False
        in_examples = False

    for raw_line in _normalise_header_lines(text.splitlines()):
        line = _clean(raw_line)
        if not line:
            continue

        match = _MAJOR_RE.match(line)
        if match:
            finish_unit()
            major_code = match.group(1)
            major_title = _clean(match.group(2))
            if major_title.isdigit():
                continue
            if major_code not in MAJOR_TITLES:
                continue
            major_title = MAJOR_TITLES[major_code]
            hierarchy = {"major": {"code": major_code, "title": major_title}, "sub_major": None, "minor": None}
            continue
        match = _SUB_MAJOR_RE.match(line)
        if match:
            finish_unit()
            hierarchy["sub_major"] = {"code": match.group(1), "title": _clean(match.group(2))}
            hierarchy["minor"] = None
            continue
        match = _MINOR_RE.match(line)
        if match:
            finish_unit()
            hierarchy["minor"] = {"code": match.group(1), "title": _clean(match.group(2))}
            continue
        match = _UNIT_RE.match(line)
        if match:
            finish_unit()
            if not all(hierarchy.values()):
                continue
            current = {
                "major_code": match.group(1)[0],
                "major_title": MAJOR_TITLES[match.group(1)[0]],
                "sub_major_code": match.group(1)[:2],
                "sub_major_title": hierarchy["sub_major"]["title"],
                "minor_code": match.group(1)[:3],
                "minor_title": hierarchy["minor"]["title"],
                "unit_code": match.group(1),
                "unit_title": _clean(match.group(2) or ""),
                "skill_level": "",
            }
            continue
        if current is None:
            continue
        if _EXAMPLES_RE.match(line):
            in_examples = True
            in_tasks = False
            continue
        if in_examples:
            # Example occupation titles are not part of the existing raw schema.
            continue
        if line.lower() == "tasks include:":
            in_tasks = True
            continue
        task_match = _TASK_RE.match(line)
        if task_match and in_tasks:
            tasks.setdefault(task_match.group(1).lower(), []).append(task_match.group(2))
            continue
        if in_tasks and tasks:
            tasks[max(tasks)].append(line)
        elif not in_tasks:
            _append_text(description, line)

    finish_unit()
    return rows


def extract_masco_rows(pdf_path: Path) -> list[dict[str, str]]:
    """Extract and validate MASCO rows without writing any files."""
    pdf_path = Path(pdf_path)
    if not pdf_path.is_file():
        raise FileNotFoundError(pdf_path)
    rows = parse_masco_text("\n".join(_lines_from_pdf(pdf_path)))
    if not rows:
        raise ValueError("No MASCO unit-group tasks were found in the PDF")
    unit_codes = {row["unit_code"] for row in rows}
    if len(unit_codes) < 400:
        raise ValueError(f"Only {len(unit_codes)} unit groups found; refusing incomplete extraction")
    if any(not row["unit_title"] for row in rows):
        raise ValueError("MASCO extraction contains an empty unit title")
    return rows
