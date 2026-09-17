# Local testing

This guide covers the current local setup and test commands for the
AI-Wrevolusi frontend, backend, and data tools.

## Prerequisites

- UV
- Python 3.12; UV selects it from `backend/.python-version`
- Node.js 24 and npm; `frontend/.nvmrc` records the required Node major
- A Neon development connection string for database-backed checks

Use a development database locally. Do not point local table creation, seed,
or destructive reference-data commands at production.

## First-time setup

From the repository root, install the locked backend environment:

```bash
cd backend
uv sync --locked
test -f .env || cp .env.example .env
```

In `backend/.env`, set at least:

```env
DATABASE_URL=<Neon development connection string>
JWT_SECRET_KEY=<strong random value>
```

Generate a local JWT secret with:

```bash
openssl rand -hex 32
```

Do not commit `.env`. The example enables `AUTO_CREATE_TABLES=true`, but the
current schema bootstrap is incomplete. For an already prepared development
database, set it to `false`. Starting the app is not a supported way to create a
fresh database. Read the [database baseline proposal](database-baseline-proposal.md)
first. Deployed environments must also set this flag to `false`.

Install the frontend packages in another terminal:

```bash
cd frontend
npm ci
```

## Start the application

From the repository root, start both services with:

```bash
./dev
```

The command prefers frontend port 5173 and backend port 8000. If either port
is occupied, it selects the next available port and prints the actual URLs.
Press Ctrl+C once to stop both services. Partial startup failure also stops any
child that already started. Both launcher UV commands use `--locked`; update the
lock deliberately before starting if the dependency definition has changed.

You can choose different starting ports while keeping automatic fallback:

```bash
./dev --frontend-port 5200 --backend-port 8100
```

### Start the services separately

Use two terminals when you need to control each process independently. Start
the backend first:

```bash
cd backend
uv run --locked uvicorn app.main:app --reload
```

Start the frontend in another terminal:

```bash
cd frontend
npm run dev
```

Default addresses:

- Frontend: `http://127.0.0.1:5173`
- Backend health: `http://127.0.0.1:8000/api/healthz`
- Backend API documentation: `http://127.0.0.1:8000/docs`

Vite proxies `/api` from port 5173 to port 8000.

### Set alternative ports manually

The defaults are configured strictly, so Vite does not silently choose another
port. Explicit alternative ports are supported. For example:

```bash
# Terminal 1
cd backend
CORS_ORIGINS=http://127.0.0.1:5174 \
  uv run --locked uvicorn app.main:app --reload --port 8001

# Terminal 2
cd frontend
VITE_API_PROXY_TARGET=http://127.0.0.1:8001 \
  npm run dev -- --port 5174
```

Open `http://127.0.0.1:5174` for this alternative setup.

## Smoke checks

With both services running, use the URLs printed by `./dev`. The commands below
show the default ports; replace them when automatic selection chose different
ports:

```bash
curl -fsS http://127.0.0.1:8000/api/healthz
curl -fsS http://127.0.0.1:8000/api/v1/reference/occupations
curl -fsS http://127.0.0.1:5173/ >/dev/null
```

Expected health response:

```json
{"status":"ok"}
```

Also check these browser flows:

1. Open the home page and navigate directly to a nested route.
2. Register or sign in with a test account.
3. Confirm an occupation and load its reference tasks.
4. Save a workspace change, reload, and confirm it remains available.
5. Sign out and confirm account-only data is no longer shown.

## Automated checks

Run the Python suite from the repository root:

```bash
uv run --project backend --locked --all-groups \
  pytest -q backend/tests data/raw/test_masco_pdf.py
```

The suite disables provider calls and automatic database table creation, so it
does not depend on the developer's `.env` or network access.

Run the frontend checks:

```bash
cd frontend
npm run check
```

Report warnings separately. Do not describe a check as passing if its command
returned a non-zero exit code.

The launcher can be tested without starting either service or using a database:

```bash
uv run --project backend --locked python -m unittest discover -s scripts -p test_dev.py -v
```

The offline backend suite checks SQL construction and transaction contracts with
fakes. It does not prove PostgreSQL concurrency or replay migrations. See the
[database baseline proposal](database-baseline-proposal.md) for the separate,
reviewed database verification work. Do not use automatic table creation as proof
that Alembic can initialize or upgrade an existing database.

## Data-tool checks

The database and raw-data dependencies are separate opt-in groups:

```bash
uv run --project backend --group database python db/seed_reference.py --help
uv run --project backend --group data python data/raw/clean_row_tables.py --help
```

To rebuild reference CSVs without changing tracked files or a database, choose
a new temporary output directory:

```bash
aiw_output_dir=$(mktemp -d /tmp/aiw-reference-check.XXXXXX)
uv run --project backend --group data \
  python data/reference/import_from_raw.py \
  --raw-dir data/raw \
  --out-dir "$aiw_output_dir" \
  --replace
```

Database seeding is a separate action. Follow
[`iteration1_data_management.md`](iteration1_data_management.md) and verify the
target Neon branch before running it.

## Common problems

| Problem | Check |
|---|---|
| Port 5173 or 8000 is occupied | Reuse the existing server or use the explicit alternative-port commands above. |
| Frontend reports `ECONNREFUSED` | Start the backend and confirm `/api/healthz` responds. |
| Database requests fail | Check that `DATABASE_URL` is a valid Neon development URI. |
| CORS blocks an alternative frontend | Include its exact origin in `CORS_ORIGINS`. |
| UV says the lock changed | Run `uv lock --project backend --check`; commit intentional dependency updates together. |
| A test contacts Neon or an AI provider | Run the documented pytest command; `backend/tests/conftest.py` pins those paths off. |
