from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import request_validation_exception_handler
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.db.session import init_models
from app.middleware.timing import RequestTimingMiddleware, snapshot_metrics
from app.routers import (
    accounts,
    ai,
    auth,
    capabilities,
    exposure,
    guided_learning,
    learning,
    occupations,
    possibilities,
    preparation,
    progress_reviews,
    reference,
    resume,
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
    application.include_router(progress_reviews.router, prefix=api_prefix)
    application.include_router(guided_learning.router, prefix=api_prefix)
    application.include_router(resume.router, prefix=api_prefix)

    @application.middleware("http")
    async def private_resume_response(request, call_next):
        response = await call_next(request)
        if request.url.path.startswith(f"{api_prefix}/resume/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @application.exception_handler(RequestValidationError)
    async def private_validation(request, error):
        if request.url.path.startswith(f"{api_prefix}/resume/"):
            # FastAPI normally echoes rejected input (possibly contact details).
            return JSONResponse(status_code=422, content={"detail": "Invalid resume request. Check field types, limits and evidence review."}, headers={"Cache-Control": "no-store"})
        return await request_validation_exception_handler(request, error)

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
