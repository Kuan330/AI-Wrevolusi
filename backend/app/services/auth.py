import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    decode_logout_token,
    get_password_hash,
    verify_password,
)
from app.db.session import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.repositories.users import UserRepository
from app.schemas.auth import LoginRequest
from app.schemas.user import UserCreate


def session_identity(payload: dict) -> tuple[uuid.UUID, uuid.UUID]:
    try:
        return uuid.UUID(payload['sub']), uuid.UUID(payload['sid'])
    except (KeyError, ValueError, TypeError, AttributeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid session.') from None


class AuthService:
    @staticmethod
    async def register(db: AsyncSession, payload: UserCreate) -> User:
        existing = await UserRepository.get_by_email(db, payload.email)
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail='Email already registered.')
        hashed_password = get_password_hash(payload.password)
        return await UserRepository.create(db, payload, hashed_password)

    @staticmethod
    async def login(db: AsyncSession, payload: LoginRequest) -> tuple[User, str, str]:
        user = await UserRepository.get_by_email(db, payload.email)
        if not user or not user.is_active or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials.')

        access_token, refresh_token = await AuthService.issue_token_pair(db, user)
        return user, access_token, refresh_token

    @staticmethod
    async def issue_token_pair(db: AsyncSession, user: User) -> tuple[str, str]:
        jti = uuid.uuid4().hex
        session_id = uuid.uuid4()
        access_token = create_access_token(str(user.id), str(session_id))
        refresh_token = create_refresh_token(str(user.id), jti, str(session_id))

        refresh_token_obj = RefreshToken(
            id=session_id,
            user_id=user.id,
            token_jti=jti,
            expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_expire_days),
        )
        db.add(refresh_token_obj)
        await db.commit()

        return access_token, refresh_token

    @staticmethod
    async def refresh(db: AsyncSession, token: str) -> tuple[str, str]:
        payload = decode_token(token)
        if not payload or payload.get('type') != 'refresh':
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid refresh token.')

        jti = payload.get('jti')
        if not isinstance(jti, str) or not jti:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid refresh payload.')
        user_id, session_id = session_identity(payload)
        user = await UserRepository.get_by_id(db, user_id)
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid session.')
        now = datetime.now(UTC)
        next_jti = uuid.uuid4().hex
        result = await db.execute(
            update(RefreshToken).where(
                RefreshToken.id == session_id,
                RefreshToken.user_id == user_id,
                RefreshToken.token_jti == jti,
                RefreshToken.revoked_at.is_(None),
                RefreshToken.expires_at > now,
            ).values(
                token_jti=next_jti,
                expires_at=now + timedelta(days=settings.refresh_token_expire_days),
            ).returning(RefreshToken.id)
        )
        if result.scalar_one_or_none() is None:
            await db.rollback()
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Refresh token expired.')
        access = create_access_token(str(user_id), str(session_id))
        refresh = create_refresh_token(str(user_id), next_jti, str(session_id))
        await db.commit()
        return access, refresh

    @staticmethod
    async def revoke(db: AsyncSession, *tokens: str | None) -> None:
        for token in tokens:
            payload = decode_logout_token(token) if token else None
            if not payload or payload.get('type') not in ('access', 'refresh'):
                continue
            try:
                user_id, session_id = session_identity(payload)
            except HTTPException:
                continue
            await db.execute(update(RefreshToken).where(
                RefreshToken.id == session_id,
                RefreshToken.user_id == user_id,
                RefreshToken.revoked_at.is_(None),
            ).values(revoked_at=datetime.now(UTC)))
        await db.commit()


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = request.cookies.get(settings.access_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing auth cookie.')

    payload = decode_token(token)
    if not payload or payload.get('type') != 'access':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid access token.')

    user_id, session_id = session_identity(payload)
    result = await db.execute(select(User).join(RefreshToken, RefreshToken.user_id == User.id).where(
        User.id == user_id,
        User.is_active.is_(True),
        RefreshToken.id == session_id,
        RefreshToken.revoked_at.is_(None),
        RefreshToken.expires_at > datetime.now(UTC),
    ))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid session.')

    return user
