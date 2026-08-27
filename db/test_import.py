#!/usr/bin/env python3
"""Check that Neon lookup tables match data/reference CSV files.

Compares row keys and field values. Extra DB rows (upsert keep) are reported
as warnings unless --strict. Business tables must stay empty.

Run:
  python3 db/test_import.py
  python3 db/test_import.py --strict
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import pandas as pd
import psycopg
from psycopg.rows import dict_row

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from seed_reference import (  # noqa: E402
    ILO_COLS,
    OCCUPATION_COLS,
    WEF_COLS,
    database_url,
    load_ilo_tasks,
    load_occupations,
    load_wef_skills,
)

BUSINESS_TABLES = [
    "users",
    "work_profiles",
    "profile_tasks",
    "task_assessments",
    "profile_wef_skills",
    "wef_skill_task_links",
    "skill_examples",
    "review_events",
]


def norm(value):
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    if hasattr(value, "item"):
        value = value.item()
    if isinstance(value, float):
        if math.isnan(value):
            return None
        return round(value, 6)
    if isinstance(value, int) and not isinstance(value, bool):
        return value
    return str(value)


def values_equal(left, right) -> bool:
    a, b = norm(left), norm(right)
    if a is None and b is None:
        return True
    if a == b:
        return True
    if a is not None and b is not None and str(a) == str(b):
        return True
    try:
        return math.isclose(float(a), float(b), rel_tol=0, abs_tol=1e-9)
    except (TypeError, ValueError):
        return False


def fetch_table(conn: psycopg.Connection, table: str, columns: list[str]) -> list[dict]:
    col_sql = ", ".join(columns)
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(f"SELECT {col_sql} FROM {table}")
        return list(cur.fetchall())


def count_rows(conn: psycopg.Connection, table: str) -> int:
    with conn.cursor() as cur:
        cur.execute(f"SELECT COUNT(*) FROM {table}")
        return int(cur.fetchone()[0])


def row_key(row: dict, keys: list[str]) -> tuple:
    parts = []
    for key in keys:
        value = row[key]
        if key == "isco_08":
            parts.append(str(value).zfill(4))
        else:
            parts.append(str(value))
    return tuple(parts)


def compare_table(
    name: str,
    csv_df: pd.DataFrame,
    db_rows: list[dict],
    keys: list[str],
    columns: list[str],
    strict: bool,
) -> list[str]:
    errors: list[str] = []
    csv_map = {row_key(rec, keys): rec for rec in csv_df[columns].to_dict(orient="records")}
    db_map = {row_key(rec, keys): rec for rec in db_rows}

    missing = sorted(csv_map.keys() - db_map.keys())
    extra = sorted(db_map.keys() - csv_map.keys())
    for key in missing:
        errors.append(f"{name}: missing in Neon {key}")
    for key in extra:
        msg = f"{name}: extra in Neon {key}"
        if strict:
            errors.append(msg)
        else:
            print(f"WARN {msg}")

    mismatches = 0
    for key in sorted(csv_map.keys() & db_map.keys()):
        csv_row, db_row = csv_map[key], db_map[key]
        diffs = [
            f"{col}: csv={norm(csv_row[col])!r} db={norm(db_row[col])!r}"
            for col in columns
            if not values_equal(csv_row[col], db_row[col])
        ]
        if diffs:
            mismatches += 1
            errors.append(f"{name}: {key} {'; '.join(diffs)}")

    matched = len(csv_map.keys() & db_map.keys()) - mismatches
    print(
        f"{name}: csv={len(csv_map)} neon={len(db_map)} "
        f"matched={matched} missing={len(missing)} extra={len(extra)} "
        f"mismatch={mismatches}"
    )
    return errors


def check_tree(occupations: pd.DataFrame) -> list[str]:
    errors: list[str] = []
    codes = set(occupations["occupation_code"].astype(str))
    for rec in occupations.to_dict(orient="records"):
        parent = rec.get("parent_code")
        if parent is None or (isinstance(parent, float) and pd.isna(parent)):
            parent = ""
        parent = str(parent).strip()
        code = str(rec["occupation_code"])
        level = rec["level"]
        if level == "major" and parent:
            errors.append(f"tree: major {code} has parent_code={parent!r}")
        if level != "major" and parent not in codes:
            errors.append(f"tree: {code} parent_code={parent!r} not in occupations")
    units = occupations.loc[occupations["level"] == "unit", "occupation_code"].astype(str)
    if set(units) != {"5221", "5222", "5223"}:
        print(f"WARN unit codes are {sorted(units)} (pilot expected 5221/5222/5223)")
    return errors


def check_ilo_units(occupations: pd.DataFrame, ilo: pd.DataFrame) -> list[str]:
    errors: list[str] = []
    units = set(occupations.loc[occupations["level"] == "unit", "occupation_code"].astype(str))
    for code in sorted(ilo["isco_08"].astype(str).str.zfill(4).unique()):
        if code not in units:
            errors.append(f"ilo: isco_08={code} is not a unit occupation")
    for code in sorted(units):
        n = int((ilo["isco_08"].astype(str).str.zfill(4) == code).sum())
        if n == 0:
            errors.append(f"ilo: unit {code} has 0 tasks in CSV")
    return errors


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify Neon seed against reference CSVs.")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Fail if Neon has extra lookup rows not in CSV.",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    occupations = load_occupations()
    ilo_tasks = load_ilo_tasks()
    wef_skills = load_wef_skills()
    errors: list[str] = []

    with psycopg.connect(database_url()) as conn:
        errors.extend(
            compare_table(
                "ref_occupations",
                occupations,
                fetch_table(conn, "ref_occupations", OCCUPATION_COLS),
                ["occupation_code"],
                OCCUPATION_COLS,
                args.strict,
            )
        )
        errors.extend(
            compare_table(
                "ref_ilo_tasks",
                ilo_tasks,
                fetch_table(conn, "ref_ilo_tasks", ILO_COLS),
                ["isco_08", "task_id"],
                ILO_COLS,
                args.strict,
            )
        )
        errors.extend(
            compare_table(
                "ref_wef_skills",
                wef_skills,
                fetch_table(conn, "ref_wef_skills", WEF_COLS),
                ["wef_skill_id"],
                WEF_COLS,
                args.strict,
            )
        )
        for table in BUSINESS_TABLES:
            n = count_rows(conn, table)
            status = "ok empty" if n == 0 else f"FAIL {n} rows (seed must not write this table)"
            print(f"{table}: {status}")
            if n:
                errors.append(f"{table}: expected 0 rows, found {n}")

    errors.extend(check_tree(occupations))
    errors.extend(check_ilo_units(occupations, ilo_tasks))

    if errors:
        print(f"\nFAILED {len(errors)} check(s)")
        for item in errors[:50]:
            print(f"  - {item}")
        if len(errors) > 50:
            print(f"  ... {len(errors) - 50} more")
        raise SystemExit(1)
    print("\nimport checks passed")


if __name__ == "__main__":
    main()
