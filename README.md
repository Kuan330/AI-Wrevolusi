# AI-Wrevolusi

AI-Wrevolusi monorepo for FIT5120, including:

- `frontend/`: React + TypeScript + Tailwind + shadcn/ui
- `backend/`: FastAPI + PostgreSQL/Neon + SQLAlchemy + Alembic

## Start Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Edit `backend/.env` and set a valid `DATABASE_URL`, then run:

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
