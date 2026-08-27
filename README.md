FIT5120 Iteration 1 — AI-Wrevolusi

Repo layout
  data/      sources, raw CSVs, reference CSVs (ETL; not the live app DB)
  db/        Postgres schema + seed into Neon
  backend/   API skeleton (reads Neon lookup tables)
  frontend/  UI placeholder
  docs/      ERD

Data refresh (keep .env on the Neon **dev** URI)
  python3 data/raw/clean_row_tables.py
  python3 data/reference/import_from_raw.py
  python3 db/seed_reference.py

Then paste db/test_import.neon.sql in Neon SQL Editor (branch dev).
Promote: switch .env to production and run db/seed_reference.py --init
