"""Conservative title-agreement guard, not a validated MASCO-to-ISCO crosswalk.

A matching title only allows reference discovery. It does not validate a
person's task, proficiency, or a Malaysian task-to-skill relationship.
"""
import re
import unicodedata

from fastapi import HTTPException
from sqlalchemy import text

UNSUPPORTED_MAPPING_MESSAGE = (
    'This Malaysian occupation has no checked ILO mapping. '
    'Your work is saved; you can review skills.'
)


def normalize_classification_title(value: str) -> str:
    value = unicodedata.normalize('NFKC', value).casefold()
    value = value.translate(str.maketrans({'’': "'", '‘': "'", '–': '-', '—': '-'}))
    return re.sub(r'\s+', ' ', value).strip()


async def require_ilo_title_agreement(db, occupation_code: str) -> None:
    """Reject missing or conflicting same-code classifications before any task match."""
    result = await db.execute(text(
        'SELECT DISTINCT o.title AS masco_title, t.title AS ilo_title '
        'FROM ref_occupations o JOIN ref_ilo_tasks t ON t.isco_08 = o.occupation_code '
        "WHERE o.occupation_code = :code AND o.level = 'unit'"
    ), {'code': occupation_code})
    rows = result.mappings().all()
    if not rows or any(
        not row['masco_title'] or not row['ilo_title']
        or normalize_classification_title(row['masco_title']) != normalize_classification_title(row['ilo_title'])
        for row in rows
    ):
        raise HTTPException(status_code=422, detail=UNSUPPORTED_MAPPING_MESSAGE)
