"""Database catalogue for the verified WEF learning resources."""

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.learning import LearningProgress


class CatalogueCourse(TimestampMixin, Base):
    __tablename__ = 'catalogue_courses'
    __table_args__ = (
        UniqueConstraint('course_code', name='uq_catalogue_course_code'),
        UniqueConstraint('skill_id', 'level', 'course_no', name='uq_catalogue_course_slot'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_code: Mapped[str] = mapped_column(String(32), nullable=False, index=True)
    skill_id: Mapped[int] = mapped_column(
        Integer,
        ForeignKey('ref_wef_skills.wef_skill_id', ondelete='RESTRICT'),
        nullable=False,
        index=True,
    )
    level: Mapped[str] = mapped_column(String(16), nullable=False)
    course_no: Mapped[int] = mapped_column(Integer, nullable=False)
    collection_status: Mapped[str] = mapped_column(String(24), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(Text, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    course_description: Mapped[str] = mapped_column(Text, nullable=False)
    outcomes: Mapped[str] = mapped_column(Text, nullable=False)
    language: Mapped[str] = mapped_column(String(120), nullable=False)
    format: Mapped[str] = mapped_column(Text, nullable=False)
    self_paced: Mapped[bool] = mapped_column(Boolean, nullable=False)
    duration_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    register: Mapped[str] = mapped_column(String(24), nullable=False)
    prereq: Mapped[str] = mapped_column(Text, nullable=False)
    match: Mapped[str] = mapped_column(Text, nullable=False)
    advice: Mapped[str] = mapped_column(Text, nullable=False)
    official_level: Mapped[str] = mapped_column(String(80), nullable=False)
    level_source: Mapped[str] = mapped_column(String(32), nullable=False)
    difficulty_note: Mapped[str] = mapped_column(Text, nullable=False)
    chapter_status: Mapped[str] = mapped_column(String(80), nullable=False)
    chapter_note: Mapped[str] = mapped_column(Text, nullable=False)
    chapter_source_url: Mapped[str] = mapped_column(Text, nullable=False)

    chapters: Mapped[list['CatalogueChapter']] = relationship(
        back_populates='course', cascade='all, delete-orphan'
    )


class CatalogueChapter(TimestampMixin, Base):
    __tablename__ = 'catalogue_chapters'
    __table_args__ = (
        UniqueConstraint('course_id', 'chapter_order', name='uq_catalogue_chapter_order'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('catalogue_courses.id', ondelete='CASCADE'),
        nullable=False,
        index=True,
    )
    chapter_order: Mapped[int] = mapped_column(Integer, nullable=False)
    parent_order: Mapped[int | None] = mapped_column(Integer, nullable=True)
    level: Mapped[str] = mapped_column(String(24), nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    duration_min: Mapped[int | None] = mapped_column(Integer, nullable=True)

    course: Mapped['CatalogueCourse'] = relationship(back_populates='chapters')
