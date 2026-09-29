"""Store the complete versioned ESCO catalogue without merging occupations.

Revision ID: 0006_full_specialist_catalogue
Revises: 0005_specialist_catalogues
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0006_full_specialist_catalogue'
down_revision = '0005_specialist_catalogues'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table('ref_specialist_releases',
        sa.Column('version', sa.String(20), primary_key=True),
        sa.Column('checksum', sa.String(64), nullable=False),
        sa.Column('occupation_count', sa.Integer(), nullable=False),
        sa.Column('skill_count', sa.Integer(), nullable=False),
        sa.Column('relation_count', sa.Integer(), nullable=False),
        sa.Column('source_metadata', postgresql.JSONB(), nullable=False))
    for table, extra in (
        ('ref_specialist_occupations', [sa.Column('isco_code', sa.String(4), nullable=False)]),
        ('ref_specialist_concepts', [sa.Column('skill_type', sa.String(12), nullable=False),
            sa.CheckConstraint("skill_type IN ('skill', 'knowledge', 'unspecified')", name='ck_specialist_concept_type')]),
    ):
        op.create_table(table,
            sa.Column('version', sa.String(20), primary_key=True),
            sa.Column('uri', sa.String(150), primary_key=True),
            sa.Column('label', sa.Text(), nullable=False),
            sa.Column('description', sa.Text(), nullable=False),
            sa.Column('aliases', postgresql.JSONB(), nullable=False),
            sa.Column('search_text', sa.Text(), nullable=False),
            sa.ForeignKeyConstraint(['version'], ['ref_specialist_releases.version']), *extra)
    op.create_index('ix_specialist_occupation_group', 'ref_specialist_occupations', ['version', 'isco_code'])
    op.create_index('ix_specialist_occupation_label', 'ref_specialist_occupations', ['version', 'label', 'uri'])
    op.create_index('ix_specialist_concept_label', 'ref_specialist_concepts', ['version', 'label', 'uri'])
    op.create_table('ref_specialist_relations',
        sa.Column('version', sa.String(20), primary_key=True),
        sa.Column('occupation_uri', sa.String(150), primary_key=True),
        sa.Column('skill_uri', sa.String(150), primary_key=True),
        sa.Column('relation', sa.String(12), primary_key=True),
        sa.ForeignKeyConstraint(['version', 'occupation_uri'], ['ref_specialist_occupations.version', 'ref_specialist_occupations.uri']),
        sa.ForeignKeyConstraint(['version', 'skill_uri'], ['ref_specialist_concepts.version', 'ref_specialist_concepts.uri']),
        sa.CheckConstraint("relation IN ('essential', 'optional')", name='ck_specialist_relation_type'))
    op.create_index('ix_specialist_relation_concept', 'ref_specialist_relations', ['version', 'skill_uri'])


def downgrade():
    for table in ['ref_specialist_relations', 'ref_specialist_concepts', 'ref_specialist_occupations', 'ref_specialist_releases']:
        op.drop_table(table)
