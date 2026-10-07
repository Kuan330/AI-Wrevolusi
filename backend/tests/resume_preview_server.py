"""Local QA renderer only. Never use this synthetic-auth app in production."""
import os
os.environ['AI_API_KEY'] = ''
os.environ['AI_KEYLESS'] = 'false'
os.environ['AI_FALLBACK_ENABLED'] = 'false'
os.environ['AUTO_CREATE_TABLES'] = 'false'
os.environ['JWT_SECRET_KEY'] = 'synthetic-resume-browser-test-only'
from fastapi import FastAPI
from types import SimpleNamespace
from app.routers.resume import router
from app.services.auth import get_current_user

app = FastAPI()
app.include_router(router, prefix='/api/v1')
app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id='synthetic-browser-account')
