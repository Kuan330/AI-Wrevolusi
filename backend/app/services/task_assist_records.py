"""Atomic persistence for the one-answer-per-server-task Task Assist boundary."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal, Sequence

from sqlalchemy import case, func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.task_status import TaskStatus
from app.models.task import Task
from app.models.task_assist import TaskAssistInteraction
from app.schemas.task_assist import TaskAssistDetailInput, TaskAssistResponse
from app.services.exposure import infer_exposure_state
from app.services.task_assist import deterministic_task_assist

PENDING_RECOVERY_AFTER = timedelta(minutes=2)
ClaimOutcome = Literal['claimed', 'completed', 'pending', 'missing']


@dataclass(frozen=True)
class ClaimResult:
    outcome: ClaimOutcome
    row: TaskAssistInteraction | None
    claim_token: uuid.UUID | None = None


async def register_details(
    db: AsyncSession,
    user_id: uuid.UUID,
    details: Sequence[TaskAssistDetailInput],
) -> list[TaskAssistInteraction]:
    """Create/update server-owned Tasks, then register their immutable answer slots."""

    rows: list[TaskAssistInteraction] = []
    for detail in details:
        exposure_type, _, _ = infer_exposure_state(detail.task_text)
        task_statement = insert(Task).values(
            id=uuid.uuid4(),
            user_id=user_id,
            profile_task_id=detail.profile_task_id,
            title=detail.task_text,
            description=detail.notes or None,
            status=TaskStatus.needs_review,
            exposure_type=exposure_type,
            context={'source': 'profile_task'},
        )
        task_statement = task_statement.on_conflict_do_update(
            constraint='uq_tasks_user_profile_task',
            set_={
                'title': task_statement.excluded.title,
                'description': task_statement.excluded.description,
                'exposure_type': task_statement.excluded.exposure_type,
                'updated_at': func.now(),
            },
        ).returning(Task)
        task = (await db.execute(task_statement)).scalar_one()

        interaction_statement = insert(TaskAssistInteraction).values(
            id=uuid.uuid4(),
            user_id=user_id,
            task_id=task.id,
            task_text=task.title,
            notes=task.description or '',
            status='available',
            needs_user_confirmation=True,
        )
        excluded = interaction_statement.excluded
        mutable = TaskAssistInteraction.status == 'available'
        interaction_statement = interaction_statement.on_conflict_do_update(
            constraint='uq_task_assist_user_task',
            set_={
                'task_text': case(
                    (mutable, excluded.task_text),
                    else_=TaskAssistInteraction.task_text,
                ),
                'notes': case(
                    (mutable, excluded.notes),
                    else_=TaskAssistInteraction.notes,
                ),
            },
        ).returning(TaskAssistInteraction)
        row = (await db.execute(interaction_statement)).scalar_one()
        rows.append(row)
    await db.commit()
    return rows


async def get_interaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    task_id: uuid.UUID,
) -> TaskAssistInteraction | None:
    result = await db.execute(
        select(TaskAssistInteraction).where(
            TaskAssistInteraction.user_id == user_id,
            TaskAssistInteraction.task_id == task_id,
        )
    )
    return result.scalar_one_or_none()


async def claim_interaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    task_id: uuid.UUID,
    *,
    question: str,
) -> ClaimResult:
    """Atomically grant the only provider-call claim for this server-owned Task."""

    now = datetime.now(timezone.utc)
    claim_token = uuid.uuid4()
    statement = (
        update(TaskAssistInteraction)
        .where(
            TaskAssistInteraction.user_id == user_id,
            TaskAssistInteraction.task_id == task_id,
            TaskAssistInteraction.status == 'available',
        )
        .values(
            status='pending',
            claim_token=claim_token,
            claimed_at=now,
            question=question,
        )
        .returning(TaskAssistInteraction)
        .execution_options(synchronize_session=False)
    )
    row = (await db.execute(statement)).scalar_one_or_none()
    if row is not None:
        await db.commit()
        return ClaimResult('claimed', row, claim_token)

    await db.rollback()
    existing = await get_interaction(db, user_id, task_id)
    if existing is None:
        return ClaimResult('missing', None)
    if existing.status == 'completed':
        return ClaimResult('completed', existing)
    return ClaimResult('pending', existing)


async def complete_interaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    task_id: uuid.UUID,
    claim_token: uuid.UUID,
    *,
    question: str,
    response: TaskAssistResponse,
) -> TaskAssistInteraction:
    """Persist the only answer, but only for the request that owns the claim."""

    statement = (
        update(TaskAssistInteraction)
        .where(
            TaskAssistInteraction.user_id == user_id,
            TaskAssistInteraction.task_id == task_id,
            TaskAssistInteraction.status == 'pending',
            TaskAssistInteraction.claim_token == claim_token,
        )
        .values(
            status='completed',
            question=question,
            reply=response.reply,
            generated_by_model=response.generated_by_model,
            needs_user_confirmation=response.needs_user_confirmation,
            completed_at=datetime.now(timezone.utc),
            claim_token=None,
            claimed_at=None,
        )
        .returning(TaskAssistInteraction)
        .execution_options(synchronize_session=False)
    )
    row = (await db.execute(statement)).scalar_one_or_none()
    if row is None:
        await db.rollback()
        raise RuntimeError('Task Assist claim no longer belongs to this request.')
    await db.commit()
    return row


async def resolve_stale_pending(
    db: AsyncSession,
    user_id: uuid.UUID,
    task_id: uuid.UUID,
) -> TaskAssistInteraction | None:
    """Finish an abandoned claim with fallback without starting another provider call."""

    existing = await get_interaction(db, user_id, task_id)
    if existing is None or existing.status != 'pending':
        return existing
    claimed_at = existing.claimed_at
    if claimed_at is None or existing.question is None:
        return existing
    if claimed_at >= datetime.now(timezone.utc) - PENDING_RECOVERY_AFTER:
        return existing

    fallback = deterministic_task_assist(existing.task_text)
    statement = (
        update(TaskAssistInteraction)
        .where(
            TaskAssistInteraction.user_id == user_id,
            TaskAssistInteraction.task_id == task_id,
            TaskAssistInteraction.status == 'pending',
            TaskAssistInteraction.claimed_at == claimed_at,
        )
        .values(
            status='completed',
            question=existing.question,
            reply=fallback.reply,
            generated_by_model=False,
            needs_user_confirmation=True,
            completed_at=datetime.now(timezone.utc),
            claim_token=None,
            claimed_at=None,
        )
        .returning(TaskAssistInteraction)
        .execution_options(synchronize_session=False)
    )
    recovered = (await db.execute(statement)).scalar_one_or_none()
    if recovered is not None:
        await db.commit()
        return recovered
    await db.rollback()
    return await get_interaction(db, user_id, task_id)
