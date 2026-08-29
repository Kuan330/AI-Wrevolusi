import uuid
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.capability import Capability
    from app.models.occupation import Occupation
    from app.models.preparation import Preparation
    from app.models.refresh_token import RefreshToken
    from app.models.schedule import Schedule
    from app.models.task import Task


class User(TimestampMixin, Base):
    # The Iteration 1 data pipeline already owns a legacy `users` table.
    # Keep the account model isolated until that schema is formally migrated.
    __tablename__ = 'app_users'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(120))
    hashed_password: Mapped[str] = mapped_column(String(255))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    occupation_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('occupations.id', ondelete='SET NULL'),
        nullable=True,
    )

    occupation: Mapped['Occupation | None'] = relationship(back_populates='users')
    refresh_tokens: Mapped[list['RefreshToken']] = relationship(back_populates='user', cascade='all, delete-orphan')
    tasks: Mapped[list['Task']] = relationship(back_populates='user', cascade='all, delete-orphan')
    capabilities: Mapped[list['Capability']] = relationship(back_populates='user', cascade='all, delete-orphan')
    preparations: Mapped[list['Preparation']] = relationship(back_populates='user', cascade='all, delete-orphan')
    schedules: Mapped[list['Schedule']] = relationship(back_populates='user', cascade='all, delete-orphan')
