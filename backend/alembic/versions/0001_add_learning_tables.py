"""add learning progress and check-in tables

Revision ID: 0001_learning_tables
Revises:
Create Date: 2026-09-16

Creates the three tables that back the My Plan daily brief bot:

* ``learning_progress`` — the latest 0–10 value reported for one chapter of one
  course of one skill, with the local day it was last changed.
* ``learning_checkins`` — one row per day the learner checked in.
* ``daily_briefs`` — the stored brief text for one day and one variant, so the
  wording does not change while the day lasts.

This is the first revision in the repository, so ``down_revision`` is ``None``.
Existing tables are described by the ORM metadata rather than by earlier
revisions; running this revision alone only creates the three new tables and
touches nothing else. It is safe to apply to a database that already holds the
application tables, and ``downgrade`` removes only these three tables.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0001_learning_tables'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'learning_progress',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('skill_id', sa.String(length=120), nullable=False),
        sa.Column('course_id', sa.String(length=32), nullable=False),
        sa.Column('chapter_index', sa.Integer(), nullable=False),
        sa.Column('value', sa.Integer(), nullable=False),
        sa.Column('last_studied_on', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['app_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint(
            'user_id',
            'skill_id',
            'course_id',
            'chapter_index',
            name='uq_learning_progress_chapter',
        ),
    )
    op.create_index('ix_learning_progress_user_id', 'learning_progress', ['user_id'])
    op.create_index('ix_learning_progress_skill_id', 'learning_progress', ['skill_id'])
    op.create_index('ix_learning_progress_course_id', 'learning_progress', ['course_id'])
    op.create_index('ix_learning_progress_last_studied_on', 'learning_progress', ['last_studied_on'])

    op.create_table(
        'learning_checkins',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('checked_on', sa.Date(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['app_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'checked_on', name='uq_learning_checkin_day'),
    )
    op.create_index('ix_learning_checkins_user_id', 'learning_checkins', ['user_id'])
    op.create_index('ix_learning_checkins_checked_on', 'learning_checkins', ['checked_on'])

    op.create_table(
        'daily_briefs',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('brief_date', sa.Date(), nullable=False),
        sa.Column('variant', sa.String(length=24), nullable=False),
        sa.Column('generated_by_model', sa.Boolean(), nullable=False),
        sa.Column('content', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['app_users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'brief_date', 'variant', name='uq_daily_brief_day'),
    )
    op.create_index('ix_daily_briefs_user_id', 'daily_briefs', ['user_id'])
    op.create_index('ix_daily_briefs_brief_date', 'daily_briefs', ['brief_date'])


def downgrade() -> None:
    op.drop_index('ix_daily_briefs_brief_date', table_name='daily_briefs')
    op.drop_index('ix_daily_briefs_user_id', table_name='daily_briefs')
    op.drop_table('daily_briefs')

    op.drop_index('ix_learning_checkins_checked_on', table_name='learning_checkins')
    op.drop_index('ix_learning_checkins_user_id', table_name='learning_checkins')
    op.drop_table('learning_checkins')

    op.drop_index('ix_learning_progress_last_studied_on', table_name='learning_progress')
    op.drop_index('ix_learning_progress_course_id', table_name='learning_progress')
    op.drop_index('ix_learning_progress_skill_id', table_name='learning_progress')
    op.drop_index('ix_learning_progress_user_id', table_name='learning_progress')
    op.drop_table('learning_progress')
