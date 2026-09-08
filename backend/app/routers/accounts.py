import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.models.account import Account
from app.models.user import User
from app.core.security import get_password_hash, verify_password, set_auth_cookies
from app.services.auth import AuthService, get_current_user

router = APIRouter(prefix='/account', tags=['Account'])


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r'^[a-zA-Z0-9_]+$')
    password: str = Field(min_length=8, max_length=128)

    @field_validator('username')
    @classmethod
    def normalize(cls, value: str) -> str:
        return value.lower()


class WorkspaceUpdate(BaseModel):
    owner_id: uuid.UUID
    data: dict[str, str]
    revision: int = Field(ge=0)

    @field_validator('data')
    @classmethod
    def validate_data(cls, data: dict[str, str]) -> dict[str, str]:
        allowed = {'aiwrevolusi.userProfile', 'aiwrevolusi.confirmedAnalysis', 'aiwrevolusi.learningCentre', 'aiwrevolusi.learningResourceSelections.v1', 'aiwrevolusi.planner.v1', 'aiwrevolusi.possibilities.saved', 'aiwrevolusi.possibilities.intent'}
        if not data.keys() <= allowed or len(json.dumps(data)) > 2_000_000:
            raise ValueError('Workspace is invalid or too large.')
        for value in data.values():
            json.loads(value)
        return data


async def current_account(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)) -> Account:
    account = await db.get(Account, user.id)
    if not account:
        raise HTTPException(401, 'Please log in with your username.')
    return account


def public(account: Account) -> dict:
    return {'id': str(account.user_id), 'username': account.username}


@router.post('/register', status_code=201)
async def register(payload: Credentials, response: Response, db: AsyncSession = Depends(get_db)):
    user = User(email=f'{uuid.uuid4().hex}@accounts.example.com', full_name=payload.username, hashed_password=get_password_hash(payload.password))
    db.add(user)
    await db.flush()
    account = Account(user_id=user.id, username=payload.username, workspace={}, revision=0)
    db.add(account)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(409, 'That username is already taken.')
    access, refresh = await AuthService.issue_token_pair(db, user)
    set_auth_cookies(response, access, refresh)
    return public(account)


@router.post('/login')
async def login(payload: Credentials, response: Response, db: AsyncSession = Depends(get_db)):
    account = await db.scalar(select(Account).where(Account.username == payload.username))
    user = await db.get(User, account.user_id) if account else None
    if not user or not user.is_active or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(401, 'Incorrect username or password.')
    access, refresh = await AuthService.issue_token_pair(db, user)
    set_auth_cookies(response, access, refresh)
    return public(account)


@router.get('/me')
async def me(account: Account = Depends(current_account)):
    return public(account)


@router.get('/workspace')
async def workspace(account: Account = Depends(current_account)):
    return {'owner_id': str(account.user_id), 'data': account.workspace, 'revision': account.revision}


@router.patch('/workspace')
async def save_workspace(payload: WorkspaceUpdate, account: Account = Depends(current_account), db: AsyncSession = Depends(get_db)):
    if payload.owner_id != account.user_id:
        raise HTTPException(409, 'Your signed-in account changed. Reload before saving.')
    # Lock the account row so concurrent sessions cannot silently overwrite changes.
    account = await db.scalar(select(Account).where(Account.user_id == account.user_id).with_for_update().execution_options(populate_existing=True))
    if payload.revision != account.revision:
        raise HTTPException(409, 'Your account changed in another session. Reload before saving again.')
    account.workspace = payload.data
    account.revision += 1
    await db.commit()
    return {'owner_id': str(account.user_id), 'data': account.workspace, 'revision': account.revision}
