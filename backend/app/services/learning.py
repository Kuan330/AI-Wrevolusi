"""Pure helpers for learning progress, check-in streaks and recommendation order.

Everything here is a pure function over plain values: no database session, no
clock, no provider. That keeps the rules that decide what the learner is told
directly testable, and it means the storage layer can change without touching
them.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, timedelta

from app.models.learning import CHAPTER_VALUE_MAX

# A skill needs at least one chapter before it can be recommended. Skills with no
# chapter data report 0 progress forever, which would otherwise look like "the
# most behind skill" and win the recommendation every single day.
MIN_CHAPTERS_TO_RECOMMEND = 1

# Recommendations offered per brief.
RECOMMENDATION_COUNT = 2

# The brief only makes recommendations when the learner selected more than this
# many skills. With two or fewer there is nothing meaningful to choose between.
MIN_SKILLS_FOR_RECOMMENDATION = 3


@dataclass(frozen=True)
class ChapterValue:
    """A stored chapter value, as read from the progress table."""

    skill_id: str
    course_id: str
    chapter_index: int
    value: int
    last_studied_on: date


@dataclass(frozen=True)
class SkillRollup:
    """What one selected skill currently looks like to the brief."""

    skill_id: str
    skill_name: str
    total_chapters: int
    target_value: int
    earned_value: int
    progress: float
    last_studied_on: date | None
    studied_today: bool
    importance_pct: int | None
    is_candidate: bool


def clamp_chapter_value(value: int) -> int:
    """Keep a reported chapter value inside the 0–10 scale."""

    return max(0, min(CHAPTER_VALUE_MAX, value))


def progress_for(earned_value: int, total_chapters: int) -> float:
    """Fraction of a skill completed, using the full-scale target.

    A skill with N chapters has a target of ``N * 10``, because every chapter is
    reported on the same 0–10 scale.
    """

    target = text_or_zero(total_chapters) * CHAPTER_VALUE_MAX
    if target <= 0:
        return 0.0
    return max(0.0, min(1.0, earned_value / target))


def text_or_zero(value: int | None) -> int:
    return value if isinstance(value, int) and value > 0 else 0


def rollup_skill(
    *,
    skill_id: str,
    skill_name: str,
    total_chapters: int,
    values: Sequence[ChapterValue],
    today: date,
    importance_pct: int | None = None,
) -> SkillRollup:
    """Summarise one skill from its stored chapter values."""

    target = text_or_zero(total_chapters) * CHAPTER_VALUE_MAX
    earned = sum(clamp_chapter_value(item.value) for item in values)

    studied_days = [item.last_studied_on for item in values]
    last_studied = max(studied_days) if studied_days else None
    studied_today = today in studied_days

    return SkillRollup(
        skill_id=skill_id,
        skill_name=skill_name,
        total_chapters=text_or_zero(total_chapters),
        target_value=target,
        earned_value=earned,
        progress=progress_for(earned, total_chapters),
        last_studied_on=last_studied,
        studied_today=studied_today,
        importance_pct=importance_pct,
        is_candidate=text_or_zero(total_chapters) >= MIN_CHAPTERS_TO_RECOMMEND,
    )


def streak_days(checked_days: Iterable[date], today: date) -> int:
    """Consecutive check-in days ending today, or ending yesterday if today is open.

    Counting strictly from today would show ``0`` for a learner who checked in
    yesterday but has not opened the app today yet — which reads as "your streak
    is gone" and defeats the point of the streak. So an unchecked today does not
    break the streak; it is simply not counted yet.
    """

    days = set(checked_days)
    if not days:
        return 0

    cursor = today if today in days else today - timedelta(days=1)
    total = 0
    while cursor in days:
        total += 1
        cursor -= timedelta(days=1)
    return total


def order_recommendations(
    skills: Sequence[SkillRollup],
    *,
    exclude_studied_today: bool,
) -> list[SkillRollup]:
    """Rank skills for today's recommendations.

    Rules, in order:

    1. Only skills with chapter data can be recommended (a skill with no chapters
       would always look like the most behind one).
    2. When the brief follows a check-in, skills already studied today are left
       out: the learner was just told they are done, so suggesting the same skill
       again is noise.
    3. Skills with the **lowest** progress come first — the biggest gap is the most
       useful next step.
    4. Ties break on the highest skill importance, then on the skill id so the
       order is stable rather than dependent on dict iteration.
    """

    pool = [skill for skill in skills if skill.is_candidate]
    if exclude_studied_today:
        pool = [skill for skill in pool if not skill.studied_today]

    def sort_key(skill: SkillRollup) -> tuple[float, int, str]:
        return (
            round(skill.progress, 6),
            -(skill.importance_pct if skill.importance_pct is not None else -1),
            skill.skill_id,
        )

    return sorted(pool, key=sort_key)


def select_recommendations(
    skills: Sequence[SkillRollup],
    *,
    exclude_studied_today: bool,
) -> list[SkillRollup]:
    """Apply the recommendation gate and return at most two skills."""

    if len(skills) < MIN_SKILLS_FOR_RECOMMENDATION:
        return []
    ordered = order_recommendations(skills, exclude_studied_today=exclude_studied_today)
    return ordered[:RECOMMENDATION_COUNT]


def days_with_progress(values: Sequence[ChapterValue]) -> set[date]:
    """Every day on which any chapter changed — used to mark calendar days."""

    return {item.last_studied_on for item in values}


def chapters_touched_on(values: Sequence[ChapterValue], day: date) -> int:
    return sum(1 for item in values if item.last_studied_on == day)


def merge_chapter_value(
    existing: ChapterValue | None,
    *,
    skill_id: str,
    course_id: str,
    chapter_index: int,
    value: int,
    local_date: date,
) -> tuple[ChapterValue | None, str | None]:
    """Decide what to store for one submitted chapter.

    Returns ``(record_to_store, rejection_reason)``. A value that matches what is
    already stored is a no-op — repeated submissions of the same day must not be
    treated as an error, or a double-tap would look like a failure to the learner.
    Lower values are refused: progress only ever moves forward.
    """

    clamped = clamp_chapter_value(value)

    if existing is None:
        return (
            ChapterValue(
                skill_id=skill_id,
                course_id=course_id,
                chapter_index=chapter_index,
                value=clamped,
                last_studied_on=local_date,
            ),
            None,
        )

    if clamped == existing.value:
        # Same value again: nothing changes, including the study date. A chapter
        # must not look "studied today" because someone re-sent yesterday's value.
        return None, None

    if clamped < existing.value:
        return None, 'not_increase'

    return (
        ChapterValue(
            skill_id=skill_id,
            course_id=course_id,
            chapter_index=chapter_index,
            value=clamped,
            last_studied_on=local_date,
        ),
        None,
    )
