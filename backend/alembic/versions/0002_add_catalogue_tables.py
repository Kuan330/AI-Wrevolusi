"""add verified learning catalogue tables

Revision ID: 0002_catalogue_tables
Revises: 0001_learning_tables

This migration creates only the two new catalogue tables. It reuses the
existing ``public.ref_wef_skills`` table and does not modify or replace it.
It does not import course data; data import is a separate, validated step.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = '0002_catalogue_tables'
down_revision: Union[str, None] = '0001_learning_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'catalogue_courses',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('course_code', sa.String(length=32), nullable=False),
        sa.Column('skill_id', sa.Integer(), nullable=False),
        sa.Column('level', sa.String(length=16), nullable=False),
        sa.Column('course_no', sa.Integer(), nullable=False),
        sa.Column('collection_status', sa.String(length=24), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('provider', sa.Text(), nullable=False),
        sa.Column('url', sa.Text(), nullable=False),
        sa.Column('course_description', sa.Text(), nullable=False),
        sa.Column('outcomes', sa.Text(), nullable=False),
        sa.Column('language', sa.String(length=120), nullable=False),
        sa.Column('format', sa.Text(), nullable=False),
        sa.Column('self_paced', sa.Boolean(), nullable=False),
        sa.Column('duration_min', sa.Integer(), nullable=True),
        sa.Column('register', sa.String(length=24), nullable=False),
        sa.Column('prereq', sa.Text(), nullable=False),
        sa.Column('match', sa.Text(), nullable=False),
        sa.Column('advice', sa.Text(), nullable=False),
        sa.Column('official_level', sa.String(length=80), nullable=False),
        sa.Column('level_source', sa.String(length=32), nullable=False),
        sa.Column('difficulty_note', sa.Text(), nullable=False),
        sa.Column('chapter_status', sa.String(length=80), nullable=False),
        sa.Column('chapter_note', sa.Text(), nullable=False),
        sa.Column('chapter_source_url', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['skill_id'], ['ref_wef_skills.wef_skill_id'], ondelete='RESTRICT'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_code', name='uq_catalogue_course_code'),
        sa.UniqueConstraint('skill_id', 'level', 'course_no', name='uq_catalogue_course_slot'),
    )
    op.create_index('ix_catalogue_courses_course_code', 'catalogue_courses', ['course_code'])
    op.create_index('ix_catalogue_courses_skill_id', 'catalogue_courses', ['skill_id'])

    op.create_table(
        'catalogue_chapters',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('course_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chapter_order', sa.Integer(), nullable=False),
        sa.Column('parent_order', sa.Integer(), nullable=True),
        sa.Column('level', sa.String(length=24), nullable=False),
        sa.Column('title', sa.Text(), nullable=False),
        sa.Column('duration_min', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.ForeignKeyConstraint(['course_id'], ['catalogue_courses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', 'chapter_order', name='uq_catalogue_chapter_order'),
    )
    op.create_index('ix_catalogue_chapters_course_id', 'catalogue_chapters', ['course_id'])


def downgrade() -> None:
    op.drop_index('ix_catalogue_chapters_course_id', table_name='catalogue_chapters')
    op.drop_table('catalogue_chapters')
    op.drop_index('ix_catalogue_courses_skill_id', table_name='catalogue_courses')
    op.drop_index('ix_catalogue_courses_course_code', table_name='catalogue_courses')
    op.drop_table('catalogue_courses')
