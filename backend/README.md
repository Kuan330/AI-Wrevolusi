# AI-Wrevolusi Backend

FastAPI backend scaffold for AI-Wrevolusi with PostgreSQL/Neon, SQLAlchemy 2.0, Alembic, Pydantic v2, and JWT + HttpOnly Cookie auth.

## Stack

- FastAPI
- PostgreSQL / Neon (`asyncpg`)
- SQLAlchemy 2.0 (async)
- Alembic migrations
- Pydantic v2 + pydantic-settings
- JWT access + refresh tokens in HttpOnly cookies

## Quick start

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env .env.local  # optional local copy
uvicorn app.main:app --reload
```

## Database & migrations

```bash
cd backend
alembic revision --autogenerate -m "init"
alembic upgrade head
```

Alembic reads `DATABASE_URL` from `.env`.

## API routing

- `/api/v1/auth`
- `/api/v1/users`
- `/api/v1/occupations`
- `/api/v1/tasks`
- `/api/v1/exposure`
- `/api/v1/capabilities`
- `/api/v1/preparation`
- `/api/v1/schedule`

## Suggested additions

1. `.env.example` without sensitive values for team onboarding.
2. `Dockerfile` + `docker-compose.yml` for consistent local DB/runtime.
3. Role-based authorization and audit logging for correction actions.
4. CI pipeline (lint, tests, migration check) on pull requests.
5. Redis-based token blacklist / rate limit for production hardening.
