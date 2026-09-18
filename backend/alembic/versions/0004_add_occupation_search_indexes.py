"""add occupation search indexes for ILIKE and unit browsing

Revision ID: 0004_occupation_search_indexes
Revises: 0003_task_assist_once

Adds trigram indexes so title/description substring search can use an index
instead of a sequential scan, plus a composite (level, occupation_code) index
for the unit-occupation browse path used by Possibilities and fuzzy search.
"""

from collections.abc import Sequence
from typing import Union

from alembic import op

revision: str = '0004_occupation_search_indexes'
down_revision: Union[str, None] = '0003_task_assist_once'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm')
    op.execute(
        'CREATE INDEX IF NOT EXISTS ref_occupations_title_trgm_idx '
        'ON ref_occupations USING gin (title gin_trgm_ops)'
    )
    op.execute(
        'CREATE INDEX IF NOT EXISTS ref_occupations_description_trgm_idx '
        'ON ref_occupations USING gin (description gin_trgm_ops)'
    )
    op.execute(
        'CREATE INDEX IF NOT EXISTS ref_occupations_level_code_idx '
        'ON ref_occupations (level, occupation_code)'
    )
    op.execute(
        'CREATE INDEX IF NOT EXISTS ref_occupations_code_trgm_idx '
        'ON ref_occupations USING gin (occupation_code gin_trgm_ops)'
    )


def downgrade() -> None:
    op.execute('DROP INDEX IF EXISTS ref_occupations_code_trgm_idx')
    op.execute('DROP INDEX IF EXISTS ref_occupations_level_code_idx')
    op.execute('DROP INDEX IF EXISTS ref_occupations_description_trgm_idx')
    op.execute('DROP INDEX IF EXISTS ref_occupations_title_trgm_idx')
    # Leave pg_trgm installed — other objects may depend on it.
