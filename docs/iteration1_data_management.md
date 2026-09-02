# Iteration 1 data management process

How lookup data is sourced, cleaned, imported, seeded into Neon, and handed to the app.

Column meanings are **not** in this file. Use:

- `docs/iteration1_data_dictionary.md` (separate dictionary; write next)
- [iteration1_erd.md](iteration1_erd.md) for table relationships
- `db/schema.sql` for Postgres types

---

## 1. Purpose and scope

This process covers **Iteration 1 (E1–E4)** for AI-Wrevolusi: occupation browse, ILO starter tasks and exposure scores, WEF 26 core skills as labels after matching, and user confirmations.

In scope:

- MASCO occupation tree (pilot units only)
- ILO / Gmyrek et al. 2025 task scores (full file in raw; product subset in reference)
- WEF Future of Jobs 2025 core-skill master (26 rows)

Out of scope:

- ESCO
- E5–E8
- Full MASCO catalogue
- Writing user session rows from ETL (the app writes those)

Pilot **unit** codes: `5221`, `5222`, `5223` (parents `5` / `52` / `522`).

---

## 2. Layers

CSV files in Git are the reviewable source of truth for **lookup** data. Neon is the runtime copy the backend reads and writes.

```text
data/sources/     original files (do not edit)
      ↓  clean_row_tables.py
data/raw/         source-faithful row tables
      ↓  import_from_raw.py
data/reference/   product lookup CSVs
      ↓  seed_reference.py
Neon public.*     runtime tables  ← backend reads lookup, writes business
```

| Layer | Path | Who writes | App reads? |
|---|---|---|---|
| Sources | `data/sources/` | Replace official files only | No |
| Raw | `data/raw/` | `clean_row_tables.py` | No |
| Reference | `data/reference/` | `import_from_raw.py` | No (seed first) |
| Database lookup | Neon `public.ref_*` | `seed_reference.py` | Yes (read) |
| Database business | Neon `users`, `work_profiles`, … | Backend only | Yes (read/write) |
| Business CSV sketches | `data/business/*.csv` | Nobody (headers only) | No |

Do **not** load `ilo_task_score_raw` (full ~3k tasks) into the app database. The product only needs ILO rows for occupations that exist as `level = unit` in `ref_occupations`.

The Neon project may also contain older `app` and `catalog` schemas. **Iteration 1 uses `public` only.**

---

## 3. Sources

| Dataset | Official material | Stored copy |
|---|---|---|
| MASCO 2020 | DOSM English classification PDF | `data/sources/masco/masco_2020_en.pdf` |
| ILO exposure | Gmyrek et al. 2025, ISCO-08 task scores | `data/sources/ilo/Final_Scores_ISCO08_Gmyrek_et_al_2025.xlsx` |
| WEF skills | Future of Jobs Report 2025; Survey 2024; Global Skills Taxonomy. Figures 3.3, 3.4, B3.1 compiled by hand | `data/sources/wef/` |

Cleaning rules for each source live in the module docstring of `data/raw/clean_row_tables.py`. Do not edit files under `data/sources/` in place; replace the file, then re-run the pipeline.

---

## 4. Product path (what the data must support)

```text
User drills MASCO tree (major → sub-major → minor → unit)
  or searches occupation title
  → confirm 4-digit unit (e.g. 5222)
  → load ILO starter tasks (encoding join: unit code = isco_08)
  → user confirms / edits / adds tasks (add may use speech-to-text)
  → unchanged ILO-linked task: exposure from the ILO row (match_layer = exact)
     user-added/edited task: trained scikit-learn TF-IDF + Ridge score prediction,
       nearest-task evidence, then insufficient_data below the calibrated similarity threshold
  → each confirmed task → WEF 26 core skills (NLP then LLM; no 4-digit join)
  → E4 confirm / correct
```

Rules that the pipeline must preserve:

- E1 starter tasks come from **ILO**, not MASCO. MASCO `task_text` stays in raw for later alignment.
- Occupation-level ILO `mean_score_2025` / `potential25` may show as E1 background only.
- `work_profiles.occupation_code` stores the **unit** only. Intermediate drill-down is a UI query on `ref_occupations.parent_code`, not extra business columns.
- Speech-to-text is `profile_tasks.input_method = speech`, not a table.
- `wef_skill_task_links` is matcher output, not an official crosswalk.
- Unconfirmed tasks must not go to E2/E3.

---

## 5. Tables in this process (grain and keys)

Not a data dictionary. Names and keys only.

**Raw**

| File | Grain | Match / join |
|---|---|---|
| `masco_occupation_raw.csv` | One row = one MASCO unit-group “Tasks include” letter | `unit_code` |
| `ilo_task_score_raw.csv` | One row = one ISCO-08 4-digit occupation task | `(isco_08, task_id)`; full file, not pilot-filtered |
| `wef_skill_master_raw.csv` | One row = one WEF core skill (26) | `core_skill` |

**Reference → Neon lookup**

| Table | Grain | Upsert key |
|---|---|---|
| `ref_occupations` | One node in the MASCO tree (`major` / `sub_major` / `minor` / `unit`) | `occupation_code` |
| `ref_ilo_tasks` | ILO task for a **unit** currently in MASCO raw | `(isco_08, task_id)` |
| `ref_wef_skills` | One WEF core skill; `wef_skill_id` 1–26 follows Figure 3.3 rank | CSV match on `core_skill`; DB primary key `wef_skill_id` |

**Business (Neon only at runtime)**

Empty until a user runs the product: `users`, `work_profiles`, `profile_tasks`, `task_assessments`, `profile_wef_skills`, `wef_skill_task_links`, `skill_examples`, `review_events`.

---

## 6. Encoding join (and what does not join)

**Does join (4-digit):**

`masco_occupation_raw.unit_code` = `ilo_task_score_raw.isco_08` = `ref_occupations.occupation_code` where `level = unit` = `ref_ilo_tasks.isco_08`.

Task **texts** are not the same in MASCO and ILO. There is no checked task-to-task map. The current pilot matches user-edited text using `exact` → trained `nlp` → `insufficient_data` in the app, not this ETL. The trained score model uses grouped ISCO cross-validation and is documented in `docs/model_cards/epic2_task_exposure_tfidf_ridge_v1.md`. An LLM fallback is deliberately deferred until evaluation shows that the trained baseline is insufficient.

**Does not join by occupation code:** WEF skills. E3 attaches skills after NLP/LLM.

**User-added tasks:** `profile_tasks.ilo_task_id` empty; no ILO exposure row.

---

## 7. Refresh process

Always point `.env` `DATABASE_URL` at the Neon **dev** branch while iterating. Do not commit `.env`.

### 7.1 Change a source file

1. Replace the file under `data/sources/` (PDF, xlsx, or WEF compiled CSV).
2. Rebuild raw:

```bash
python3 data/raw/clean_row_tables.py
```

Optional paths: `--ilo-source`, `--wef-source`. MASCO pilot extraction is encoded in that script (units `5221`–`5223`).

3. Rebuild reference CSVs (default = match then insert):

```bash
python3 data/reference/import_from_raw.py
```

4. Upsert lookup tables into Neon **dev**:

```bash
python3 db/seed_reference.py
```

First time on an empty database: `python3 db/seed_reference.py --init` (applies `db/schema.sql` then seeds).

5. Verify on **dev** (SQL Editor: branch `dev`, database `neondb`, schema `public`):

Paste `db/test_import.neon.sql`. Every row must have `ok = true`.

6. Promote: put the **production** URI in `.env`, then:

```bash
python3 db/seed_reference.py --init
```

(`--init` is safe if tables already exist: `CREATE TABLE IF NOT EXISTS`. Lookup rows upsert. Business tables are not truncated.)

### 7.2 Add a MASCO unit to the pilot

1. Extend MASCO raw (same grain: one row per unit task letter), including parent major / sub-major / minor on each row.
2. Run steps 3–5 above. `import_from_raw.py` adds tree nodes; `ref_ilo_tasks` picks up ILO rows whose `isco_08` is in the new unit list (ILO raw is already complete).
3. Update expected counts in `db/test_import.neon.sql` if the check script still assumes 6 occupations / 20 ILO rows.

### 7.3 Match-then-insert (default)

Used by both `import_from_raw.py` and `seed_reference.py`:

| Situation | Action |
|---|---|
| Same key in incoming and existing | Update fields from incoming |
| Key only in incoming | Insert |
| Key only in existing | **Keep** (do not delete) |

WEF: incoming rows match on `core_skill`. Existing `wef_skill_id` is kept. New skills get `max(id)+1`.

Neither script writes business tables.

### 7.4 Full rebuild (`--replace`)

```bash
python3 data/reference/import_from_raw.py --replace
python3 db/seed_reference.py --replace
```

Rebuilds **lookup** tables from CSV. Use when a key was renamed and leftover rows would be wrong. Does **not** `TRUNCATE` users, profiles, or tasks.

---

## 8. Who reads and writes at runtime

| Data | Backend |
|---|---|
| `ref_occupations` | Read: drill-down (`parent_code` / `level`) and title search |
| `ref_ilo_tasks` | Read after the user confirms a **unit** |
| `ref_wef_skills` | Read for E3 labels |
| `work_profiles` and other business tables | Write when the user confirms occupation, tasks, assessments, skills, reviews |

ETL must never `DELETE FROM users` (or other business tables). Seed only upserts `ref_*`.

Skeleton API (does not replace this process): `GET /occupations`, `GET /occupations/{code}/tasks` in `backend/`.

---

## 9. Current expected counts (pilot)

After a clean seed, lookup tables should contain:

| Table | Rows |
|---|---|
| `ref_occupations` | 6 (`5`, `52`, `522`, `5221`, `5222`, `5223`) |
| `ref_ilo_tasks` | 20 (`5221`=7, `5222`=8, `5223`=5) |
| `ref_wef_skills` | 26 |
| Business tables | 0 rows until the app runs |

---

## 10. Limits

- MASCO in raw/reference is the shop-salesperson pilot, not the whole classification.
- ILO GPT justifications stay in raw (and the Excel), not in `ref_ilo_tasks`.
- Default upsert keeps orphan lookup rows if a key disappears or is renamed; use `--replace` or delete by hand.
- `data/business/*.csv` are header sketches; live rows are in Neon.
- The E2 trained NLP model and E3 NLP/LLM matchers are application logic, not this ETL.

---

## 11. Command cheat sheet

| Step | Command |
|---|---|
| Raw from sources | `python3 data/raw/clean_row_tables.py` |
| Raw → reference CSV | `python3 data/reference/import_from_raw.py` |
| Create tables + seed Neon | `python3 db/seed_reference.py --init` |
| Seed lookup only | `python3 db/seed_reference.py` |
| Rebuild lookup from CSV | `python3 db/seed_reference.py --replace` |
| Check Neon (SQL Editor, **dev**) | `db/test_import.neon.sql` |

Dependencies: `data/raw/requirements.txt` (pandas, openpyxl); `db/requirements.txt` (pandas, psycopg).
