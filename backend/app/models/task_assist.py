"""Permanent one-question Task Assist records, isolated from the tasks table."""

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User


class TaskAssistInteraction(TimestampMixin, Base):
    """One immutable completed exchange per user and profile task key."""

    __tablename__ = 'task_assist_interactions'
    __table_args__ = (
        UniqueConstraint('user_id', 'task_key', name='uq_task_assist_user_task'),
        CheckConstraint(
            "status IN ('available', 'pending', 'completed')",
            name='ck_task_assist_status',
        ),
        CheckConstraint(
            "status <> 'completed' OR (question IS NOT NULL AND reply IS NOT NULL "
            "AND generated_by_model IS NOT NULL AND completed_at IS NOT NULL)",
            name='ck_task_assist_completed_payload',
        ),
        CheckConstraint(
            "status <> 'pending' OR (claim_token IS NOT NULL AND claimed_at IS NOT NULL "
            "AND question IS NOT NULL)",
            name='ck_task_assist_pending_claim',
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey('app_users.id', ondelete='CASCADE'), nullable=False, index=True
    )
    task_key: Mapped[str] = mapped_column(String(128), nullable=False)
    task_text: Mapped[str] = mapped_column(Text(), nullable=False)
    notes: Mapped[str] = mapped_column(Text(), nullable=False, default='')
    status: Mapped[str] = mapped_column(String(16), nullable=False, default='available')
    claim_token: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    claimed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    question: Mapped[str | None] = mapped_column(Text(), nullable=True)
    reply: Mapped[str | None] = mapped_column(Text(), nullable=True)
    generated_by_model: Mapped[bool | None] = mapped_column(Boolean(), nullable=True)
    needs_user_confirmation: Mapped[bool] = mapped_column(Boolean(), nullable=False, default=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped['User'] = relationship(back_populates='task_assist_interactions')
