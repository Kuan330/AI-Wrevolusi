"""Learning progress and daily check-in records for the My Plan page.

Two tables back the daily brief bot:

* :class:`LearningProgress` — the latest 0–10 value the learner reported for one
  chapter of one course. Values only ever increase, which the service layer
  enforces. ``last_studied_on`` is what lets the bot say "you have not studied
  this skill in a while" and "this skill was already studied today".
* :class:`LearningCheckin` — one row per day the learner checked in. The check-in
  calendar lights up a day when its row exists.

Dates are always stored as plain ``DATE`` values supplied by the client. The
browser knows the learner's local calendar day; the server does not, so it never
derives "today" from a timestamp.
"""

import uuid
from datetime import date
from typing import TYPE_CHECKING

from sqlalchemy import JSON, Boolean, Date, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin

if TYPE_CHECKING:
    from app.models.user import User

# A chapter is reported on a 0–10 scale; the two bounds are shared with the
# validation layer so the contract cannot drift.
CHAPTER_VALUE_MIN = 0
CHAPTER_VALUE_MAX = 10


class LearningProgress(TimestampMixin, Base):
    """Latest reported value for one chapter of one course of one skill."""

    __tablename__ = 'learning_progress'
    __table_args__ = (
        UniqueConstraint(
            'user_id',
            'skill_id',
            'course_id',
            'chapter_index',
            name='uq_learning_progress_chapter',
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('app_users.id', ondelete='CASCADE'),
        index=True,
    )
    skill_id: Mapped[str] = mapped_column(String(120), index=True)
    course_id: Mapped[str] = mapped_column(String(32), index=True)
    chapter_index: Mapped[int] = mapped_column(Integer, nullable=False)
    value: Mapped[int] = mapped_column(Integer, nullable=False)
    # The local calendar day this value was last changed. Drives "studied today"
    # and "not studied for a while" without keeping a full daily history.
    last_studied_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    user: Mapped['User'] = relationship(back_populates='learning_progress')


class LearningCheckin(TimestampMixin, Base):
    """One row per day the learner checked in; the row lights up the calendar."""

    __tablename__ = 'learning_checkins'
    __table_args__ = (
        UniqueConstraint('user_id', 'checked_on', name='uq_learning_checkin_day'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('app_users.id', ondelete='CASCADE'),
        index=True,
    )
    checked_on: Mapped[date] = mapped_column(Date, nullable=False, index=True)

    user: Mapped['User'] = relationship(back_populates='learning_checkins')


class DailyBrief(TimestampMixin, Base):
    """A stored daily brief, so the text does not change while the day lasts.

    The key is ``(user, day, variant)``: the same day holds at most one brief
    before the check-in and one after it, which is exactly what makes "the brief
    stays the same today, but a check-in produces a new one" work.

    Only briefs written by the language model are stored. A template brief is
    returned to the caller but not persisted, so a provider outage early in the
    day does not freeze plain wording for the rest of it.
    """

    __tablename__ = 'daily_briefs'
    __table_args__ = (
        UniqueConstraint('user_id', 'brief_date', 'variant', name='uq_daily_brief_day'),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey('app_users.id', ondelete='CASCADE'),
        index=True,
    )
    brief_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    variant: Mapped[str] = mapped_column(String(24), nullable=False)
    generated_by_model: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # The brief prose plus the recommendation identifiers it was written for.
    content: Mapped[dict] = mapped_column(JSON, nullable=False)

    user: Mapped['User'] = relationship(back_populates='daily_briefs')
