import uuid
from datetime import datetime, timedelta, timezone

try:
    from datetime import UTC
except ImportError:
    UTC = timezone.utc

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.db.session import get_db
from app.models.refresh_token import RefreshToken
from app.models.user import User
from app.repositories.users import UserRepository
from app.schemas.auth import LoginRequest
from app.schemas.user import UserCreate


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
        if not user or not verify_password(payload.password, user.hashed_password):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid credentials.')

        access_token, refresh_token = await AuthService.issue_token_pair(db, user)
        return user, access_token, refresh_token

    @staticmethod
    async def issue_token_pair(db: AsyncSession, user: User) -> tuple[str, str]:
        jti = uuid.uuid4().hex
        access_token = create_access_token(str(user.id))
        refresh_token = create_refresh_token(str(user.id), jti)

        refresh_token_obj = RefreshToken(
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
        subject = payload.get('sub')
        if not jti or not subject:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid refresh payload.')

        result = await db.execute(select(RefreshToken).where(RefreshToken.token_jti == jti))
        db_token = result.scalar_one_or_none()
        if not db_token or db_token.revoked_at or db_token.expires_at < datetime.now(UTC):
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Refresh token expired.')

        db_token.revoked_at = datetime.now(UTC)
        await db.commit()

        user = await UserRepository.get_by_id(db, uuid.UUID(subject))
        if not user:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found.')

        return await AuthService.issue_token_pair(db, user)

    @staticmethod
    async def revoke(db: AsyncSession, token: str | None) -> None:
        if not token:
            return
        payload = decode_token(token)
        if not payload:
            return
        jti = payload.get('jti')
        if not jti:
            return
        result = await db.execute(select(RefreshToken).where(RefreshToken.token_jti == jti))
        db_token = result.scalar_one_or_none()
        if db_token and not db_token.revoked_at:
            db_token.revoked_at = datetime.now(UTC)
            await db.commit()


async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)) -> User:
    token = request.cookies.get(settings.access_cookie_name)
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Missing auth cookie.')

    payload = decode_token(token)
    if not payload or payload.get('type') != 'access':
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid access token.')

    subject = payload.get('sub')
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='Invalid token subject.')

    user = await UserRepository.get_by_id(db, uuid.UUID(subject))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail='User not found.')

    return user
