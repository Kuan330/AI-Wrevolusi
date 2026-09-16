Postgres / Neon schema and reference seed.

Use branch **dev** for import and SQL tests. After checks pass, run the
same seed against **production**.

1. Neon -> Connect -> branch **dev** -> copy URI into .env
2. Create tables and load lookup rows:

     uv sync --project backend --group database
     uv run --project backend --group database python db/seed_reference.py --init

Later, after raw CSV changes (keep .env on the dev URI):

     uv run --project backend --group data python data/raw/clean_row_tables.py
     uv run --project backend --group data python data/reference/import_from_raw.py
     uv run --project backend --group database python db/seed_reference.py

Promote to production: switch .env to the production URI, then:

     uv run --project backend --group database python db/seed_reference.py --init

SQL Editor: branch **dev**, database **neondb**, paste:

     db/test_import.neon.sql

All rows should show ok = true.

Match then insert (same keys as import_from_raw.py). Does not write
users, work_profiles, or other business tables.

Rebuild lookup tables from CSV (does not truncate business tables):

     uv run --project backend --group database python db/seed_reference.py --replace
