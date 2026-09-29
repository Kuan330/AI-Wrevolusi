"""Add versioned specialist skill reference snapshots.

Revision ID: 0005_specialist_catalogues
Revises: 0004_occupation_search_indexes
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0005_specialist_catalogues'
down_revision = '0004_occupation_search_indexes'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'ref_specialist_catalogues',
        sa.Column('isco_code', sa.String(4), nullable=False),
        sa.Column('version', sa.String(20), nullable=False),
        sa.Column('payload', postgresql.JSONB(), nullable=False),
        sa.PrimaryKeyConstraint('isco_code', 'version'),
    )


def downgrade():
    op.drop_table('ref_specialist_catalogues')
