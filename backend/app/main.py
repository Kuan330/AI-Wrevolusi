from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.db.session import init_models
from app.routers import (
    auth,
    capabilities,
    exposure,
    occupations,
    preparation,
    schedule,
    tasks,
    users,
)

app = FastAPI(
    title=settings.app_name,
    version=settings.api_version,
    docs_url='/docs',
    redoc_url='/redoc',
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

api_prefix = f'/api/{settings.api_version}'
app.include_router(auth.router, prefix=api_prefix)
app.include_router(users.router, prefix=api_prefix)
app.include_router(occupations.router, prefix=api_prefix)
app.include_router(tasks.router, prefix=api_prefix)
app.include_router(exposure.router, prefix=api_prefix)
app.include_router(capabilities.router, prefix=api_prefix)
app.include_router(preparation.router, prefix=api_prefix)
app.include_router(schedule.router, prefix=api_prefix)


@app.on_event('startup')
async def startup_event() -> None:
    if settings.auto_create_tables:
        await init_models()


@app.get('/healthz', tags=['System'])
async def health_check() -> dict[str, str]:
    return {'status': 'ok'}
