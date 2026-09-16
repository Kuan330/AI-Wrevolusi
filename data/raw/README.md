# MASCO 2020 pipeline

1. Extract the PDF and refresh all raw tables:

   `uv run --project backend --group data python data/raw/clean_row_tables.py --out-dir data/raw`

   The MASCO extractor reads `data/sources/masco/masco_2020_en.pdf` by default and writes one row per PDF task to `masco_occupation_raw.csv`.

2. Build reference CSVs from raw data:

   `uv run --project backend --group data python data/reference/import_from_raw.py --raw-dir data/raw --out-dir data/reference --replace`

   This creates the four-level MASCO occupation tree in `ref_occupations.csv`. Tasks stay in the raw MASCO table; the reference occupation table contains hierarchy nodes only.

3. Validate before database work. The database seed script is intentionally separate:

   `uv run --project backend --group database python db/seed_reference.py --init` (first setup)

   `uv run --project backend --group database python db/seed_reference.py` (upsert later)

   Set `DATABASE_URL` to a verified Neon development branch first. Do not use `--replace` against production without a separate backup and approval.

The PDF parser requires the `data` dependency group. UV installs it
automatically when the command includes `--group data`. The script refuses to
replace the raw CSV if fewer than 400 unit groups or any unit title is missing.
