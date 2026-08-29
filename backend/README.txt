Iteration 1 API. Connects to Neon; does not own CSV files.

Lookup (read): public.ref_occupations, ref_ilo_tasks, ref_wef_skills
User tables (write later): public.users, work_profiles, profile_tasks, ...

Put the Neon **dev** URI in the repo-root .env. Schema: db/schema.sql

From the repo root:

  python3 -m pip install -r backend/requirements.txt
  python3 -m uvicorn app.main:app --reload --app-dir backend

Routers
  app/routers/health.py
  app/routers/occupations.py
  app/routers/wef.py

  GET /health
  GET /occupations
  GET /occupations?parent=522
  GET /occupations/5222
  GET /occupations/5222/exposure
  GET /occupations/5222/tasks
  GET /wef-skills

Dev UI: http://127.0.0.1:5173/  (Vite proxies /health, /occupations, /wef-skills to this process on port 8000)

UI is the React app on port 5173 in development. After `npm run build` in frontend/, this API also serves frontend/dist.

Do not copy data/raw or data/reference into this folder.
