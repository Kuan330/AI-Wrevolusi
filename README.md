FIT5120 Iteration 1 — AI-Wrevolusi

Repo layout
  data/      sources, raw CSVs, reference CSVs (ETL; not the live app DB)
  db/        Postgres schema + seed into Neon
  backend/   FastAPI (reads Neon lookup tables)
  frontend/  Vite + React (E1–E4 screens)
  docs/      ERD, data management process

Run locally (needs .env Neon **dev** URI)
  python3 -m pip install -r backend/requirements.txt
  python3 -m uvicorn app.main:app --reload --app-dir backend --host 127.0.0.1 --port 8000

  cd frontend && npm install && npm run dev
Open http://127.0.0.1:5173/
Vite proxies /health, /occupations, /wef-skills to the API on port 8000.

Data refresh (keep .env on the Neon **dev** URI)
  python3 data/raw/clean_row_tables.py
  python3 data/reference/import_from_raw.py
  python3 db/seed_reference.py

Then paste db/test_import.neon.sql in Neon SQL Editor (branch dev).
Promote: switch .env to production and run db/seed_reference.py --init

Process (layers, upsert, who writes): docs/iteration1_data_management.md
