Reference (lookup) tables for the product.

Refresh after raw CSV changes (match then insert):
  python3 data/reference/import_from_raw.py

Same key: update fields from raw. New key in raw: insert.
Key only in ref: keep (not deleted). Full rebuild:
  python3 data/reference/import_from_raw.py --replace

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
  python3 db/seed_reference.py --init    # first time (creates tables)
  python3 db/seed_reference.py           # later updates
See db/README.txt.
