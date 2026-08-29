import uuid
from enum import Enum
from typing import TYPE_CHECKING

from sqlalchemy import Enum as SqlEnum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.schedule import Schedule
    from app.models.user import User


class PriorityLevel(str, Enum):
    high = 'high'
    medium = 'medium'
    low = 'low'


class Preparation(TimestampMixin, Base):
    __tablename__ = 'preparations'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('app_users.id', ondelete='CASCADE'), index=True)
    title: Mapped[str] = mapped_column(String(150))
    rationale: Mapped[str] = mapped_column(Text())
    effort_level: Mapped[int] = mapped_column(Integer, default=3)
    priority: Mapped[PriorityLevel] = mapped_column(SqlEnum(PriorityLevel), default=PriorityLevel.medium)

    user: Mapped['User'] = relationship(back_populates='preparations')
    schedules: Mapped[list['Schedule']] = relationship(back_populates='preparation', cascade='all, delete-orphan')
