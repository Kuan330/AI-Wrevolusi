"""Account owned immutable progress review snapshots, separate from workspace size."""
import uuid
from datetime import datetime
from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from app.db.base import Base


class ProgressReview(Base):
    __tablename__ = 'progress_reviews'
    __table_args__ = (
        UniqueConstraint('user_id', 'request_id', name='uq_progress_review_request'),
        Index('ix_progress_review_user_created', 'user_id', 'created_at', 'id'),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey('app_accounts.user_id', ondelete='CASCADE'), nullable=False)
    request_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    request_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    previous_review_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    workspace_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    snapshot: Mapped[dict] = mapped_column(JSON().with_variant(JSONB(), 'postgresql'), nullable=False)
