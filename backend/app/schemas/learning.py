"""Request and response contracts for learning progress, check-in and the brief.

The request bodies carry a **local** calendar date (``YYYY-MM-DD``). The browser
knows the learner's day; the server does not, so it never derives the day from a
timestamp. The server only sanity-checks that a supplied date is not in the future
and not implausibly old.
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from app.models.learning import CHAPTER_VALUE_MAX, CHAPTER_VALUE_MIN

# A day can be reported well after the fact in principle, but a date older than
# this is treated as a client bug rather than a real study day.
MAX_BACKFILL_DAYS = 400


class ChapterProgressIn(BaseModel):
    """One chapter's reported value, cumulative on a 0–10 scale."""

    skill_id: str = Field(min_length=1, max_length=120)
    course_id: str = Field(min_length=1, max_length=32)
    chapter_index: int = Field(ge=0, le=999)
    value: int = Field(ge=CHAPTER_VALUE_MIN, le=CHAPTER_VALUE_MAX)


class RejectedChapter(BaseModel):
    """A chapter the server refused, with a machine-readable reason."""

    course_id: str
    chapter_index: int
    reason: Literal['not_increase', 'unknown_scope', 'invalid_value']
    stored_value: int | None = Field(default=None, ge=0, le=CHAPTER_VALUE_MAX)


class ProgressUpdateRequest(BaseModel):
    """A batch of chapter values reported for one local day."""

    local_date: date
    chapters: list[ChapterProgressIn] = Field(min_length=1, max_length=200)


class ProgressUpdateResponse(BaseModel):
    """Outcome per submitted chapter so the client can show what was accepted.

    ``accepted`` counts the chapters whose value was stored; ``rejected`` lists
    the ones refused. A confirmed skill / course / chapter that matches a stored
    value exactly is a no-op, not a rejection, so repeated submissions succeed.
    """

    accepted: int = Field(ge=0)
    updated: list[ChapterProgressIn] = Field(default_factory=list)
    rejected: list[RejectedChapter] = Field(default_factory=list)


class CheckinRequest(BaseModel):
    local_date: date


class CheckinResponse(BaseModel):
    checked_on: date
    # True when this call created the row; False when the day was already checked in.
    created: bool
    streak_days: int = Field(ge=0)


class CalendarDay(BaseModel):
    day: date
    checked_in: bool
    studied: bool
    chapters_touched: int = Field(ge=0)


class CalendarResponse(BaseModel):
    from_date: date
    to_date: date
    days: list[CalendarDay]
    streak_days: int = Field(ge=0)
    total_checked_in: int = Field(ge=0)


class SkillSummary(BaseModel):
    """Per-skill rollup used to choose recommendations and to write the brief."""

    skill_id: str
    # Chapters the skill contains, per the client's catalogue.
    total_chapters: int = Field(ge=0)
    target_value: int = Field(ge=0)
    earned_value: int = Field(ge=0)
    progress: float = Field(ge=0, le=1)
    last_studied_on: date | None = None
    studied_today: bool = False
    # False when the skill has no chapter data, so it cannot be recommended.
    is_candidate: bool


class SummaryResponse(BaseModel):
    local_date: date
    streak_days: int = Field(ge=0)
    checked_in_today: bool
    skills: list[SkillSummary]
    # Selected skills the client reported, including ones with no chapter data.
    selected_skill_count: int = Field(ge=0)


class Recommendation(BaseModel):
    skill_id: str
    skill_name: str
    reason: str = Field(min_length=1, max_length=400)
    progress: float = Field(ge=0, le=1)
    importance_pct: int | None = Field(default=None, ge=0, le=100)


class BriefSkillInput(BaseModel):
    """One selected skill as the client's catalogue describes it."""

    skill_id: str = Field(min_length=1, max_length=120)
    total_chapters: int = Field(ge=0, le=2000)
    skill_name: str | None = Field(default=None, max_length=120)
    importance_pct: int | None = Field(default=None, ge=0, le=100)


class SummaryRequest(BaseModel):
    """The client's catalogue shape for the skills it wants summarised."""

    local_date: date
    skills: list[BriefSkillInput] = Field(min_length=1, max_length=60)


class DailyBriefRequest(BaseModel):
    """Everything the server needs to build one day's brief.

    The client supplies its catalogue shape (which skill holds how many chapters
    in total) and the skill importance, because the course catalogue currently
    lives in the frontend. The server owns the progress and check-in records, the
    recommendation order and the wording constraints.
    """

    local_date: date
    # The learner's local hour (0–23), so the greeting matches their day rather
    # than the server's timezone.
    local_hour: int = Field(ge=0, le=23)
    # Optional display name for the greeting; the server never derives one.
    display_name: str | None = Field(default=None, max_length=60)
    skills: list[BriefSkillInput] = Field(min_length=1, max_length=60)


class DailyBriefResponse(BaseModel):
    local_date: date
    # Which brief variant this is: before or after the day's check-in.
    variant: Literal['before_checkin', 'after_checkin']
    checked_in_today: bool
    streak_days: int = Field(ge=0)
    greeting: str = Field(min_length=1, max_length=200)
    summary: str = Field(min_length=1, max_length=600)
    recommendations: list[Recommendation] = Field(default_factory=list)
    closing: str = Field(min_length=1, max_length=300)
    # True when the text came from the language model; False for the deterministic
    # template used when the provider is unavailable.
    generated_by_model: bool
    generated_at: datetime
    cached: bool = False


__all__ = [
    'CalendarDay',
    'CalendarResponse',
    'CheckinRequest',
    'CheckinResponse',
    'ChapterProgressIn',
    'DailyBriefRequest',
    'DailyBriefResponse',
    'BriefSkillInput',
    'ProgressUpdateRequest',
    'ProgressUpdateResponse',
    'Recommendation',
    'RejectedChapter',
    'SkillSummary',
    'SummaryRequest',
    'SummaryResponse',
    'MAX_BACKFILL_DAYS',
]
