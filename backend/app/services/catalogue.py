"""Transform the verified course catalogue into Bot input data.

The daily brief still owns recommendation ranking. This module only converts the
normalised catalogue query into the existing ``BriefSkillInput`` shape and keeps
course metadata available to the frontend.
"""

import re
import unicodedata
from collections import OrderedDict
from collections.abc import Iterable, Mapping

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession


def skill_slug(name: str) -> str:
    """Return the stable skill identifier used by the learning tables/API."""

    value = unicodedata.normalize('NFKD', name).encode('ascii', 'ignore').decode('ascii')
    value = re.sub(r'[^a-zA-Z0-9]+', '-', value.lower()).strip('-')
    return value


def build_bot_catalogue(rows: Iterable[Mapping]) -> list[dict]:
    """Group catalogue course rows into Bot-ready selected-skill records.

    ``rows`` is intentionally mapping-shaped so the function can be tested without
    a database and can consume SQLAlchemy ``Result.mappings()`` directly. The SQL
    query must already aggregate chapter counts per course.
    """

    grouped: OrderedDict[str, dict] = OrderedDict()
    for row in rows:
        name = str(row.get('core_skill') or '').strip()
        course_id = str(row.get('course_code') or '').strip()
        if not name or not course_id:
            continue

        skill_id = skill_slug(name)
        skill = grouped.setdefault(
            skill_id,
            {
                'skill_id': skill_id,
                'skill_name': name,
                'importance_pct': row.get('core_skill_importance_2025_pct'),
                'total_chapters': 0,
                'courses': [],
            },
        )
        chapter_count = max(0, int(row.get('chapter_count') or 0))
        skill['total_chapters'] += chapter_count
        skill['courses'].append(
            {
                'course_id': course_id,
                'title': row.get('course_title'),
                'provider': row.get('provider'),
                'url': row.get('course_url'),
                'level': row.get('level'),
                'course_no': row.get('course_no'),
                'chapter_count': chapter_count,
            }
        )

    for skill in grouped.values():
        skill['courses'].sort(key=lambda course: (course['level'] or '', course['course_no'] or 0, course['course_id']))
    return list(grouped.values())


PAGE_LEVEL_ORDER = {'Beginner': 0, 'Intermediate': 1, 'Advanced': 2}


def build_page_catalogue(
    course_rows: Iterable[Mapping],
    chapter_rows: Iterable[Mapping],
) -> list[dict]:
    """Build the page-shaped course list with chapters attached.

    Course rows carry the full verified metadata; chapter rows are attached by
    course code. Courses come back easiest-first (Beginner -> Intermediate ->
    Advanced, then course_no) so the Learning Resources page needs no
    client-side sorting for its default order.
    """

    chapters_by_course: dict[str, list[dict]] = {}
    for row in chapter_rows:
        course_id = str(row.get('course_code') or '').strip()
        chapter_order = row.get('chapter_order')
        if not course_id or chapter_order is None:
            continue
        chapters_by_course.setdefault(course_id, []).append(
            {
                'order': int(chapter_order),
                'title': str(row.get('title') or ''),
                'duration_min': row.get('duration_min'),
            }
        )

    courses: list[dict] = []
    for row in course_rows:
        course_id = str(row.get('course_code') or '').strip()
        if not course_id:
            continue
        chapters = chapters_by_course.get(course_id, [])
        chapters.sort(key=lambda item: item['order'])
        courses.append(
            {
                'course_id': course_id,
                'skill_id': skill_slug(str(row.get('core_skill') or '')),
                'skill_name': str(row.get('core_skill') or ''),
                'title': row.get('title'),
                'provider': row.get('provider'),
                'url': row.get('url'),
                'level': row.get('level'),
                'course_no': row.get('course_no'),
                'language': row.get('language'),
                'format': row.get('format'),
                'self_paced': bool(row.get('self_paced')),
                'duration_min': row.get('duration_min'),
                'register': row.get('register'),
                'description': row.get('course_description'),
                'outcomes': row.get('outcomes'),
                'prereq': row.get('prereq'),
                'advice': row.get('advice'),
                'chapter_count': int(row.get('chapter_count') or 0),
                'chapters': chapters,
            }
        )

    courses.sort(
        key=lambda course: (
            PAGE_LEVEL_ORDER.get(str(course['level'] or ''), 9),
            int(course['course_no'] or 0),
            course['course_id'],
        )
    )
    return courses


def build_catalogue_scope(rows: Iterable[Mapping]) -> dict[str, dict[str, set[int]]]:
    """Build ``skill -> course -> zero-based chapter indexes`` for validation."""

    scope: dict[str, dict[str, set[int]]] = {}
    for row in rows:
        name = str(row.get('core_skill') or '').strip()
        course_id = str(row.get('course_code') or '').strip()
        chapter_order = row.get('chapter_order')
        if not name or not course_id or chapter_order is None:
            continue
        scope.setdefault(skill_slug(name), {}).setdefault(course_id, set()).add(int(chapter_order) - 1)
    return scope


async def load_catalogue_scope(db: AsyncSession) -> dict[str, dict[str, set[int]]]:
    """Read the verified skill/course/chapter identities used by progress writes."""

    result = await db.execute(
        text(
            'SELECT s.core_skill, c.course_code, ch.chapter_order '
            'FROM ref_wef_skills AS s '
            'JOIN catalogue_courses AS c ON c.skill_id = s.wef_skill_id '
            'JOIN catalogue_chapters AS ch ON ch.course_id = c.id '
            'ORDER BY s.wef_skill_id, c.course_code, ch.chapter_order'
        )
    )
    return build_catalogue_scope(result.mappings().all())


async def load_skill_catalogue(db: AsyncSession) -> dict[str, dict]:
    """Read server-side chapter totals and importance per skill.

    This is the source of truth for the brief and the summary: the client sends
    only *which* skills it selected, and the server decides how many chapters each
    one holds and how important it is. Keys are the same slugs used by
    ``learning_progress`` and the frontend's ``skillKey``.
    """

    result = await db.execute(
        text(
            'SELECT s.core_skill, s.core_skill_importance_2025_pct, '
            'COUNT(ch.id) AS chapters '
            'FROM ref_wef_skills AS s '
            'LEFT JOIN catalogue_courses AS c ON c.skill_id = s.wef_skill_id '
            'LEFT JOIN catalogue_chapters AS ch ON ch.course_id = c.id '
            'GROUP BY s.wef_skill_id, s.core_skill, s.core_skill_importance_2025_pct '
            'ORDER BY s.wef_skill_id'
        )
    )

    catalogue: dict[str, dict] = {}
    for row in result.mappings().all():
        name = str(row.get('core_skill') or '').strip()
        if not name:
            continue
        catalogue[skill_slug(name)] = {
            'skill_name': name,
            'total_chapters': max(0, int(row.get('chapters') or 0)),
            'importance_pct': row.get('core_skill_importance_2025_pct'),
        }
    return catalogue


def validate_catalogue_scope(
    scope: Mapping[str, Mapping[str, set[int]]],
    *,
    skill_id: str,
    course_id: str,
    chapter_index: int,
) -> bool:
    """Return whether a progress key exists in the verified catalogue."""

    return chapter_index in scope.get(skill_id, {}).get(course_id, set())


__all__ = [
    'build_bot_catalogue',
    'build_catalogue_scope',
    'load_catalogue_scope',
    'load_skill_catalogue',
    'skill_slug',
    'validate_catalogue_scope',
]
