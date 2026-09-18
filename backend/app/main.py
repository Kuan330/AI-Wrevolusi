from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import init_models
from app.middleware.timing import RequestTimingMiddleware, snapshot_metrics
from app.routers import (
    accounts,
    ai,
    auth,
    capabilities,
    exposure,
    learning,
    occupations,
    possibilities,
    preparation,
    reference,
    schedule,
    skill_directions,
    tasks,
    users,
)


def create_app(api_root: str = '/api') -> FastAPI:
    application = FastAPI(
        title=settings.app_name,
        version=settings.api_version,
        docs_url='/docs',
        redoc_url='/redoc',
    )

    # Last added middleware is outermost: timing wraps CORS + route work.
    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=['*'],
        allow_headers=['*'],
    )
    application.add_middleware(RequestTimingMiddleware)

    api_root = api_root.rstrip('/')
    api_prefix = f'{api_root}/{settings.api_version}'
    application.include_router(ai.router, prefix=api_prefix)
    application.include_router(auth.router, prefix=api_prefix)
    application.include_router(accounts.router, prefix=api_prefix)
    application.include_router(users.router, prefix=api_prefix)
    application.include_router(occupations.router, prefix=api_prefix)
    application.include_router(tasks.router, prefix=api_prefix)
    application.include_router(exposure.router, prefix=api_prefix)
    application.include_router(capabilities.router, prefix=api_prefix)
    application.include_router(possibilities.router, prefix=api_prefix)
    application.include_router(preparation.router, prefix=api_prefix)
    application.include_router(schedule.router, prefix=api_prefix)
    application.include_router(reference.router, prefix=api_prefix)
    application.include_router(skill_directions.router, prefix=api_prefix)
    application.include_router(learning.router, prefix=api_prefix)

    @application.on_event('startup')
    async def startup_event() -> None:
        if settings.auto_create_tables:
            await init_models()

    @application.get(f'{api_root}/healthz', tags=['System'])
    async def health_check() -> dict[str, str]:
        return {'status': 'ok'}

    @application.get(f'{api_root}/metrics', tags=['System'])
    async def request_metrics() -> dict:
        """In-process latency snapshot for the hot endpoints under load."""

        return snapshot_metrics()

    return application


app = create_app()
