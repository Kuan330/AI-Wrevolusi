#!/usr/bin/env python3
"""What the product returns for a user input (E1 lookup against Neon).

Simulates:
  drill-down: major -> sub_major -> minor -> unit
  keyword search on occupation title
  unit confirm -> ILO starter tasks + 2025 scores

Run:
  python3 db/test_user_queries.py
  python3 db/test_user_queries.py --keyword supervisor
  python3 db/test_user_queries.py --code 5222
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import psycopg
from psycopg.rows import dict_row

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from seed_reference import database_url  # noqa: E402

OCC_COLS = "occupation_code, level, parent_code, title, description"


def fetch_all(conn: psycopg.Connection, sql: str, params: tuple = ()) -> list[dict]:
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(sql, params)
        return list(cur.fetchall())


def list_majors(conn: psycopg.Connection) -> list[dict]:
    return fetch_all(
        conn,
        f"SELECT {OCC_COLS} FROM ref_occupations WHERE level = %s ORDER BY occupation_code",
        ("major",),
    )


def list_children(conn: psycopg.Connection, parent_code: str) -> list[dict]:
    return fetch_all(
        conn,
        f"SELECT {OCC_COLS} FROM ref_occupations WHERE parent_code = %s ORDER BY occupation_code",
        (parent_code,),
    )


def search_occupations(conn: psycopg.Connection, keyword: str) -> list[dict]:
    q = f"%{keyword.strip()}%"
    return fetch_all(
        conn,
        f"""
        SELECT {OCC_COLS}
        FROM ref_occupations
        WHERE title ILIKE %s OR description ILIKE %s
        ORDER BY occupation_code
        """,
        (q, q),
    )


def get_occupation(conn: psycopg.Connection, code: str) -> dict | None:
    rows = fetch_all(
        conn,
        f"SELECT {OCC_COLS} FROM ref_occupations WHERE occupation_code = %s",
        (code,),
    )
    return rows[0] if rows else None


def list_ilo_tasks(conn: psycopg.Connection, unit_code: str) -> list[dict]:
    return fetch_all(
        conn,
        """
        SELECT isco_08, task_id, task_text, score_2025, potential25, mean_score_2025
        FROM ref_ilo_tasks
        WHERE isco_08 = %s
        ORDER BY task_id
        """,
        (unit_code,),
    )


def print_occupations(label: str, rows: list[dict]) -> None:
    print(f"\n== {label} ({len(rows)} rows) ==")
    if not rows:
        print("  (none)")
        return
    for row in rows:
        desc = (row.get("description") or "").strip()
        extra = f" — {desc[:80]}..." if len(desc) > 80 else (f" — {desc}" if desc else "")
        print(
            f"  [{row['occupation_code']}] {row['level']:10} {row['title']}{extra}"
        )


def print_tasks(unit_code: str, rows: list[dict]) -> None:
    print(f"\n== ILO starter tasks for {unit_code} ({len(rows)} rows) ==")
    if not rows:
        print("  (none — ILO attaches only to level=unit)")
        return
    for row in rows:
        print(
            f"  #{row['task_id']}  score_2025={row['score_2025']}  "
            f"{row['task_text']}"
        )


def run_pilot_walkthrough(conn: psycopg.Connection) -> None:
    print("User opens occupation picker (no input yet)")
    majors = list_majors(conn)
    print_occupations("screen: choose major group", majors)

    print("\nUser selects: 5")
    print_occupations("screen: children of 5", list_children(conn, "5"))

    print("\nUser selects: 52")
    print_occupations("screen: children of 52", list_children(conn, "52"))

    print("\nUser selects: 522")
    print_occupations("screen: children of 522 (units)", list_children(conn, "522"))

    print("\nUser types keyword: supervisor")
    print_occupations("screen: title/description search", search_occupations(conn, "supervisor"))

    print("\nUser confirms unit: 5222 Shop Supervisors")
    occ = get_occupation(conn, "5222")
    if occ:
        print_occupations("confirmed occupation", [occ])
    print_tasks("5222", list_ilo_tasks(conn, "5222"))


def run_assertions(conn: psycopg.Connection) -> None:
    majors = list_majors(conn)
    assert [r["occupation_code"] for r in majors] == ["5"], majors

    units = list_children(conn, "522")
    assert [r["occupation_code"] for r in units] == ["5221", "5222", "5223"], units

    hits = search_occupations(conn, "supervisor")
    assert any(r["occupation_code"] == "5222" for r in hits), hits

    occ = get_occupation(conn, "5222")
    assert occ and occ["level"] == "unit" and occ["title"] == "Shop Supervisors"

    tasks = list_ilo_tasks(conn, "5222")
    assert len(tasks) == 8, len(tasks)
    assert get_occupation(conn, "9999") is None
    assert list_ilo_tasks(conn, "52") == []
    print("\nassertions passed")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Demo E1 lookups against Neon.")
    parser.add_argument("--keyword", help="Search occupation title/description")
    parser.add_argument("--code", help="Occupation code: children if not unit, else ILO tasks")
    parser.add_argument("--no-assert", action="store_true", help="Skip built-in checks")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    with psycopg.connect(database_url()) as conn:
        if args.keyword:
            print_occupations(f"search {args.keyword!r}", search_occupations(conn, args.keyword))
            return
        if args.code:
            occ = get_occupation(conn, args.code)
            if not occ:
                print(f"no occupation {args.code}")
                return
            print_occupations("matched occupation", [occ])
            if occ["level"] == "unit":
                print_tasks(args.code, list_ilo_tasks(conn, args.code))
            else:
                print_occupations(f"next screen: children of {args.code}", list_children(conn, args.code))
            return
        run_pilot_walkthrough(conn)
        if not args.no_assert:
            run_assertions(conn)


if __name__ == "__main__":
    main()
