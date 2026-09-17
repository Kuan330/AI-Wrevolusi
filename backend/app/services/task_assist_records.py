"""Atomic persistence for isolated one-answer-per-profile-task Assist."""

import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Literal, Sequence

from sqlalchemy import case, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_assist import TaskAssistInteraction
from app.schemas.task_assist import TaskAssistDetailInput, TaskAssistResponse
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
    """Create or reuse account-scoped immutable answer slots."""
    rows: list[TaskAssistInteraction] = []
    for detail in details:
        statement = insert(TaskAssistInteraction).values(
            id=uuid.uuid4(),
            user_id=user_id,
            task_key=detail.task_key,
            task_text=detail.task_text,
            notes=detail.notes,
            status='available',
            needs_user_confirmation=True,
        )
        excluded = statement.excluded
        mutable = TaskAssistInteraction.status == 'available'
        statement = statement.on_conflict_do_update(
            constraint='uq_task_assist_user_task',
            set_={
                'task_text': case((mutable, excluded.task_text), else_=TaskAssistInteraction.task_text),
                'notes': case((mutable, excluded.notes), else_=TaskAssistInteraction.notes),
            },
        ).returning(TaskAssistInteraction)
        rows.append((await db.execute(statement)).scalar_one())
    await db.commit()
    return rows


async def get_interaction(db: AsyncSession, user_id: uuid.UUID, task_key: str) -> TaskAssistInteraction | None:
    result = await db.execute(
        select(TaskAssistInteraction).where(
            TaskAssistInteraction.user_id == user_id,
            TaskAssistInteraction.task_key == task_key,
        )
    )
    return result.scalar_one_or_none()


async def claim_interaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    task_key: str,
    *,
    question: str,
) -> ClaimResult:
    now = datetime.now(timezone.utc)
    claim_token = uuid.uuid4()
    statement = (
        update(TaskAssistInteraction)
        .where(
            TaskAssistInteraction.user_id == user_id,
            TaskAssistInteraction.task_key == task_key,
            TaskAssistInteraction.status == 'available',
        )
        .values(status='pending', claim_token=claim_token, claimed_at=now, question=question)
        .returning(TaskAssistInteraction)
        .execution_options(synchronize_session=False)
    )
    row = (await db.execute(statement)).scalar_one_or_none()
    if row is not None:
        await db.commit()
        return ClaimResult('claimed', row, claim_token)
    await db.rollback()
    existing = await get_interaction(db, user_id, task_key)
    if existing is None:
        return ClaimResult('missing', None)
    if existing.status == 'completed':
        return ClaimResult('completed', existing)
    return ClaimResult('pending', existing)


async def complete_interaction(
    db: AsyncSession,
    user_id: uuid.UUID,
    task_key: str,
    claim_token: uuid.UUID,
    *,
    response: TaskAssistResponse,
) -> TaskAssistInteraction:
    statement = (
        update(TaskAssistInteraction)
        .where(
            TaskAssistInteraction.user_id == user_id,
            TaskAssistInteraction.task_key == task_key,
            TaskAssistInteraction.status == 'pending',
            TaskAssistInteraction.claim_token == claim_token,
        )
        .values(
            status='completed', reply=response.reply,
            generated_by_model=response.generated_by_model,
            needs_user_confirmation=response.needs_user_confirmation,
            completed_at=datetime.now(timezone.utc), claim_token=None, claimed_at=None,
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
    db: AsyncSession, user_id: uuid.UUID, task_key: str
) -> TaskAssistInteraction | None:
    existing = await get_interaction(db, user_id, task_key)
    if existing is None or existing.status != 'pending':
        return existing
    if existing.claimed_at is None or existing.question is None:
        return existing
    if existing.claimed_at >= datetime.now(timezone.utc) - PENDING_RECOVERY_AFTER:
        return existing
    fallback = deterministic_task_assist(existing.task_text)
    statement = (
        update(TaskAssistInteraction)
        .where(
            TaskAssistInteraction.user_id == user_id,
            TaskAssistInteraction.task_key == task_key,
            TaskAssistInteraction.status == 'pending',
            TaskAssistInteraction.claimed_at == existing.claimed_at,
        )
        .values(
            status='completed', reply=fallback.reply, generated_by_model=False,
            needs_user_confirmation=True, completed_at=datetime.now(timezone.utc),
            claim_token=None, claimed_at=None,
        )
        .returning(TaskAssistInteraction)
        .execution_options(synchronize_session=False)
    )
    recovered = (await db.execute(statement)).scalar_one_or_none()
    if recovered is not None:
        await db.commit()
        return recovered
    await db.rollback()
    return await get_interaction(db, user_id, task_key)
