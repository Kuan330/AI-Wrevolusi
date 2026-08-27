Iteration 1 API skeleton. Connects to Neon; does not own CSV files.

Lookup (read): public.ref_occupations, ref_ilo_tasks, ref_wef_skills
User tables (write later): public.users, work_profiles, profile_tasks, ...

Put the Neon **dev** URI in the repo-root .env. Schema: db/schema.sql

From the repo root:

  python3 -m pip install -r backend/requirements.txt
  python3 -m uvicorn app.main:app --reload --app-dir backend

  GET /health
  GET /occupations
  GET /occupations?parent=522
  GET /occupations/5222
  GET /occupations/5222/tasks

Do not copy data/raw or data/reference into this folder.
