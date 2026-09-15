"""Database access for learning progress and check-in records.

Kept separate from :mod:`app.services.learning` so the rules that decide what the
learner is told stay pure and testable, while everything that touches the session
lives here.
"""

from collections.abc import Sequence
from datetime import date, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.learning import DailyBrief, LearningCheckin, LearningProgress
from app.schemas.learning import ChapterProgressIn, RejectedChapter
from app.services.learning import ChapterValue, clamp_chapter_value, merge_chapter_value

# Streak arithmetic walks back day by day through the learner's check-in history.
# This bounds that walk without any realistic streak ever reaching it.
MAX_STREAK_LOOKBACK_DAYS = 3650


def _to_value(row: LearningProgress) -> ChapterValue:
    return ChapterValue(
        skill_id=row.skill_id,
        course_id=row.course_id,
        chapter_index=row.chapter_index,
        value=row.value,
        last_studied_on=row.last_studied_on,
    )


async def list_progress(db: AsyncSession, user_id) -> list[ChapterValue]:
    """Every stored chapter value for one learner."""

    rows = (
        await db.execute(
            select(LearningProgress).where(LearningProgress.user_id == user_id)
        )
    ).scalars().all()
    return [_to_value(row) for row in rows]


async def list_progress_for_skills(
    db: AsyncSession,
    user_id,
    skill_ids: Sequence[str],
) -> list[ChapterValue]:
    """Stored chapter values limited to the supplied skills."""

    if not skill_ids:
        return []
    rows = (
        await db.execute(
            select(LearningProgress).where(
                LearningProgress.user_id == user_id,
                LearningProgress.skill_id.in_(list(skill_ids)),
            )
        )
    ).scalars().all()
    return [_to_value(row) for row in rows]


async def upsert_progress(
    db: AsyncSession,
    user_id,
    *,
    local_date: date,
    chapters: Sequence[ChapterProgressIn],
) -> tuple[list[ChapterProgressIn], list[RejectedChapter]]:
    """Store a batch of chapter values, enforcing the forward-only rule.

    Returns ``(accepted, rejected)``. A submission that repeats the stored value
    is treated as accepted-and-unchanged rather than rejected, so a double tap or
    a network retry never looks like a failure.
    """

    keys = {(item.skill_id, item.course_id, item.chapter_index) for item in chapters}
    existing_rows = (
        await db.execute(
            select(LearningProgress).where(
                LearningProgress.user_id == user_id,
                LearningProgress.skill_id.in_([key[0] for key in keys]),
            )
        )
    ).scalars().all()

    stored: dict[tuple[str, str, int], LearningProgress] = {
        (row.skill_id, row.course_id, row.chapter_index): row for row in existing_rows
    }

    accepted: list[ChapterProgressIn] = []
    rejected: list[RejectedChapter] = []

    for item in chapters:
        key = (item.skill_id, item.course_id, item.chapter_index)
        row = stored.get(key)
        current = (
            ChapterValue(
                skill_id=row.skill_id,
                course_id=row.course_id,
                chapter_index=row.chapter_index,
                value=row.value,
                last_studied_on=row.last_studied_on,
            )
            if row is not None
            else None
        )

        record, reason = merge_chapter_value(
            current,
            skill_id=item.skill_id,
            course_id=item.course_id,
            chapter_index=item.chapter_index,
            value=item.value,
            local_date=local_date,
        )

        if reason is not None:
            rejected.append(
                RejectedChapter(
                    course_id=item.course_id,
                    chapter_index=item.chapter_index,
                    reason=reason,
                    stored_value=row.value if row is not None else None,
                )
            )
            continue

        accepted.append(item)

        if record is None:
            # Identical value already stored: nothing to write, and crucially the
            # stored study date is left alone so the chapter does not appear as
            # "studied today" because of a re-send.
            continue

        if row is None:
            db.add(
                LearningProgress(
                    user_id=user_id,
                    skill_id=record.skill_id,
                    course_id=record.course_id,
                    chapter_index=record.chapter_index,
                    value=record.value,
                    last_studied_on=record.last_studied_on,
                )
            )
        else:
            row.value = clamp_chapter_value(record.value)
            row.last_studied_on = record.last_studied_on

    await db.commit()
    return accepted, rejected


async def list_checkin_days(
    db: AsyncSession,
    user_id,
    *,
    from_date: date | None = None,
    to_date: date | None = None,
) -> list[date]:
    """Check-in days, optionally bounded, newest first."""

    query = select(LearningCheckin.checked_on).where(LearningCheckin.user_id == user_id)
    if from_date is not None:
        query = query.where(LearningCheckin.checked_on >= from_date)
    if to_date is not None:
        query = query.where(LearningCheckin.checked_on <= to_date)
    rows = (await db.execute(query.order_by(LearningCheckin.checked_on.desc()))).scalars().all()
    return list(rows)


async def streak_reference_days(db: AsyncSession, user_id) -> list[date]:
    """Recent check-in days, bounded, for streak arithmetic."""

    oldest = date.today() - timedelta(days=MAX_STREAK_LOOKBACK_DAYS)
    return await list_checkin_days(db, user_id, from_date=oldest)


async def create_checkin(db: AsyncSession, user_id, *, local_date: date) -> bool:
    """Record a check-in. Returns ``True`` when this call created the row.

    A day can only be checked in once; repeating the call is a no-op so the
    calendar cannot be tapped twice into a different state.
    """

    existing = (
        await db.execute(
            select(LearningCheckin.id).where(
                LearningCheckin.user_id == user_id,
                LearningCheckin.checked_on == local_date,
            )
        )
    ).scalar_one_or_none()
    if existing is not None:
        return False

    db.add(LearningCheckin(user_id=user_id, checked_on=local_date))
    await db.commit()
    return True


async def has_progress_on(db: AsyncSession, user_id, *, local_date: date) -> bool:
    """Whether any chapter value was recorded for the given day."""

    found = (
        await db.execute(
            select(LearningProgress.id)
            .where(
                LearningProgress.user_id == user_id,
                LearningProgress.last_studied_on == local_date,
            )
            .limit(1)
        )
    ).scalar_one_or_none()
    return found is not None


async def count_checkins(db: AsyncSession, user_id) -> int:
    total = (
        await db.execute(
            select(func.count()).select_from(LearningCheckin).where(LearningCheckin.user_id == user_id)
        )
    ).scalar_one()
    return int(total or 0)


async def get_stored_brief(
    db: AsyncSession,
    user_id,
    *,
    brief_date: date,
    variant: str,
) -> DailyBrief | None:
    """The stored brief for a day and variant, if one exists."""

    return (
        await db.execute(
            select(DailyBrief).where(
                DailyBrief.user_id == user_id,
                DailyBrief.brief_date == brief_date,
                DailyBrief.variant == variant,
            )
        )
    ).scalar_one_or_none()


async def store_brief(
    db: AsyncSession,
    user_id,
    *,
    brief_date: date,
    variant: str,
    content: dict,
    generated_by_model: bool,
) -> DailyBrief:
    """Persist a brief, replacing any earlier one for the same day and variant.

    Called only for model-written briefs; a template brief is never stored, so an
    outage does not lock in plain wording for the rest of the day.
    """

    existing = await get_stored_brief(db, user_id, brief_date=brief_date, variant=variant)
    if existing is not None:
        existing.content = content
        existing.generated_by_model = generated_by_model
        await db.commit()
        return existing

    row = DailyBrief(
        user_id=user_id,
        brief_date=brief_date,
        variant=variant,
        generated_by_model=generated_by_model,
        content=content,
    )
    db.add(row)
    await db.commit()
    return row


async def delete_progress_for_skills(db: AsyncSession, user_id, skill_ids: Sequence[str]) -> int:
    """Remove stored progress for the given skills; used when a learner re-picks.

    Not wired to a route yet: the intended behaviour is to keep history, so this
    exists only for tests and administrative cleanup.
    """

    if not skill_ids:
        return 0
    result = await db.execute(
        delete(LearningProgress).where(
            LearningProgress.user_id == user_id,
            LearningProgress.skill_id.in_(list(skill_ids)),
        )
    )
    await db.commit()
    return int(result.rowcount or 0)


__all__ = [
    'MAX_STREAK_LOOKBACK_DAYS',
    'count_checkins',
    'create_checkin',
    'delete_progress_for_skills',
    'get_stored_brief',
    'has_progress_on',
    'list_checkin_days',
    'list_progress',
    'list_progress_for_skills',
    'store_brief',
    'streak_reference_days',
    'upsert_progress',
]
