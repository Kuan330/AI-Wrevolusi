"""Add immutable account progress reviews.

Revision ID: 0007_progress_reviews
Revises: 0006_full_specialist_catalogue
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0007_progress_reviews'
down_revision = '0006_full_specialist_catalogue'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('progress_reviews',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('user_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('app_accounts.user_id', ondelete='CASCADE'), nullable=False),
        sa.Column('request_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('request_hash', sa.String(64), nullable=False),
        sa.Column('previous_review_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('workspace_revision', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('snapshot', postgresql.JSONB(), nullable=False),
        sa.UniqueConstraint('user_id', 'request_id', name='uq_progress_review_request'))
    op.create_index('ix_progress_review_user_created', 'progress_reviews', ['user_id', 'created_at', 'id'])


def downgrade():
    op.drop_table('progress_reviews')
