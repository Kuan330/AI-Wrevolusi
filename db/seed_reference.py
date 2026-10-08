#!/usr/bin/env python3
"""Load data/reference CSV files into Postgres (Neon).

Import mode: match then insert (upsert).
  - Same key in CSV and DB: update fields from CSV
  - Key only in CSV: insert
  - Key only in DB: keep (do not delete)
Full rebuild of lookup tables:
uv run --project backend --group database python db/seed_reference.py --replace

Create tables first:
uv run --project backend --group database python db/seed_reference.py --init

Does not write users, work_profiles, or other business tables.
"""

from __future__ import annotations

import argparse
import os
from pathlib import Path

import pandas as pd
import psycopg

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
REF = ROOT / "data" / "reference"
INTERVIEW = REF / "interview"
SCHEMA_SQL = HERE / "schema.sql"
ENV_FILE = ROOT / ".env"

OCCUPATION_COLS = [
    "occupation_code",
    "level",
    "parent_code",
    "title",
    "description",
    "skill_level",
    "source",
    "source_year",
]

ILO_COLS = [
    "isco_08",
    "task_id",
    "title",
    "task_text",
    "score_2025",
    "potential25",
    "potential23",
    "mean_score_2025",
    "source",
    "source_year",
]

WEF_COLS = [
    "wef_skill_id",
    "core_skill",
    "wef_skill_group",
    "core_skill_importance_2025_pct",
    "future_net_increase_2025_2030",
    "future_trend_category",
    "genai_substitution_capacity_category",
    "genai_chart_label",
    "source",
    "source_year",
    "source_figures",
]


INTERVIEW_SOURCE_COLS = ["source_id", "publisher", "title", "evidence_period", "source_type", "url"]
INTERVIEW_QUESTION_COLS = [
    "question_id",
    "scope",
    "occupation_code",
    "family_code",
    "applies_to",
    "primary_intent",
    "question",
    "source_ids",
]
INTERVIEW_MAPPING_COLS = ["occupation_code", "question_id", "scope", "display_order"]
INTERVIEW_COVERAGE_COLS = [
    "occupation_code",
    "quality_tier",
    "family_code",
    "family_title",
    "exact_count",
    "family_count",
    "targeted_count",
    "mapped_question_count",
    "coverage_status",
    "review_note",
]
# Child tables first, so DELETE respects the foreign keys.
INTERVIEW_TABLES = [
    "ref_interview_occupation_questions",
    "ref_interview_coverage",
    "ref_interview_questions",
    "ref_interview_sources",
]


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'").strip('"'))


def database_url() -> str:
    load_dotenv(ENV_FILE)
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise SystemExit(
            "DATABASE_URL is missing. Copy .env.example to .env and paste the Neon URI."
        )
    if "@HOST/" in url or "://USER:" in url or "PASSWORD@" in url:
        raise SystemExit(
            "DATABASE_URL still uses the example placeholder (USER / PASSWORD / HOST).\n"
            "In Neon: project → Connection details → copy the URI → paste into .env."
        )
    if "sslmode=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode=require"
    return url


def sql_statements(script: str) -> list[str]:
    parts: list[str] = []
    buf: list[str] = []
    for line in script.splitlines():
        stripped = line.strip()
        if stripped.startswith("--"):
            continue
        buf.append(line)
        if stripped.endswith(";"):
            stmt = "\n".join(buf).strip()
            if stmt:
                parts.append(stmt)
            buf = []
    rest = "\n".join(buf).strip()
    if rest:
        parts.append(rest)
    return parts


def apply_schema(conn: psycopg.Connection) -> None:
    script = SCHEMA_SQL.read_text(encoding="utf-8")
    for stmt in sql_statements(script):
        conn.execute(stmt)
    print(f"applied schema -> {SCHEMA_SQL}")


def blank_to_none(value):
    if isinstance(value, list):
        return value
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, str) and value.strip() == "":
        return None
    if pd.isna(value):
        return None
    return value


def rows_as_tuples(df: pd.DataFrame, columns: list[str]) -> list[tuple]:
    out: list[tuple] = []
    for rec in df[columns].to_dict(orient="records"):
        out.append(tuple(blank_to_none(rec[c]) for c in columns))
    return out


def existing_key_set(conn: psycopg.Connection, table: str, keys: list[str]) -> set:
    cols = ", ".join(keys)
    result = conn.execute(f"SELECT {cols} FROM {table}")
    rows = result.fetchall()
    if len(keys) == 1:
        return {str(r[0]) for r in rows}
    return {tuple(str(v) for v in r) for r in rows}


def incoming_key_set(df: pd.DataFrame, keys: list[str]) -> set:
    if len(keys) == 1:
        return {str(v) for v in df[keys[0]].tolist()}
    return {tuple(str(rec[k]) for k in keys) for rec in df[keys].to_dict(orient="records")}


def upsert_table(
    conn: psycopg.Connection,
    table: str,
    df: pd.DataFrame,
    keys: list[str],
    columns: list[str],
    replace: bool,
) -> tuple[int, int, int]:
    incoming_keys = incoming_key_set(df, keys)
    existing_keys = existing_key_set(conn, table, keys)
    n_insert = len(incoming_keys - existing_keys)
    n_update = len(incoming_keys & existing_keys)
    n_keep = 0 if replace else len(existing_keys - incoming_keys)

    if replace:
        conn.execute(f"DELETE FROM {table}")
        n_insert = len(incoming_keys)
        n_update = 0
        n_keep = 0

    placeholders = ", ".join(["%s"] * len(columns))
    col_sql = ", ".join(columns)
    set_sql = ", ".join(f"{c} = EXCLUDED.{c}" for c in columns if c not in keys)
    conflict = ", ".join(keys)
    sql = (
        f"INSERT INTO {table} ({col_sql}) VALUES ({placeholders}) "
        f"ON CONFLICT ({conflict}) DO UPDATE SET {set_sql}"
    )
    tuples = rows_as_tuples(df, columns)
    if tuples:
        with conn.cursor() as cur:
            cur.executemany(sql, tuples)
    return n_insert, n_update, n_keep


def report(name: str, n_insert: int, n_update: int, n_keep: int, total: int) -> None:
    print(f"{name}: insert={n_insert} update={n_update} keep={n_keep} total={total}")


def load_occupations() -> pd.DataFrame:
    path = REF / "ref_occupations.csv"
    df = pd.read_csv(path, dtype=str)
    missing = [c for c in OCCUPATION_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"{path.name} missing columns: {missing}")
    df["occupation_code"] = df["occupation_code"].astype(str)
    return df.sort_values("occupation_code").reset_index(drop=True)


def load_ilo_tasks() -> pd.DataFrame:
    path = REF / "ref_ilo_tasks.csv"
    df = pd.read_csv(path, dtype={"isco_08": str, "task_id": str})
    missing = [c for c in ILO_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"{path.name} missing columns: {missing}")
    df["isco_08"] = df["isco_08"].astype(str).str.zfill(4)
    df["task_id"] = df["task_id"].astype(str)
    for col in ("score_2025", "mean_score_2025"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df.sort_values(["isco_08", "task_id"]).reset_index(drop=True)


def load_wef_skills() -> pd.DataFrame:
    path = REF / "ref_wef_skills.csv"
    df = pd.read_csv(path)
    missing = [c for c in WEF_COLS if c not in df.columns]
    if missing:
        raise ValueError(f"{path.name} missing columns: {missing}")
    df["wef_skill_id"] = pd.to_numeric(df["wef_skill_id"], errors="coerce").astype(int)
    df["core_skill"] = df["core_skill"].astype(str)
    for col in ("core_skill_importance_2025_pct", "future_net_increase_2025_2030"):
        df[col] = pd.to_numeric(df[col], errors="coerce")
    return df.sort_values("wef_skill_id").reset_index(drop=True)


def read_interview_csv(name: str, columns: list[str]) -> pd.DataFrame:
    path = INTERVIEW / name
    df = pd.read_csv(path, dtype=str)
    df = df.rename(columns={"URL": "url"})
    missing = [c for c in columns if c not in df.columns]
    if missing:
        raise ValueError(f"{path.name} missing columns: {missing}")
    return df[columns]


def load_interview_bank() -> dict[str, pd.DataFrame]:
    """Read and check the Epic 9 question bank. Raises ValueError on any broken link."""
    sources = read_interview_csv("ref_interview_sources.csv", INTERVIEW_SOURCE_COLS)
    questions = read_interview_csv("ref_interview_questions.csv", INTERVIEW_QUESTION_COLS)
    mapping = read_interview_csv("ref_interview_occupation_questions.csv", INTERVIEW_MAPPING_COLS)
    coverage = read_interview_csv("ref_interview_coverage.csv", INTERVIEW_COVERAGE_COLS)

    questions["source_ids"] = questions["source_ids"].fillna("").str.split(";")
    mapping["display_order"] = pd.to_numeric(mapping["display_order"]).astype(int)
    for col in ("exact_count", "family_count", "targeted_count", "mapped_question_count"):
        coverage[col] = pd.to_numeric(coverage[col]).astype(int)

    problems: list[str] = []
    for name, df, key in (
        ("sources", sources, ["source_id"]),
        ("questions", questions, ["question_id"]),
        ("mapping", mapping, ["occupation_code", "question_id"]),
        ("coverage", coverage, ["occupation_code"]),
    ):
        if df.duplicated(key).any():
            problems.append(f"{name}: duplicate {key}")
    if questions["question"].duplicated().any():
        problems.append("questions: duplicate question text")
    if mapping.duplicated(["occupation_code", "display_order"]).any():
        problems.append("mapping: duplicate display_order within an occupation")
    known_sources = set(sources["source_id"])
    if any(not ids or not set(ids) <= known_sources for ids in questions["source_ids"]):
        problems.append("questions: empty or unknown source_ids")
    if not set(mapping["question_id"]) <= set(questions["question_id"]):
        problems.append("mapping: unknown question_id")
    if set(mapping["occupation_code"]) != set(coverage["occupation_code"]):
        problems.append("mapping and coverage cover different occupations")
    counts = mapping.groupby("occupation_code").size()
    declared = coverage.set_index("occupation_code")["mapped_question_count"]
    if (declared != counts.reindex(declared.index)).any():
        problems.append("coverage: mapped_question_count differs from mapping rows")
    if counts.min() < 5:
        problems.append("an occupation has fewer than five questions")
    if problems:
        raise ValueError("interview question bank is inconsistent: " + "; ".join(problems))
    return {
        "ref_interview_sources": sources,
        "ref_interview_questions": questions,
        "ref_interview_occupation_questions": mapping,
        "ref_interview_coverage": coverage,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Seed reference tables into Postgres / Neon.")
    parser.add_argument("--init", action="store_true", help="Apply db/schema.sql before seeding.")
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Rebuild lookup tables from CSV (does not touch business tables).",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    occupations = load_occupations()
    ilo_tasks = load_ilo_tasks()
    wef_skills = load_wef_skills()
    interview = load_interview_bank()

    with psycopg.connect(database_url()) as conn:
        if args.init:
            apply_schema(conn)
        if args.replace:
            # Interview tables point at ref_occupations, so empty them before it.
            for table in INTERVIEW_TABLES:
                conn.execute(f"DELETE FROM {table}")
        i, u, k = upsert_table(
            conn, "ref_occupations", occupations, ["occupation_code"], OCCUPATION_COLS, args.replace
        )
        report("ref_occupations", i, u, k, len(occupations) + (k if not args.replace else 0))
        i, u, k = upsert_table(
            conn, "ref_ilo_tasks", ilo_tasks, ["isco_08", "task_id"], ILO_COLS, args.replace
        )
        report("ref_ilo_tasks", i, u, k, len(ilo_tasks) + (k if not args.replace else 0))
        i, u, k = upsert_table(
            conn, "ref_wef_skills", wef_skills, ["wef_skill_id"], WEF_COLS, args.replace
        )
        report("ref_wef_skills", i, u, k, len(wef_skills) + (k if not args.replace else 0))
        # Parents first: sources and questions before the tables that point at them.
        for table, keys, columns in (
            ("ref_interview_sources", ["source_id"], INTERVIEW_SOURCE_COLS),
            ("ref_interview_questions", ["question_id"], INTERVIEW_QUESTION_COLS),
            ("ref_interview_coverage", ["occupation_code"], INTERVIEW_COVERAGE_COLS),
            (
                "ref_interview_occupation_questions",
                ["occupation_code", "question_id"],
                INTERVIEW_MAPPING_COLS,
            ),
        ):
            df = interview[table]
            i, u, k = upsert_table(conn, table, df, keys, columns, args.replace)
            report(table, i, u, k, len(df) + (k if not args.replace else 0))
        conn.commit()


if __name__ == "__main__":
    main()
