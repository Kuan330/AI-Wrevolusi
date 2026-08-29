from __future__ import annotations

import os
from pathlib import Path

import psycopg
from psycopg.rows import dict_row


def load_root_env() -> None:
    root = Path(__file__).resolve().parents[2]
    path = root / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip("'").strip('"'))


def database_url() -> str:
    load_root_env()
    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        raise RuntimeError(
            "DATABASE_URL is missing. Put the Neon **dev** URI in the repo-root .env."
        )
    if "sslmode=" not in url:
        sep = "&" if "?" in url else "?"
        url = f"{url}{sep}sslmode=require"
    return url


def fetch_all(sql: str, params: tuple = ()) -> list[dict]:
    with psycopg.connect(database_url()) as conn:
        with conn.cursor(row_factory=dict_row) as cur:
            cur.execute(sql, params)
            return list(cur.fetchall())


def fetch_one(sql: str, params: tuple = ()) -> dict | None:
    rows = fetch_all(sql, params)
    return rows[0] if rows else None
