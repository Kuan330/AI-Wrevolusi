import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import Enum, ForeignKey, JSON, String, Table, Text, Column
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.constants.exposure_types import ExposureType
from app.constants.task_status import TaskStatus
from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.capability import Capability
    from app.models.occupation import Occupation
    from app.models.user import User


task_capability_link = Table(
    'task_capability_link',
    Base.metadata,
    Column('task_id', UUID(as_uuid=True), ForeignKey('tasks.id', ondelete='CASCADE'), primary_key=True),
    Column('capability_id', UUID(as_uuid=True), ForeignKey('capabilities.id', ondelete='CASCADE'), primary_key=True),
)


class Task(TimestampMixin, Base):
    __tablename__ = 'tasks'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('app_users.id', ondelete='CASCADE'), index=True)
    occupation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('occupations.id', ondelete='SET NULL'),
        nullable=True,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str | None] = mapped_column(Text(), nullable=True)
    status: Mapped[TaskStatus] = mapped_column(Enum(TaskStatus), default=TaskStatus.needs_review)
    exposure_type: Mapped[ExposureType] = mapped_column(
        Enum(ExposureType),
        default=ExposureType.insufficient_data,
    )
    context: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)

    user: Mapped['User'] = relationship(back_populates='tasks')
    occupation: Mapped['Occupation | None'] = relationship(back_populates='tasks')
    capabilities: Mapped[list['Capability']] = relationship(
        secondary=task_capability_link,
        back_populates='tasks',
    )
