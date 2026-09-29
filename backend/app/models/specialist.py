"""Versioned public occupation-skill catalogue, separate from user skill claims."""
from sqlalchemy import CheckConstraint, ForeignKeyConstraint, Index, Integer, JSON, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class SpecialistCatalogue(Base):
    __tablename__ = 'ref_specialist_catalogues'

    isco_code: Mapped[str] = mapped_column(String(4), primary_key=True)
    version: Mapped[str] = mapped_column(String(20), primary_key=True)
    payload: Mapped[dict] = mapped_column(JSON().with_variant(JSONB(), 'postgresql'), nullable=False)



class SpecialistRelease(Base):
    __tablename__ = 'ref_specialist_releases'
    version: Mapped[str] = mapped_column(String(20), primary_key=True)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    occupation_count: Mapped[int] = mapped_column(Integer, nullable=False)
    skill_count: Mapped[int] = mapped_column(Integer, nullable=False)
    relation_count: Mapped[int] = mapped_column(Integer, nullable=False)
    source_metadata: Mapped[dict] = mapped_column(JSON().with_variant(JSONB(), 'postgresql'), nullable=False)


class SpecialistOccupation(Base):
    __tablename__ = 'ref_specialist_occupations'
    version: Mapped[str] = mapped_column(String(20), primary_key=True)
    uri: Mapped[str] = mapped_column(String(150), primary_key=True)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    isco_code: Mapped[str] = mapped_column(String(4), nullable=False)
    aliases: Mapped[list] = mapped_column(JSON().with_variant(JSONB(), 'postgresql'), nullable=False)
    search_text: Mapped[str] = mapped_column(Text, nullable=False)
    __table_args__ = (
        ForeignKeyConstraint(['version'], ['ref_specialist_releases.version']),
        Index('ix_specialist_occupation_group', 'version', 'isco_code'),
        Index('ix_specialist_occupation_label', 'version', 'label', 'uri'),
    )


class SpecialistConcept(Base):
    __tablename__ = 'ref_specialist_concepts'
    version: Mapped[str] = mapped_column(String(20), primary_key=True)
    uri: Mapped[str] = mapped_column(String(150), primary_key=True)
    label: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    skill_type: Mapped[str] = mapped_column(String(12), nullable=False)
    aliases: Mapped[list] = mapped_column(JSON().with_variant(JSONB(), 'postgresql'), nullable=False)
    search_text: Mapped[str] = mapped_column(Text, nullable=False)
    __table_args__ = (
        ForeignKeyConstraint(['version'], ['ref_specialist_releases.version']),
        CheckConstraint("skill_type IN ('skill', 'knowledge', 'unspecified')", name='ck_specialist_concept_type'),
        Index('ix_specialist_concept_label', 'version', 'label', 'uri'),
    )


class SpecialistRelation(Base):
    __tablename__ = 'ref_specialist_relations'
    version: Mapped[str] = mapped_column(String(20), primary_key=True)
    occupation_uri: Mapped[str] = mapped_column(String(150), primary_key=True)
    skill_uri: Mapped[str] = mapped_column(String(150), primary_key=True)
    relation: Mapped[str] = mapped_column(String(12), primary_key=True)
    __table_args__ = (
        ForeignKeyConstraint(['version', 'occupation_uri'], ['ref_specialist_occupations.version', 'ref_specialist_occupations.uri']),
        ForeignKeyConstraint(['version', 'skill_uri'], ['ref_specialist_concepts.version', 'ref_specialist_concepts.uri']),
        CheckConstraint("relation IN ('essential', 'optional')", name='ck_specialist_relation_type'),
        Index('ix_specialist_relation_concept', 'version', 'skill_uri'),
    )
