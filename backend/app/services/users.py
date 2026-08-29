from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.users import UserRepository
from app.schemas.user import UserUpdate


class UserService:
    @staticmethod
    async def update_me(db: AsyncSession, user: User, payload: UserUpdate) -> User:
        if not user.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail='Inactive user.')
        return await UserRepository.update(db, user, payload)
