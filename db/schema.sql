-- Iteration 1 reference schema for Neon / Postgres.
-- Apply: python3 db/seed_reference.py --init
-- Reference tables are seeded from data/reference/*.csv.
-- Application business tables are owned by backend/app/models and are not
-- duplicated here. Existing legacy business tables are not dropped.

-- ---------------------------------------------------------------------------
-- Reference (lookup)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ref_occupations (
    occupation_code TEXT PRIMARY KEY,
    level TEXT NOT NULL,
    parent_code TEXT,
    title TEXT NOT NULL,
    description TEXT,
    skill_level TEXT,
    source TEXT,
    source_year TEXT
);

CREATE INDEX IF NOT EXISTS ref_occupations_parent_idx
    ON ref_occupations (parent_code);

CREATE INDEX IF NOT EXISTS ref_occupations_level_idx
    ON ref_occupations (level);

CREATE TABLE IF NOT EXISTS ref_ilo_tasks (
    isco_08 TEXT NOT NULL,
    task_id TEXT NOT NULL,
    title TEXT,
    task_text TEXT,
    score_2025 DOUBLE PRECISION,
    potential25 TEXT,
    potential23 TEXT,
    mean_score_2025 DOUBLE PRECISION,
    source TEXT,
    source_year TEXT,
    PRIMARY KEY (isco_08, task_id)
);

CREATE INDEX IF NOT EXISTS ref_ilo_tasks_isco_idx
    ON ref_ilo_tasks (isco_08);

CREATE TABLE IF NOT EXISTS ref_wef_skills (
    wef_skill_id INTEGER PRIMARY KEY,
    core_skill TEXT NOT NULL UNIQUE,
    wef_skill_group TEXT,
    core_skill_importance_2025_pct INTEGER,
    future_net_increase_2025_2030 INTEGER,
    future_trend_category TEXT,
    genai_substitution_capacity_category TEXT,
    genai_chart_label TEXT,
    source TEXT,
    source_year TEXT,
    source_figures TEXT
);
