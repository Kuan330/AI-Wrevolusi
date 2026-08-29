import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, Date, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.preparation import Preparation
    from app.models.user import User


class Schedule(TimestampMixin, Base):
    __tablename__ = 'schedules'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('users.id', ondelete='CASCADE'), index=True)
    preparation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('preparations.id', ondelete='CASCADE'),
        index=True,
    )
    planned_for: Mapped[date] = mapped_column(Date, nullable=False)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    note: Mapped[str | None] = mapped_column(Text(), nullable=True)

    user: Mapped['User'] = relationship(back_populates='schedules')
    preparation: Mapped['Preparation'] = relationship(back_populates='schedules')
