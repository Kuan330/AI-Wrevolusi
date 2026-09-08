import uuid
from sqlalchemy import ForeignKey, Integer, String, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base, TimestampMixin


class Account(TimestampMixin, Base):
    """Username identity and private workspace for an existing app user."""
    __tablename__ = 'app_accounts'
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('app_users.id', ondelete='CASCADE'), primary_key=True)
    username: Mapped[str] = mapped_column(String(32), unique=True, index=True)
    workspace: Mapped[dict] = mapped_column(JSON, default=dict)
    revision: Mapped[int] = mapped_column(Integer, default=0)
