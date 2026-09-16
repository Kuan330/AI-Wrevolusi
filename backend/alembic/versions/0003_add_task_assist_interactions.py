"""add permanent single-use task assist interactions

Revision ID: 0003_task_assist_once
Revises: 0002_catalogue_tables
Create Date: 2026-09-17

Creates a server-owned profile-task identity and one account-scoped Task Assist
record per backend Task. Completed records keep the first question and answer.
"""

from collections.abc import Sequence
from typing import Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = '0003_task_assist_once'
down_revision: Union[str, None] = '0002_catalogue_tables'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tasks',
        sa.Column('profile_task_id', sa.String(length=128), nullable=True),
    )
    op.create_unique_constraint(
        constraint_name='uq_tasks_user_profile_task',
        table_name='tasks',
        columns=['user_id', 'profile_task_id'],
    )
    op.create_unique_constraint(
        constraint_name='uq_tasks_user_id_id',
        table_name='tasks',
        columns=['user_id', 'id'],
    )

    op.create_table(
        'task_assist_interactions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('task_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('task_text', sa.Text(), nullable=False),
        sa.Column('notes', sa.Text(), nullable=False),
        sa.Column('status', sa.String(length=16), nullable=False),
        sa.Column('claim_token', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('claimed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('question', sa.Text(), nullable=True),
        sa.Column('reply', sa.Text(), nullable=True),
        sa.Column('generated_by_model', sa.Boolean(), nullable=True),
        sa.Column(
            'needs_user_confirmation',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('true'),
        ),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "status IN ('available', 'pending', 'completed')",
            name='ck_task_assist_status',
        ),
        sa.CheckConstraint(
            "status <> 'completed' OR (question IS NOT NULL AND reply IS NOT NULL "
            "AND generated_by_model IS NOT NULL AND completed_at IS NOT NULL)",
            name='ck_task_assist_completed_payload',
        ),
        sa.CheckConstraint(
            "status <> 'pending' OR (claim_token IS NOT NULL AND claimed_at IS NOT NULL "
            "AND question IS NOT NULL)",
            name='ck_task_assist_pending_claim',
        ),
        sa.ForeignKeyConstraint(
            ['user_id'],
            ['app_users.id'],
            ondelete='CASCADE',
        ),
        sa.ForeignKeyConstraint(
            ['user_id', 'task_id'],
            ['tasks.user_id', 'tasks.id'],
            name='fk_task_assist_owned_task',
            ondelete='CASCADE',
        ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'task_id', name='uq_task_assist_user_task'),
    )
    op.create_index(
        'ix_task_assist_interactions_user_id',
        'task_assist_interactions',
        ['user_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(
        'ix_task_assist_interactions_user_id',
        table_name='task_assist_interactions',
    )
    op.drop_table('task_assist_interactions')
    op.drop_constraint('uq_tasks_user_id_id', 'tasks', type_='unique')
    op.drop_constraint('uq_tasks_user_profile_task', 'tasks', type_='unique')
    op.drop_column('tasks', 'profile_task_id')
