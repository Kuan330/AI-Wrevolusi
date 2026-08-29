# AI-Wrevolusi

AI-Wrevolusi monorepo for FIT5120, including:

- `frontend/`: React + TypeScript + Tailwind + shadcn/ui
- `backend/`: FastAPI + PostgreSQL/Neon + SQLAlchemy + Alembic
- `data/`: raw and normalized reference datasets
- `db/`: reference-table schema, seed, and verification scripts
- `docs/`: ERD and data-management documentation

## Start Backend

Python 3.11 or newer is required.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Copy `backend/.env.example` to `backend/.env`, set a valid Neon development
`DATABASE_URL`, and replace `JWT_SECRET_KEY`. Never commit either secret. Then run:

```bash
uvicorn app.main:app --reload
```

Backend will run at:

- API base: `http://127.0.0.1:8000/api/v1`
- Swagger docs: `http://127.0.0.1:8000/docs`

## Start Frontend

Open a new terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend will run at:

- App: `http://127.0.0.1:5173`

If backend URL changes, set in `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```

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

```bash
python3 db/seed_reference.py --init
```

See `docs/iteration1_data_management.md` before promoting reference data.
