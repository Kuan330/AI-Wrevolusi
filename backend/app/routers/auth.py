from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import clear_auth_cookies, set_auth_cookies
from app.db.session import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenPairResponse
from app.schemas.user import UserCreate, UserRead
from app.services.auth import AuthService

router = APIRouter(prefix='/auth', tags=['Auth'])


@router.post('/register', response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)) -> UserRead:
    create_payload = UserCreate(
        email=payload.email,
        full_name=payload.full_name,
        password=payload.password,
    )
    user = await AuthService.register(db, payload=create_payload)
    return UserRead.model_validate(user)


@router.post('/login', response_model=TokenPairResponse)
async def login(payload: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)) -> TokenPairResponse:
    _, access_token, refresh_token = await AuthService.login(db, payload)
    set_auth_cookies(response, access_token, refresh_token)
    return TokenPairResponse(access_token=access_token, refresh_token=refresh_token)


@router.post('/refresh', response_model=TokenPairResponse)
async def refresh(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> TokenPairResponse:
    refresh_cookie = request.cookies.get(settings.refresh_cookie_name)
    access_token, refresh_token = await AuthService.refresh(db, refresh_cookie or '')
    set_auth_cookies(response, access_token, refresh_token)
    return TokenPairResponse(access_token=access_token, refresh_token=refresh_token)


@router.post('/logout', status_code=status.HTTP_204_NO_CONTENT)
async def logout(request: Request, response: Response, db: AsyncSession = Depends(get_db)) -> None:
    refresh_cookie = request.cookies.get(settings.refresh_cookie_name)
    await AuthService.revoke(db, refresh_cookie)
    clear_auth_cookies(response)
