Postgres / Neon schema and reference seed.

Use branch **dev** for import and SQL tests. After checks pass, run the
same seed against **production**.

1. Neon -> Connect -> branch **dev** -> copy URI into .env
2. Create tables and load lookup rows:

     python3 -m pip install -r db/requirements.txt
     python3 db/seed_reference.py --init

Later, after raw CSV changes (keep .env on the dev URI):

     python3 data/raw/clean_row_tables.py
     python3 data/reference/import_from_raw.py
     python3 db/seed_reference.py

Promote to production: switch .env to the production URI, then:

     python3 db/seed_reference.py --init

SQL Editor: branch **dev**, database **neondb**, paste:

     db/test_import.neon.sql

All rows should show ok = true.

Match then insert (same keys as import_from_raw.py). Does not write
users, work_profiles, or other business tables.

Rebuild lookup tables from CSV (does not truncate business tables):

     python3 db/seed_reference.py --replace
