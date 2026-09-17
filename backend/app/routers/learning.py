"""Learning progress, check-in calendar and the daily brief endpoints.

The routes own authentication and input sanity checks; the rules live in
:mod:`app.services.learning` (pure) and :mod:`app.services.daily_brief` (wording
constraints). Every response is built from the caller's own records — the user id
always comes from the auth cookie, never from the request body.
"""

from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.learning import (
    MAX_BACKFILL_DAYS,
    CalendarDay,
    CalendarResponse,
    CheckinRequest,
    CheckinResponse,
    DailyBriefRequest,
    DailyBriefResponse,
    ProgressUpdateRequest,
    ProgressUpdateResponse,
    Recommendation,
    RejectedChapter,
    SkillSummary,
    SummaryRequest,
    SummaryResponse,
)
from app.services import learning_records as records
from app.services.ai_gateway import AIGateway, default_ai_gateway
from app.services.auth import get_current_user
from app.services import catalogue as catalogue_service
from app.services.catalogue import build_bot_catalogue
from app.services.daily_brief import (
    BriefFacts,
    build_brief,
    greeting_for_hour,
)
from app.services.learning import (
    days_with_progress,
    rollup_skill,
    select_recommendations,
    streak_days,
)

router = APIRouter(prefix='/learning', tags=['Learning'])


def get_ai_gateway() -> AIGateway:
    """Dependency seam for the optional structured-output provider."""

    return default_ai_gateway()


def _check_local_date(value: date) -> None:
    """Reject dates a client could not plausibly mean.

    The learner's own device decides what "today" is, so the server only guards
    against nonsense: a date in the future, or one so old it cannot be a real
    study day.
    """

    today = datetime.now(timezone.utc).date()
    if value > today + timedelta(days=1):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='The supplied date is in the future.',
        )
    if value < today - timedelta(days=MAX_BACKFILL_DAYS):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='The supplied date is too far in the past.',
        )


@router.get('/catalogue')
async def catalogue_for_bot(db: AsyncSession = Depends(get_db)) -> list[dict]:
    """Return the verified catalogue in the shape needed by the daily brief Bot."""

    result = await db.execute(
        text(
            'SELECT s.wef_skill_id, s.core_skill, '
            's.core_skill_importance_2025_pct, c.course_code, c.title AS course_title, '
            'c.provider, c.url AS course_url, c.level, c.course_no, '
            'COUNT(ch.id) AS chapter_count '
            'FROM ref_wef_skills AS s '
            'JOIN catalogue_courses AS c ON c.skill_id = s.wef_skill_id '
            'LEFT JOIN catalogue_chapters AS ch ON ch.course_id = c.id '
            'GROUP BY s.wef_skill_id, s.core_skill, '
            's.core_skill_importance_2025_pct, c.course_code, c.title, c.provider, '
            'c.url, c.level, c.course_no '
            'ORDER BY s.wef_skill_id, c.level, c.course_no, c.course_code'
        )
    )
    return build_bot_catalogue(result.mappings().all())


@router.get('/courses')
async def list_catalogue_courses(
    skill: str | None = Query(default=None, max_length=80),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Verified catalogue for the Learning Resources page.

    ``skill`` accepts either a skill name ("AI and big data") or its stable
    slug ("ai-and-big-data"). Courses for that skill are returned easiest
    first (Beginner -> Intermediate -> Advanced, then course_no). An unknown
    skill returns ``found: false`` with an empty course list so the page can
    show its "no courses for this skill" state instead of guessing.
    """

    skill_rows = (
        await db.execute(
            text('SELECT wef_skill_id, core_skill FROM ref_wef_skills')
        )
    ).mappings().all()

    requested_slug = catalogue_service.skill_slug(skill) if skill else None
    resolved_id = None
    resolved_name = None
    if skill:
        for row in skill_rows:
            name = str(row.get('core_skill') or '')
            if catalogue_service.skill_slug(name) == requested_slug:
                resolved_id = int(row.get('wef_skill_id'))
                resolved_name = name
                break
    found = not skill or resolved_id is not None

    if skill is None:
        where_clause = ''
        params = {}
    elif found:
        where_clause = 'WHERE c.skill_id = :skill_id'
        params = {'skill_id': resolved_id}
    else:
        where_clause = 'WHERE FALSE'
        params = {}
    course_sql = (
        'SELECT s.wef_skill_id, s.core_skill, c.course_code, c.title, '
        'c.provider, c.url, c.level, c.course_no, c.language, c.format, '
        'c.self_paced, c.duration_min, c.register, c.course_description, '
        'c.outcomes, c.prereq, c.advice, COUNT(ch.id) AS chapter_count '
        'FROM catalogue_courses AS c '
        'JOIN ref_wef_skills AS s ON s.wef_skill_id = c.skill_id '
        'LEFT JOIN catalogue_chapters AS ch ON ch.course_id = c.id '
        f'{where_clause} '
        'GROUP BY s.wef_skill_id, s.core_skill, c.id'
    )
    course_rows = (
        await db.execute(text(course_sql), params)
    ).mappings().all()

    chapter_sql = (
        'SELECT c.course_code, ch.chapter_order, ch.title, ch.duration_min '
        'FROM catalogue_courses AS c '
        'JOIN catalogue_chapters AS ch ON ch.course_id = c.id '
        f'{where_clause} '
        'ORDER BY c.course_code, ch.chapter_order'
    )
    chapter_rows = (
        await db.execute(text(chapter_sql), params)
    ).mappings().all()

    return {
        'skill_id': requested_slug,
        'skill_name': resolved_name,
        'found': found,
        'courses': catalogue_service.build_page_catalogue(
            course_rows, chapter_rows
        ),
    }


@router.post('/progress', response_model=ProgressUpdateResponse)
async def update_progress(
    payload: ProgressUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProgressUpdateResponse:
    """Record chapter values for one local day.

    Values are cumulative on a 0–10 scale and only move forward; a value lower
    than what is stored is rejected rather than clamped, so the learner sees why.
    """

    _check_local_date(payload.local_date)

    scope = await catalogue_service.load_catalogue_scope(db)
    valid_chapters = []
    scope_rejections = []
    for item in payload.chapters:
        if catalogue_service.validate_catalogue_scope(
            scope,
            skill_id=item.skill_id,
            course_id=item.course_id,
            chapter_index=item.chapter_index,
        ):
            valid_chapters.append(item)
        else:
            scope_rejections.append(
                RejectedChapter(
                    course_id=item.course_id,
                    chapter_index=item.chapter_index,
                    reason='unknown_scope',
                )
            )

    accepted, rejected = ([], [])
    if valid_chapters:
        accepted, rejected = await records.upsert_progress(
            db,
            current_user.id,
            local_date=payload.local_date,
            chapters=valid_chapters,
        )
    return ProgressUpdateResponse(
        accepted=len(accepted),
        updated=accepted,
        rejected=[*scope_rejections, *rejected],
    )


@router.post('/checkin', response_model=CheckinResponse)
async def create_checkin(
    payload: CheckinRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CheckinResponse:
    """Check in for one local day.

    A check-in requires that something was actually studied that day, otherwise
    the calendar and the streak could be filled without any learning behind them.
    """

    _check_local_date(payload.local_date)

    if not await records.has_progress_on(db, current_user.id, local_date=payload.local_date):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='There is no learning recorded for this day yet, so it cannot be checked in.',
        )

    created = await records.create_checkin(db, current_user.id, local_date=payload.local_date)
    days = await records.streak_reference_days(db, current_user.id)

    return CheckinResponse(
        checked_on=payload.local_date,
        created=created,
        streak_days=streak_days(days, payload.local_date),
    )


@router.get('/calendar', response_model=CalendarResponse)
async def calendar(
    from_date: date = Query(alias='from'),
    to_date: date = Query(alias='to'),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CalendarResponse:
    """Day-by-day check-in and study state for the calendar view."""

    if to_date < from_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='The range end is before its start.',
        )
    if (to_date - from_date).days > 366:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail='The requested range is longer than a year.',
        )

    checked = set(await records.list_checkin_days(db, current_user.id, from_date=from_date, to_date=to_date))
    # Progress rows only remember the day a chapter last changed, so a day counts
    # as "studied" when at least one chapter carries that day.
    values = await records.list_progress(db, current_user.id)
    studied = days_with_progress(values)

    days: list[CalendarDay] = []
    cursor = from_date
    while cursor <= to_date:
        touched = sum(1 for item in values if item.last_studied_on == cursor)
        days.append(
            CalendarDay(
                day=cursor,
                checked_in=cursor in checked,
                studied=cursor in studied,
                chapters_touched=touched,
            )
        )
        cursor += timedelta(days=1)

    reference = await records.streak_reference_days(db, current_user.id)
    return CalendarResponse(
        from_date=from_date,
        to_date=to_date,
        days=days,
        streak_days=streak_days(reference, to_date),
        total_checked_in=await records.count_checkins(db, current_user.id),
    )


@router.post('/summary', response_model=SummaryResponse)
async def summary(
    payload: SummaryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SummaryResponse:
    """Per-skill rollup for the learner's selected skills.

    ``skills`` describes the client's catalogue: for each selected skill, how
    many chapters it holds and what to call it. The server combines that shape
    with the stored values to produce progress. Skills with no chapter data are
    reported with ``is_candidate: false`` so the client can explain why they are
    not recommended yet.
    """

    _check_local_date(payload.local_date)

    inputs = payload.skills
    values = await records.list_progress_for_skills(
        db, current_user.id, [item.skill_id for item in inputs]
    )
    by_skill: dict[str, list] = {}
    for item in values:
        by_skill.setdefault(item.skill_id, []).append(item)

    # Chapter totals and display names come from the server-side catalogue, never
    # from the request: a client cannot inflate or shrink its own progress.
    catalogue = await catalogue_service.load_skill_catalogue(db)

    rollups = [
        rollup_skill(
            skill_id=item.skill_id,
            skill_name=_catalogue_name(catalogue, item.skill_id, item.skill_name),
            total_chapters=_catalogue_chapters(catalogue, item.skill_id),
            values=by_skill.get(item.skill_id, []),
            today=payload.local_date,
        )
        for item in inputs
    ]

    checked = await records.list_checkin_days(
        db, current_user.id, from_date=payload.local_date, to_date=payload.local_date
    )

    return SummaryResponse(
        local_date=payload.local_date,
        streak_days=streak_days(await records.streak_reference_days(db, current_user.id), payload.local_date),
        checked_in_today=bool(checked),
        skills=[
            SkillSummary(
                skill_id=item.skill_id,
                total_chapters=item.total_chapters,
                target_value=item.target_value,
                earned_value=item.earned_value,
                progress=item.progress,
                last_studied_on=item.last_studied_on,
                studied_today=item.studied_today,
                is_candidate=item.is_candidate,
            )
            for item in rollups
        ],
        selected_skill_count=len(inputs),
    )


@router.post('/daily-brief', response_model=DailyBriefResponse)
async def daily_brief(
    payload: DailyBriefRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    gateway: AIGateway = Depends(get_ai_gateway),
) -> DailyBriefResponse:
    """Today's brief: stored if one exists for this day and state, else generated.

    Two variants exist per day — before and after the check-in — so checking in
    produces a new brief while repeat visits stay stable.
    """

    _check_local_date(payload.local_date)

    values = await records.list_progress_for_skills(
        db, current_user.id, [item.skill_id for item in payload.skills]
    )
    by_skill: dict[str, list] = {}
    for item in values:
        by_skill.setdefault(item.skill_id, []).append(item)

    # The server owns chapter totals and importance; the request only names the
    # selected skills. This keeps recommendation ranking out of the client's hands.
    catalogue = await catalogue_service.load_skill_catalogue(db)

    rollups = [
        rollup_skill(
            skill_id=item.skill_id,
            skill_name=_catalogue_name(catalogue, item.skill_id, item.skill_name),
            total_chapters=_catalogue_chapters(catalogue, item.skill_id),
            values=by_skill.get(item.skill_id, []),
            today=payload.local_date,
            importance_pct=_catalogue_importance(catalogue, item.skill_id),
        )
        for item in payload.skills
    ]

    checked_today = bool(
        await records.list_checkin_days(db, current_user.id, from_date=payload.local_date, to_date=payload.local_date)
    )
    streak = streak_days(await records.streak_reference_days(db, current_user.id), payload.local_date)
    variant = 'after_checkin' if checked_today else 'before_checkin'

    stored = await records.get_stored_brief(
        db, current_user.id, brief_date=payload.local_date, variant=variant
    )
    if stored is not None:
        return _response_from_stored(stored, streak, checked_today)

    recommendations = select_recommendations(rollups, exclude_studied_today=checked_today)
    facts = BriefFacts(
        local_date=payload.local_date,
        local_hour=payload.local_hour,
        display_name=payload.display_name,
        checked_in_today=checked_today,
        streak_days=streak,
        recommendations=recommendations,
        skills=rollups,
    )

    text, used_model, _result = build_brief(facts=facts, gateway=gateway)
    # ``greeting`` is composed here rather than taken from the model: the
    # learner's local hour already decides it, so the wording cannot drift.
    greeting = greeting_for_hour(payload.local_hour, payload.display_name)

    response = DailyBriefResponse(
        local_date=payload.local_date,
        variant=variant,
        checked_in_today=checked_today,
        streak_days=streak,
        greeting=greeting,
        summary=text.summary,
        recommendations=_recommendations_from_text(text, recommendations),
        closing=text.closing,
        generated_by_model=used_model,
        generated_at=datetime.now(timezone.utc),
    )

    # Only model-written text is persisted. A template brief stays out of the
    # table so a provider outage early in the day does not freeze it for the day.
    if used_model:
        await records.store_brief(
            db,
            current_user.id,
            brief_date=payload.local_date,
            variant=variant,
            content=response.model_dump(mode='json'),
            generated_by_model=True,
        )

    return response


def _recommendations_from_text(text, rollups) -> list[Recommendation]:
    """Pair the model's prose with the facts the server decided."""

    reasons = {item.skill_id: item.reason for item in text.recommendations}
    return [
        Recommendation(
            skill_id=skill.skill_id,
            skill_name=skill.skill_name,
            reason=reasons.get(skill.skill_id, 'Part of your current plan.'),
            progress=skill.progress,
            importance_pct=skill.importance_pct,
        )
        for skill in rollups
    ]


def _catalogue_entry(catalogue: dict, skill_id: str) -> dict:
    return catalogue.get(skill_id, {}) if catalogue else {}


def _catalogue_chapters(catalogue: dict, skill_id: str) -> int:
    """Chapter total for a skill, from the database catalogue.

    A skill that is not in the catalogue reports ``0`` chapters, which the rollup
    marks ``is_candidate: false`` — it is simply never recommended.
    """

    return int(_catalogue_entry(catalogue, skill_id).get('total_chapters') or 0)


def _catalogue_importance(catalogue: dict, skill_id: str) -> int | None:
    return _catalogue_entry(catalogue, skill_id).get('importance_pct')


def _catalogue_name(catalogue: dict, skill_id: str, fallback: str | None) -> str:
    return _catalogue_entry(catalogue, skill_id).get('skill_name') or fallback or skill_id


def _response_from_stored(stored, streak: int, checked_today: bool) -> DailyBriefResponse:
    """Rebuild the response from a stored brief, keeping the text unchanged.

    ``streak_days`` and ``checked_in_today`` are refreshed because they are
    derived facts that may have moved since the brief was written, while the prose
    and its ``generated_at`` are left exactly as stored.
    """

    content = dict(stored.content or {})
    content.update(
        {
            'streak_days': streak,
            'checked_in_today': checked_today,
            'cached': True,
        }
    )
    return DailyBriefResponse.model_validate(content)


__all__ = ['router']
