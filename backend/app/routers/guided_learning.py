import asyncio
from contextlib import asynccontextmanager

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.account import Account
from app.routers.accounts import current_account
from app.schemas.guided_learning import GoalSuggestionRequest, TaskSuggestionsRequest
from app.services.guided_learning import goal_suggestion, saved_goal, saved_task, task_suggestions

router = APIRouter(prefix='/guided-learning', tags=['Guided learning'])
_active_accounts: set[str] = set()


@asynccontextmanager
async def generation_slot(account):
    # A small per-process guard against duplicate paid requests from one account.
    # This is not a distributed quota. Every operation has a deadline and releases
    # the slot on completion, failure or cancellation.
    key = str(account.user_id)
    if key in _active_accounts:
        raise HTTPException(429, 'A suggestion is already being prepared for your account. Please wait.')
    _active_accounts.add(key)
    try:
        async with asyncio.timeout(70):
            yield
    except TimeoutError as error:
        raise HTTPException(503, 'Guided suggestions took too long. Your saved work is unchanged. Please try again.') from error
    finally:
        _active_accounts.discard(key)


async def fresh_account(db, account):
    # Generation can outlive a profile edit in another tab. Check current saved
    # evidence again before returning a suggestion, without writing any records.
    return await db.scalar(select(Account).where(Account.user_id == account.user_id).execution_options(populate_existing=True))


@router.post('/task-suggestions')
async def suggest_task(payload: TaskSuggestionsRequest, account: Account = Depends(current_account), db: AsyncSession = Depends(get_db)):
    task = saved_task(account.workspace, payload.task_id, payload.expected_wording)
    async with generation_slot(account):
        result = await task_suggestions(db, task)
        current = await fresh_account(db, account)
        saved_task(current.workspace if current else {}, payload.task_id, payload.expected_wording)
        return result


@router.post('/goal-suggestion')
async def suggest_goal(payload: GoalSuggestionRequest, account: Account = Depends(current_account), db: AsyncSession = Depends(get_db)):
    goal = saved_goal(account.workspace, payload.goal_id, payload.expected_revision)
    async with generation_slot(account):
        result = await goal_suggestion(db, goal)
        current = await fresh_account(db, account)
        saved_goal(current.workspace if current else {}, payload.goal_id, payload.expected_revision)
        return result
