-- Iteration 1 schema for Neon / Postgres.
-- Apply: uv run --project backend --group database python db/seed_reference.py --init
-- Reference tables are seeded from data/reference/*.csv.
-- Business tables stay empty until the app writes them.

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

CREATE INDEX IF NOT EXISTS ref_occupations_level_code_idx
    ON ref_occupations (level, occupation_code);

-- Trigram indexes speed up ILIKE '%needle%' occupation search.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS ref_occupations_title_trgm_idx
    ON ref_occupations USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ref_occupations_description_trgm_idx
    ON ref_occupations USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS ref_occupations_code_trgm_idx
    ON ref_occupations USING gin (occupation_code gin_trgm_ops);

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

-- Epic 9 interview question bank (reference data only, no personal data).
-- Keyed by MASCO unit code, with no foreign key to ref_occupations (that table
-- can hold a different code list). Join on occupation_code when both exist.
-- Fast lookup: ref_interview_occupation_questions ordered by display_order.

CREATE TABLE IF NOT EXISTS ref_interview_sources (
    source_id TEXT PRIMARY KEY,
    publisher TEXT,
    title TEXT,
    evidence_period TEXT,
    source_type TEXT,
    url TEXT
);

CREATE TABLE IF NOT EXISTS ref_interview_questions (
    question_id TEXT PRIMARY KEY,
    scope TEXT NOT NULL CHECK (scope IN ('Exact', 'Family', 'Common')),
    occupation_code TEXT,
    family_code TEXT,
    applies_to TEXT,
    primary_intent TEXT NOT NULL,
    question TEXT NOT NULL UNIQUE,
    source_ids TEXT[] NOT NULL
);

CREATE TABLE IF NOT EXISTS ref_interview_occupation_questions (
    occupation_code TEXT NOT NULL,
    question_id TEXT NOT NULL REFERENCES ref_interview_questions (question_id),
    scope TEXT NOT NULL CHECK (scope IN ('Exact', 'Family', 'Common')),
    display_order INTEGER NOT NULL,
    PRIMARY KEY (occupation_code, question_id),
    UNIQUE (occupation_code, display_order)
);

CREATE TABLE IF NOT EXISTS ref_interview_coverage (
    occupation_code TEXT PRIMARY KEY,
    quality_tier TEXT NOT NULL,
    family_code TEXT,
    family_title TEXT,
    exact_count INTEGER NOT NULL,
    family_count INTEGER NOT NULL,
    targeted_count INTEGER NOT NULL,
    mapped_question_count INTEGER NOT NULL,
    coverage_status TEXT NOT NULL,
    review_note TEXT
);

-- ---------------------------------------------------------------------------
-- Business (app writes these; seed script does not)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT,
    created_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS work_profiles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users (id),
    occupation_code TEXT,
    confirmation_status TEXT,
    confirmed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS profile_tasks (
    id TEXT PRIMARY KEY,
    work_profile_id TEXT NOT NULL REFERENCES work_profiles (id),
    ilo_isco_08 TEXT,
    ilo_task_id TEXT,
    task_text TEXT,
    status TEXT,
    input_method TEXT,
    time_spent TEXT,
    responsibility_level TEXT,
    is_user_added BOOLEAN
);

CREATE TABLE IF NOT EXISTS task_assessments (
    id TEXT PRIMARY KEY,
    profile_task_id TEXT NOT NULL REFERENCES profile_tasks (id),
    suggested_state TEXT,
    match_layer TEXT,
    source TEXT,
    reasoning TEXT,
    uncertainty TEXT,
    limitations TEXT,
    missing_data_status TEXT,
    confirmation_status TEXT
);

CREATE TABLE IF NOT EXISTS profile_wef_skills (
    id TEXT PRIMARY KEY,
    work_profile_id TEXT NOT NULL REFERENCES work_profiles (id),
    wef_skill_id INTEGER,
    wef_core_skill TEXT,
    interpretation TEXT,
    match_layer TEXT,
    source TEXT,
    reasoning TEXT,
    uncertainty TEXT,
    limitations TEXT,
    missing_data_status TEXT,
    confirmation_status TEXT,
    is_user_added BOOLEAN
);

CREATE TABLE IF NOT EXISTS wef_skill_task_links (
    profile_wef_skill_id TEXT NOT NULL REFERENCES profile_wef_skills (id),
    profile_task_id TEXT NOT NULL REFERENCES profile_tasks (id),
    PRIMARY KEY (profile_wef_skill_id, profile_task_id)
);

CREATE TABLE IF NOT EXISTS skill_examples (
    id TEXT PRIMARY KEY,
    profile_wef_skill_id TEXT NOT NULL REFERENCES profile_wef_skills (id),
    example_text TEXT
);

CREATE TABLE IF NOT EXISTS review_events (
    id TEXT PRIMARY KEY,
    work_profile_id TEXT NOT NULL REFERENCES work_profiles (id),
    entity_type TEXT,
    entity_id TEXT,
    action TEXT,
    previous_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ
);
