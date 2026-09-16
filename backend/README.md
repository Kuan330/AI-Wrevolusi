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
uv sync
cp .env.example .env  # if .env does not exist yet
```

Set a real `DATABASE_URL` in `.env`, then start:

```bash
uv run uvicorn app.main:app --reload
```

Backend URL:

- API base: `http://127.0.0.1:8000/api/v1`
- Docs: `http://127.0.0.1:8000/docs`

## Database & migrations

```bash
cd backend
uv run alembic revision --autogenerate -m "init"
uv run alembic upgrade head
```

Alembic reads `DATABASE_URL` from `.env`.

## Dependency groups

`pyproject.toml` is the canonical Python dependency definition and `uv.lock`
pins the resolved versions. The default `dev` group provides Uvicorn, Alembic
and pytest. Repository-level tools are opt-in so their heavier packages are not
part of the deployed backend runtime:

```bash
# PostgreSQL / Neon seed and verification scripts
uv run --project backend --group database python db/test_import.py --strict

# Raw and reference-data processing
uv run --project backend --group data python data/raw/clean_row_tables.py
```

The requirements files are generated compatibility exports. Regenerate them
from the repository root after changing dependencies:

```bash
uv export --project backend --locked --no-dev --no-emit-project --no-hashes --output-file backend/requirements.txt
uv export --project backend --locked --only-group database --no-hashes --output-file db/requirements.txt
uv export --project backend --locked --only-group data --no-hashes --output-file data/raw/requirements.txt
```

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
