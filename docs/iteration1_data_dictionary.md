# Iteration 1 Data Dictionary

Field-level definitions for AI-Wrevolusi lookup data, reference tables, and active application tables.

| Document field | Value |
|---|---|
| Scope | Iteration 1 (E1–E4 pilot) |
| Repository baseline | `main @ 0c8f03b` (application models: `backend/app/models/`) |
| Authoritative DDL (lookup) | `db/schema.sql` |
| Process | [iteration1_data_management.md](iteration1_data_management.md) |
| Relationships | [iteration1_erd.md](iteration1_erd.md) |
| Pilot unit codes | `5221`, `5222`, `5223` (parents `5`, `52`, `522`) |

This dictionary does not duplicate the full ETL procedure or governance policy. Those belong in the Data Management Plan and related PGP artefacts.

---

## 1. Data classification legend

| Class | Meaning | Examples |
|---|---|---|
| **Public / reference** | Official or compiled lookup data; no personal identifiers | MASCO titles, ILO scores, WEF skill labels |
| **Personal** | Identifies or describes an individual user or their work context | `email`, `full_name`, task text, preparation plans |
| **Authentication-sensitive** | Credentials or tokens that must never be logged or committed | `hashed_password`, `token_jti`, `JWT_SECRET_KEY`, `DATABASE_URL` |
| **Operational** | System metadata with low sensitivity | `created_at`, `source`, `source_year` |

Retention (team policy): accounts and user-generated data are retained for **6 months from last active use**; users may request deletion, which cascades from `app_users` to related rows.

---

## 2. Data layers

| Layer | Location | Loaded into Neon? | Read by app at runtime? |
|---|---|---|---|
| Sources | `data/sources/` | No | No |
| Raw | `data/raw/*.csv` | No | No |
| Reference CSV | `data/reference/*.csv` | Yes (`ref_*`) | Yes (via `/api/v1/reference`) |
| Application | `backend/app/models/` | Yes (when migrated / created) | Yes (authenticated API) |

**Logical join (4-digit occupation code):**

`masco_occupation_raw.unit_code` = `ilo_task_score_raw.isco_08` = `ref_occupations.occupation_code` (where `level = unit`) = `ref_ilo_tasks.isco_08`.

WEF skills **do not** join to occupations by four-digit code. They are a reference vocabulary used after task confirmation.

**Runtime note (main branch):** occupation browse, confirmed tasks, and dashboard analysis may also be stored in browser `localStorage` during Iteration 1 UI flows. The tables below are the **target persistent model** written by the FastAPI backend when authenticated flows are used.

---

## 3. Raw tables (CSV, not in Neon)

Grain and fields for reviewable source-aligned files under `data/raw/`. Built by `data/raw/clean_row_tables.py`.

### 3.1 `masco_occupation_raw.csv`

| Field | Type | Key | Class | Description |
|---|---|---|---|---|
| `major_code` | string | | Public | MASCO major group code (1 digit), e.g. `5` |
| `major_title` | string | | Public | Major group title |
| `sub_major_code` | string | | Public | Sub-major code (2 digits), e.g. `52` |
| `sub_major_title` | string | | Public | Sub-major title |
| `minor_code` | string | | Public | Minor group code (3 digits), e.g. `522` |
| `minor_title` | string | | Public | Minor group title |
| `unit_code` | string | PK (with `task_letter`) | Public | Unit group code (4 digits), e.g. `5222` |
| `unit_title` | string | | Public | Unit group title |
| `unit_description` | string | | Public | Unit group description |
| `skill_level` | string | | Public | MASCO skill level where stated |
| `task_letter` | string | PK (with `unit_code`) | Public | Letter of the “Tasks include” item at unit level |
| `task_text` | string | | Public | MASCO task wording (context only; E1 starters come from ILO) |
| `source` | string | | Public | Provenance label, e.g. `MASCO 2020` |
| `source_year` | string | | Public | Source year, e.g. `2020` |

**Expected rows (pilot):** 28 data rows.

### 3.2 `ilo_task_score_raw.csv`

| Field | Type | Key | Class | Description |
|---|---|---|---|---|
| `label4d` | string | | Public | ILO 4-digit occupation label from workbook |
| `label1d` | string | | Public | ILO 1-digit major label |
| `isco_08` | string | PK (with `task_id`) | Public | ISCO-08 four-digit occupation code |
| `title` | string | | Public | Occupation title |
| `task_id` | integer | PK (with `isco_08`) | Public | Task identifier within occupation |
| `task_text` | string | | Public | Task description text |
| `score_2023` | float | | Public | 2023 exposure score |
| `weaviate_status` | string | | Internal | Weaviate indexing status from source workbook |
| `predicted_score_2025_gpt4o` | float | | Public | Model-predicted 2025 score (GPT-4o) |
| `prediction_justification_gpt4o` | string | | Public | Model justification text (not loaded into `ref_ilo_tasks`) |
| `weaviate_status_gemini` | string | | Internal | Gemini indexing status |
| `predicted_score_2025_gemini` | float | | Public | Model-predicted 2025 score (Gemini) |
| `prediction_justification_gemini` | string | | Public | Model justification text (not in reference layer) |
| `score_2025` | float | | Public | Reconciled / final 2025 task score |
| `source` | string | | Public | Row provenance, e.g. `predicted`, `reconciled` |
| `mean_score_2023` | float | | Public | Occupation-level mean score (2023) |
| `mean_score_2025` | float | | Public | Occupation-level mean score (2025) |
| `sd_2023` | float | | Public | Standard deviation (2023) |
| `sd_2025` | float | | Public | Standard deviation (2025) |
| `potential25` | string | | Public | 2025 exposure gradient label |
| `potential23` | string | | Public | 2023 exposure category label |
| `source_year` | integer | | Public | `2025` |
| `source_dataset` | string | | Public | Dataset identifier string |

**Expected rows:** 4,576 data rows (full ISCO-08 file; not pilot-filtered).

### 3.3 `wef_skill_master_raw.csv`

| Field | Type | Key | Class | Description |
|---|---|---|---|---|
| `core_skill` | string | PK | Public | WEF core skill name (26 values) |
| `wef_skill_group` | string | | Public | Skill group from WEF taxonomy / Figure 3.3 |
| `core_skill_importance_2025_pct` | integer | | Public | Share of employers rating skill as core (Figure 3.3) |
| `future_net_increase_2025_2030` | integer | | Public | Net increase % (increasing minus decreasing employers) |
| `future_trend_category` | string | | Public | Derived trend band, e.g. `High Growth` |
| `genai_substitution_capacity_category` | string | | Public | GenAI substitution category (Figure B3.1) |
| `genai_chart_label` | string | | Public | Chart label variant for Figure B3.1 |
| `source` | string | | Public | e.g. `WEF Future of Jobs Report 2025` |
| `source_year` | string | | Public | `2025` |
| `source_figures` | string | | Public | Figures used, e.g. `Figure 3.3; Figure 3.4; Figure B3.1` |

**Expected rows:** 26 data rows.

---

## 4. Reference lookup tables (Neon `public.ref_*`)

Seeded from `data/reference/*.csv` via `db/seed_reference.py`. Read by `GET /api/v1/reference/*`.

### 4.1 `ref_occupations`

| Field | Postgres type | Key | Null | Class | Description |
|---|---|---|---|---|---|
| `occupation_code` | `TEXT` | PK | No | Public | MASCO / ISCO node code (`5`, `52`, `522`, `5221`, …) |
| `level` | `TEXT` | | No | Public | `major` \| `sub_major` \| `minor` \| `unit` |
| `parent_code` | `TEXT` | | Yes | Public | Parent node code; null for root major |
| `title` | `TEXT` | | No | Public | Display title |
| `description` | `TEXT` | | Yes | Public | Longer description (mainly at unit level) |
| `skill_level` | `TEXT` | | Yes | Public | MASCO skill level where applicable |
| `source` | `TEXT` | | Yes | Public | `MASCO 2020` |
| `source_year` | `TEXT` | | Yes | Public | `2020` |

**Expected rows (pilot):** 6 (`5`, `52`, `522`, `5221`, `5222`, `5223`).

### 4.2 `ref_ilo_tasks`

| Field | Postgres type | Key | Null | Class | Description |
|---|---|---|---|---|---|
| `isco_08` | `TEXT` | PK (composite) | No | Public | Four-digit unit code; matches pilot `ref_occupations` units |
| `task_id` | `TEXT` | PK (composite) | No | Public | Task id within occupation |
| `title` | `TEXT` | | Yes | Public | Occupation title (repeated per task row) |
| `task_text` | `TEXT` | | Yes | Public | ILO task wording (E1 starter task text) |
| `score_2025` | `DOUBLE PRECISION` | | Yes | Public | Task-level 2025 exposure score |
| `potential25` | `TEXT` | | Yes | Public | 2025 exposure gradient label |
| `potential23` | `TEXT` | | Yes | Public | 2023 exposure category |
| `mean_score_2025` | `DOUBLE PRECISION` | | Yes | Public | Occupation-level mean (may repeat per task) |
| `source` | `TEXT` | | Yes | Public | Row provenance |
| `source_year` | `TEXT` | | Yes | Public | `2025` |

**Expected rows (pilot):** 20 (`5221`=7, `5222`=8, `5223`=5).

GPT/Gemini justification columns from raw are **not** stored here.

### 4.3 `ref_wef_skills`

| Field | Postgres type | Key | Null | Class | Description |
|---|---|---|---|---|---|
| `wef_skill_id` | `INTEGER` | PK | No | Public | Stable id `1`–`26` (Figure 3.3 rank order) |
| `core_skill` | `TEXT` | UNIQUE | No | Public | WEF core skill label |
| `wef_skill_group` | `TEXT` | | Yes | Public | WEF skill group |
| `core_skill_importance_2025_pct` | `INTEGER` | | Yes | Public | Core-skill importance % |
| `future_net_increase_2025_2030` | `INTEGER` | | Yes | Public | Net future increase % |
| `future_trend_category` | `TEXT` | | Yes | Public | Trend band |
| `genai_substitution_capacity_category` | `TEXT` | | Yes | Public | GenAI substitution category |
| `genai_chart_label` | `TEXT` | | Yes | Public | Chart label for B3.1 |
| `source` | `TEXT` | | Yes | Public | Report citation |
| `source_year` | `TEXT` | | Yes | Public | `2025` |
| `source_figures` | `TEXT` | | Yes | Public | Figures compiled |

**Expected rows:** 26.

---

## 5. Active application tables (SQLAlchemy)

Authoritative definitions: `backend/app/models/`. Managed through Alembic migrations in the target deployment model. Not written by `seed_reference.py`.

All tables below except `task_capability_link` include `created_at` and `updated_at` (`TIMESTAMPTZ`, server default `now()`).

### 5.1 `app_users`

| Field | Type | Key | Null | Class | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | PK | No | Operational | Account id |
| `email` | `VARCHAR(255)` | UNIQUE | No | Personal | Login email |
| `full_name` | `VARCHAR(120)` | | No | Personal | Display name |
| `hashed_password` | `VARCHAR(255)` | | No | Authentication-sensitive | Bcrypt (or equivalent) password hash |
| `is_active` | `BOOLEAN` | | No | Operational | Account enabled flag |
| `occupation_id` | `UUID` | FK → `occupations.id` | Yes | Personal | Selected application occupation |
| `created_at` | `TIMESTAMPTZ` | | No | Operational | Row created |
| `updated_at` | `TIMESTAMPTZ` | | No | Operational | Row last updated |

**Cascade:** deleting `app_users` cascades to `refresh_tokens`, `tasks`, `capabilities`, `preparations`, `schedules`.

### 5.2 `refresh_tokens`

| Field | Type | Key | Null | Class | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | PK | No | Operational | Token record id |
| `user_id` | `UUID` | FK → `app_users.id` | No | Authentication-sensitive | Owning user |
| `token_jti` | `VARCHAR(64)` | UNIQUE | No | Authentication-sensitive | JWT id for refresh rotation |
| `expires_at` | `TIMESTAMPTZ` | | No | Authentication-sensitive | Expiry time |
| `revoked_at` | `TIMESTAMPTZ` | | Yes | Authentication-sensitive | Revocation time if invalidated |
| `created_at` | `TIMESTAMPTZ` | | No | Operational | |
| `updated_at` | `TIMESTAMPTZ` | | No | Operational | |

### 5.3 `occupations`

Application-side occupation records. **Not** the same table as `ref_occupations`.

| Field | Type | Key | Null | Class | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | PK | No | Operational | Internal occupation id |
| `masco_code` | `VARCHAR(20)` | UNIQUE | No | Public | Logical link to `ref_occupations.occupation_code` |
| `title` | `VARCHAR(120)` | | No | Public | Display title |
| `industry` | `VARCHAR(120)` | | No | Public | Industry label for filtering |
| `description` | `TEXT` | | Yes | Public | Optional description |
| `created_at` | `TIMESTAMPTZ` | | No | Operational | |
| `updated_at` | `TIMESTAMPTZ` | | No | Operational | |

### 5.4 `tasks`

| Field | Type | Key | Null | Class | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | PK | No | Operational | Task id |
| `user_id` | `UUID` | FK → `app_users.id` | No | Personal | Owner |
| `occupation_id` | `UUID` | FK → `occupations.id` | Yes | Personal | Related occupation |
| `title` | `VARCHAR(200)` | | No | Personal | Task title / wording |
| `description` | `TEXT` | | Yes | Personal | Extended task context |
| `status` | `task_status` enum | | No | Personal | See §6.1 |
| `exposure_type` | `exposure_type` enum | | No | Personal | See §6.2 |
| `context` | `JSONB` | | Yes | Personal | Optional structured metadata |
| `created_at` | `TIMESTAMPTZ` | | No | Operational | |
| `updated_at` | `TIMESTAMPTZ` | | No | Operational | |

### 5.5 `capabilities`

| Field | Type | Key | Null | Class | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | PK | No | Operational | Capability id |
| `user_id` | `UUID` | FK → `app_users.id` | No | Personal | Owner |
| `name` | `VARCHAR(120)` | | No | Personal | Capability / skill name |
| `description` | `TEXT` | | Yes | Personal | Narrative description |
| `evolution` | `capability_evolution` enum | | No | Personal | See §6.3 |
| `evidence` | `JSONB` | | Yes | Personal | List of evidence objects |
| `created_at` | `TIMESTAMPTZ` | | No | Operational | |
| `updated_at` | `TIMESTAMPTZ` | | No | Operational | |

### 5.6 `task_capability_link`

Association table (many-to-many).

| Field | Type | Key | Null | Class | Description |
|---|---|---|---|---|---|
| `task_id` | `UUID` | PK (composite), FK → `tasks.id` | No | Personal | Linked task |
| `capability_id` | `UUID` | PK (composite), FK → `capabilities.id` | No | Personal | Linked capability |

### 5.7 `preparations`

| Field | Type | Key | Null | Class | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | PK | No | Operational | Preparation action id |
| `user_id` | `UUID` | FK → `app_users.id` | No | Personal | Owner |
| `title` | `VARCHAR(150)` | | No | Personal | Action title |
| `rationale` | `TEXT` | | No | Personal | Why this action matters |
| `effort_level` | `INTEGER` | | No | Personal | Effort scale (default 3) |
| `priority` | `priority_level` enum | | No | Personal | See §6.4 |
| `created_at` | `TIMESTAMPTZ` | | No | Operational | |
| `updated_at` | `TIMESTAMPTZ` | | No | Operational | |

### 5.8 `schedules`

| Field | Type | Key | Null | Class | Description |
|---|---|---|---|---|---|
| `id` | `UUID` | PK | No | Operational | Schedule entry id |
| `user_id` | `UUID` | FK → `app_users.id` | No | Personal | Owner |
| `preparation_id` | `UUID` | FK → `preparations.id` | No | Personal | Linked preparation |
| `planned_for` | `DATE` | | No | Personal | Planned date |
| `is_done` | `BOOLEAN` | | No | Personal | Completion flag |
| `note` | `TEXT` | | Yes | Personal | Optional note |
| `created_at` | `TIMESTAMPTZ` | | No | Operational | |
| `updated_at` | `TIMESTAMPTZ` | | No | Operational | |

---

## 6. Enumerations

### 6.1 `TaskStatus` (`tasks.status`)

| Value | Meaning |
|---|---|
| `confirmed` | User confirmed the task |
| `needs_review` | Awaiting user review |
| `optional_context_missing` | Optional context not yet provided |

### 6.2 `ExposureType` (`tasks.exposure_type`)

| Value | Meaning |
|---|---|
| `human_led` | Predominantly human judgement |
| `ai_assisted` | AI can assist; human review expected |
| `partly_automated` | Substantial automation potential |
| `automated` | High automation exposure |
| `insufficient_data` | Not enough context to infer |

On `main @ 0c8f03b`, exposure inference for API routes may use rule-based placeholders until NLP integration is merged.

### 6.3 `CapabilityEvolution` (`capabilities.evolution`)

| Value | Meaning |
|---|---|
| `continue_to_be_useful` | Skill remains valuable |
| `needs_strengthening` | User should strengthen this capability |
| `needs_updating` | Skill needs updating for AI-era work |

### 6.4 `PriorityLevel` (`preparations.priority`)

| Value | Meaning |
|---|---|
| `high` | High priority |
| `medium` | Medium priority (default) |
| `low` | Low priority |

---

## 7. Logical references (no database FK)

| From | To | Join rule |
|---|---|---|
| `ref_ilo_tasks.isco_08` | `ref_occupations.occupation_code` | Same 4-digit unit code |
| `occupations.masco_code` | `ref_occupations.occupation_code` | Application copy of selected unit |
| `capabilities.name` | `ref_wef_skills.core_skill` | Matcher output; not an official crosswalk |
| `ref_wef_skills` | MASCO / ILO | **No** occupation-code join |

---

## 8. API exposure (lookup fields)

Reference endpoints return subsets of the columns above:

| Endpoint | Primary tables | Notes |
|---|---|---|
| `GET /api/v1/reference/occupations` | `ref_occupations` | Filter by `parent`, search `q`, or list majors |
| `GET /api/v1/reference/occupations/{code}` | `ref_occupations` | Single node |
| `GET /api/v1/reference/occupations/{code}/tasks` | `ref_ilo_tasks` | Starter tasks for a unit |
| `GET /api/v1/reference/wef-skills` | `ref_wef_skills` | All 26 skills |

---

## 9. Deprecated legacy tables (not target model)

The following tables were declared in early `db/schema.sql` iterations for a document-oriented business model. They are **not** used by `backend/app/models/` on the target architecture and are scheduled for removal from schema tooling after Neon dependency checks:

`users`, `work_profiles`, `profile_tasks`, `task_assessments`, `profile_wef_skills`, `wef_skill_task_links`, `skill_examples`, `review_events`.

Do not use these tables in new features. See [iteration1_erd.md](iteration1_erd.md) for the replacement model.

---

## 10. Expected lookup row counts (pilot)

| Table / file | Rows |
|---|---|
| `masco_occupation_raw.csv` | 28 |
| `ilo_task_score_raw.csv` | 4,576 |
| `wef_skill_master_raw.csv` | 26 |
| `ref_occupations` | 6 |
| `ref_ilo_tasks` | 20 |
| `ref_wef_skills` | 26 |
| Application tables | 0 until users register / create data |

Validate on Neon with `db/test_import.neon.sql` (lookup checks) and `db/test_import.py` (CSV field parity).

---

## 11. Source attribution (summary)

| Dataset | Attribution |
|---|---|
| MASCO 2020 | Ministry of Human Resources Malaysia, *Malaysia Standard Classification of Occupations (MASCO) 2020* |
| ILO scores | Gmyrek, P., et al. (2025), *Generative AI and Jobs: A Refined Global Index of Occupational Exposure*, ILO Working Paper 140. https://doi.org/10.54394/HETP0387 |
| WEF skills | World Economic Forum, *Future of Jobs Report 2025*, Figures 3.3, 3.4 and B3.1 (labels compiled; not WEF-endorsed) |

Full licence terms belong in the Iteration 1 Data Management Plan.
