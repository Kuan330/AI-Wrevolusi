import uuid
from enum import Enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import Enum as SqlEnum, ForeignKey, JSON, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin
from app.models.task import task_capability_link

if TYPE_CHECKING:
    from app.models.task import Task
    from app.models.user import User


class CapabilityEvolution(str, Enum):
    continue_to_be_useful = 'continue_to_be_useful'
    needs_strengthening = 'needs_strengthening'
    needs_updating = 'needs_updating'


class Capability(TimestampMixin, Base):
    __tablename__ = 'capabilities'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('app_users.id', ondelete='CASCADE'), index=True)
    name: Mapped[str] = mapped_column(String(120), index=True)
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    evolution: Mapped[CapabilityEvolution] = mapped_column(SqlEnum(CapabilityEvolution))
    evidence: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)

    user: Mapped['User'] = relationship(back_populates='capabilities')
    tasks: Mapped[list['Task']] = relationship(
        secondary=task_capability_link,
        back_populates='capabilities',
    )
