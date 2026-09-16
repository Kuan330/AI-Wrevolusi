"""Read-only validation for the verified course catalogue workbook."""

from __future__ import annotations

import argparse
import collections
import json
from pathlib import Path

import openpyxl


def load_rows(workbook, sheet_name: str) -> list[dict]:
    sheet = workbook[sheet_name]
    rows = sheet.iter_rows(values_only=True)
    headers = next(rows)
    return [dict(zip(headers, row)) for row in rows if any(value is not None for value in row)]


def validate(path: Path) -> dict:
    workbook = openpyxl.load_workbook(path, read_only=True, data_only=True)
    skills = load_rows(workbook, 'Skills')
    courses = load_rows(workbook, 'Courses')
    chapters = load_rows(workbook, 'Chapters')
    sources = load_rows(workbook, 'Source Verification')

    errors: list[str] = []
    skill_ids = {row['skill_id'] for row in skills}
    course_ids = {row['course_id'] for row in courses}

    def duplicates(rows: list[dict], key: str) -> list[str]:
        counts = collections.Counter(row.get(key) for row in rows)
        return [str(value) for value, count in counts.items() if value and count > 1]

    for key, rows in [('skill_id', skills), ('course_id', courses)]:
        for value in duplicates(rows, key):
            errors.append(f'duplicate {key}: {value}')

    for row in courses:
        if row['skill_id'] not in skill_ids:
            errors.append(f"course {row['course_id']} references unknown skill {row['skill_id']}")
        if row['level'] not in {'Beginner', 'Intermediate', 'Advanced'}:
            errors.append(f"course {row['course_id']} has invalid level {row['level']}")
        if row['course_no'] not in {1, 2}:
            errors.append(f"course {row['course_id']} has invalid course_no {row['course_no']}")
        if not str(row['url']).startswith(('http://', 'https://')):
            errors.append(f"course {row['course_id']} has invalid url")
        if row['selfPaced'] not in {True, False, 'TRUE', 'FALSE'}:
            errors.append(f"course {row['course_id']} has invalid selfPaced value")

    chapter_keys = {(row['course_id'], row['chapter_order']) for row in chapters}
    if len(chapter_keys) != len(chapters):
        errors.append('duplicate (course_id, chapter_order)')
    for row in chapters:
        if row['course_id'] not in course_ids:
            errors.append(f"chapter references unknown course {row['course_id']}")
        if not row['title']:
            errors.append(f"chapter {row['course_id']}:{row['chapter_order']} has no title")

    chapter_course_ids = {row['course_id'] for row in chapters}
    for course_id in sorted(course_ids - chapter_course_ids):
        errors.append(f'course has no chapters: {course_id}')

    source_ids = {row['course_id'] for row in sources}
    for course_id in sorted(course_ids - source_ids):
        errors.append(f'course has no source verification: {course_id}')

    summary = {
        'workbook': str(path),
        'skills': len(skills),
        'courses': len(courses),
        'chapters': len(chapters),
        'source_verifications': len(sources),
        'expected': {'skills': 26, 'courses': 156, 'chapters': 947},
        'errors': errors,
        'valid': not errors,
    }
    return summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('workbook', type=Path)
    args = parser.parse_args()
    result = validate(args.workbook)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if result['valid'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
