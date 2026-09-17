# AI-Wrevolusi

AI-Wrevolusi monorepo for FIT5120, including:

- `frontend/`: React + TypeScript + Tailwind + shadcn/ui
- `backend/`: FastAPI + PostgreSQL/Neon + SQLAlchemy + Alembic
- `data/`: raw and normalized reference datasets
- `db/`: reference-table schema, seed, and verification scripts
- `docs/`: ERD and data-management documentation

## Project guides

- [Local setup and testing](docs/local-testing.md)
- [Vercel deployment](docs/deployment.md)
- [Reference-data management](docs/iteration1_data_management.md)
- [Frontend architecture](frontend/ARCHITECTURE.md)

## Python dependency management

The backend and repository Python tools use [uv](https://docs.astral.sh/uv/).
`backend/pyproject.toml` is the canonical dependency definition and
`backend/uv.lock` records the exact resolved versions. The checked-in
requirements files are compatibility exports generated from that lock; do not
edit them directly.

Python 3.12 is required and is selected by `backend/.python-version`.

## Start Backend

To start the backend and frontend together on automatically selected ports:

```bash
./dev
```

The command prints the actual application and API URLs. See the
[local testing guide](docs/local-testing.md) for options and separate-service
commands.

To start only the backend:

```bash
cd backend
uv sync --locked
```

Copy `backend/.env.example` to `backend/.env`, set a valid Neon development
`DATABASE_URL`, and replace `JWT_SECRET_KEY`. Never commit either secret. Then run:

```bash
uv run --locked uvicorn app.main:app --reload
```

Backend will run at:

- API base: `http://127.0.0.1:8000/api/v1`
- Swagger docs: `http://127.0.0.1:8000/docs`

## Start Frontend

Open a new terminal:

```bash
cd frontend
npm ci
npm run dev
```

Frontend will run at:

- App: `http://127.0.0.1:5173`

If backend URL changes, set in `frontend/.env`:

```env
VITE_API_BASE_URL=/api/v1
```

Vite proxies `/api` to the local FastAPI server during development.

## Start Order

1. Start backend first
2. Start frontend second
3. Open frontend URL in browser

## Reference Data

The existing Neon reference tables remain available through the SQLAlchemy-based
backend under `/api/v1/reference`:

- `GET /api/v1/reference/occupations`
- `GET /api/v1/reference/occupations/{code}`
- `GET /api/v1/reference/occupations/{code}/tasks`
- `GET /api/v1/reference/wef-skills`

To initialize or refresh those tables against the development database:

From the repository root:

```bash
uv run --project backend --group database python db/seed_reference.py --init
```

See `docs/iteration1_data_management.md` before promoting reference data.

## Deploy to Vercel

See the complete [deployment guide](docs/deployment.md) for environment
separation, Preview verification, Production promotion, and rollback.

The repository deploys as one Vercel Services project:

- `/` serves the Vite frontend.
- `/api` mounts the FastAPI service.
- Neon remains the external PostgreSQL database.

In Vercel, import this repository with the project root unchanged and select
**Services** as the Framework Preset. Add these environment variables for
Preview and Production without committing their values:

```env
DATABASE_URL=<Neon connection string>
JWT_SECRET_KEY=<strong random secret>
DEBUG=false
AUTO_CREATE_TABLES=false
COOKIE_SECURE=true
COOKIE_SAMESITE=lax
VITE_API_BASE_URL=/api/v1
```

Deploy a preview first, then verify `/api/healthz`, authentication, database
access, and direct navigation to frontend routes before promoting it.
