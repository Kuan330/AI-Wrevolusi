Reference (lookup) tables for the product.

Refresh after raw CSV changes (match then insert):
  uv run --project backend --group data python data/reference/import_from_raw.py

Same key: update fields from raw. New key in raw: insert.
Key only in ref: keep (not deleted). Full rebuild:
  uv run --project backend --group data python data/reference/import_from_raw.py --replace

Match keys: occupations occupation_code; ILO (isco_08, task_id);
WEF core_skill (existing wef_skill_id kept; new skills get max+1).

Still three tables (no extra file). ref_occupations now includes the MASCO tree:

  occupation_code, level, parent_code, title, ...
  5      major
  52     sub_major  parent 5
  522    minor      parent 52
  5221   unit       parent 522
  5222   unit       parent 522
  5223   unit       parent 522

E1: browse by parent_code, or search title.
ILO tasks attach only to level=unit rows.

  ref_ilo_tasks.csv     ILO starter tasks + exposure for unit codes
  ref_wef_skills.csv    WEF 26 core skills (wef_skill_id 1-26 = Figure 3.3 rank)

Does not update data/business/ user tables.

After reference CSV refresh, load lookup tables into Neon / Postgres:
  uv run --project backend --group database python db/seed_reference.py --init    # first time (creates tables)
  uv run --project backend --group database python db/seed_reference.py           # later updates
See db/README.txt.

Live occupation descriptions (fixed 2026-10-01):
  The live ref_occupations table uses ISCO-08 codes, and an earlier import left a
  placeholder sentence in its descriptions. They were replaced as follows:
  - 320 unit codes whose titles match MASCO 2020: description from ref_occupations.csv
    (db/fix_20261001_masco_descriptions.sql).
  - 104 unit codes with no matching MASCO title: official ILO ISCO-08 definitions,
    kept in ref_occupations_isco08_descriptions.csv
    (db/fix_20261001_isco08_descriptions.sql).
  Source: ILO, "ISCO-08 EN Structure and definitions.xlsx" (ilostat-files).
  Do not run seed_reference.py --replace against the live table without reviewing
  this: the same code can mean a different job in MASCO and ISCO-08 (e.g. 3151).
