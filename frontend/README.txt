Iteration 1 UI — Vite + React.

Talks to the FastAPI backend (Neon lookup tables). Does not connect to the database itself.

From this folder:

  npm install
  npm run dev

Open http://127.0.0.1:5173/  (proxies /health, /occupations, /wef-skills to http://127.0.0.1:8000)

API must already be running from the repo root:

  python3 -m uvicorn app.main:app --reload --app-dir backend --host 127.0.0.1 --port 8000

Layout
  src/api/           HTTP client + occupation / WEF reads
  src/components/    shared Button, Modal, TaskRow, Toast, header
  src/features/e1/   occupation cascade + task list
  src/features/e2/   exposure boards
  src/features/e3/   WEF skill list
  src/pages/         one route per screen (/match → /tasks → /exposure → /skills)
  src/domain/        numbering, mix, sorting (no UI)
  src/context/       in-memory session (writes to Neon come later)

Production: npm run build  then FastAPI serves frontend/dist if that folder exists.

Do not copy data/raw into this folder.
