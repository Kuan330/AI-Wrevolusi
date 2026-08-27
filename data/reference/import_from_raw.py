#!/usr/bin/env python3
"""Build reference (lookup) tables from data/raw CSV files.

Import mode: match then insert (upsert).
  - Same key in raw and ref: update fields from raw
  - Key only in raw: insert
  - Key only in ref: keep (do not delete)
Full rebuild: python import_from_raw.py --replace

Does not write users, work_profiles, or other business tables.
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
RAW = HERE.parent / "raw"

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


def build_occupations(masco: pd.DataFrame) -> pd.DataFrame:
    needed = [
        "unit_code",
        "unit_title",
        "unit_description",
        "major_code",
        "major_title",
        "sub_major_code",
        "sub_major_title",
        "minor_code",
        "minor_title",
        "skill_level",
        "source",
        "source_year",
    ]
    missing = [c for c in needed if c not in masco.columns]
    if missing:
        raise ValueError(f"masco_occupation_raw missing columns: {missing}")

    units = masco[needed].drop_duplicates(subset=["unit_code"], keep="first")
    rows: list[dict[str, str]] = []
    seen: set[str] = set()

    def add_node(
        code: str,
        level: str,
        parent_code: str,
        title: str,
        description: str,
        skill_level: str,
        source: str,
        source_year: str,
    ) -> None:
        code = str(code).strip()
        if not code or code in seen:
            return
        seen.add(code)
        rows.append(
            {
                "occupation_code": code,
                "level": level,
                "parent_code": parent_code,
                "title": title,
                "description": description,
                "skill_level": skill_level,
                "source": source,
                "source_year": source_year,
            }
        )

    for rec in units.to_dict(orient="records"):
        source = rec["source"]
        source_year = rec["source_year"]
        add_node(
            rec["major_code"],
            "major",
            "",
            rec["major_title"],
            "",
            rec["skill_level"] or "",
            source,
            source_year,
        )
        add_node(
            rec["sub_major_code"],
            "sub_major",
            rec["major_code"],
            rec["sub_major_title"],
            "",
            "",
            source,
            source_year,
        )
        add_node(
            rec["minor_code"],
            "minor",
            rec["sub_major_code"],
            rec["minor_title"],
            "",
            "",
            source,
            source_year,
        )
        add_node(
            rec["unit_code"],
            "unit",
            rec["minor_code"],
            rec["unit_title"],
            rec["unit_description"] or "",
            "",
            source,
            source_year,
        )

    occ = pd.DataFrame(rows)
    return occ[OCCUPATION_COLS].sort_values("occupation_code").reset_index(drop=True)


def build_ilo_tasks(ilo: pd.DataFrame, occupation_codes: list[str]) -> pd.DataFrame:
    missing = [c for c in ILO_COLS if c not in ilo.columns]
    if missing:
        raise ValueError(f"ilo_task_score_raw missing columns: {missing}")

    out = ilo[ILO_COLS].copy()
    out["isco_08"] = out["isco_08"].astype(str).str.zfill(4)
    out = out[out["isco_08"].isin(occupation_codes)]
    return out.sort_values(["isco_08", "task_id"]).reset_index(drop=True)


def build_wef_skills(wef: pd.DataFrame) -> pd.DataFrame:
    source_cols = [c for c in WEF_COLS if c != "wef_skill_id"]
    missing = [c for c in source_cols if c not in wef.columns]
    if missing:
        raise ValueError(f"wef_skill_master_raw missing columns: {missing}")
    return wef[source_cols].copy().reset_index(drop=True)


def load_existing(path: Path, **read_csv_kw) -> pd.DataFrame | None:
    if not path.exists() or path.stat().st_size == 0:
        return None
    df = pd.read_csv(path, **read_csv_kw)
    if df.empty:
        return None
    return df


def upsert(
    existing: pd.DataFrame | None,
    incoming: pd.DataFrame,
    keys: list[str],
    columns: list[str],
) -> tuple[pd.DataFrame, int, int, int]:
    """Update matched keys, insert new keys, keep ref-only keys."""
    incoming = incoming[columns].copy()
    if existing is None or existing.empty:
        return incoming.reset_index(drop=True), len(incoming), 0, 0

    extra_cols = [c for c in columns if c not in existing.columns]
    for col in extra_cols:
        existing[col] = pd.NA
    existing = existing[[c for c in columns if c in existing.columns]].copy()
    for col in keys:
        incoming[col] = incoming[col].astype(str)
        existing[col] = existing[col].astype(str)

    incoming_i = incoming.set_index(keys)
    existing_i = existing.set_index(keys)
    incoming_keys = set(incoming_i.index)
    existing_keys = set(existing_i.index)
    matched = incoming_keys & existing_keys
    added_keys = incoming_keys - existing_keys
    kept_keys = existing_keys - incoming_keys

    parts: list[pd.DataFrame] = []
    if matched:
        parts.append(incoming_i.loc[list(matched)])
    if added_keys:
        parts.append(incoming_i.loc[list(added_keys)])
    if kept_keys:
        parts.append(existing_i.loc[list(kept_keys)])
    out = pd.concat(parts).reset_index()
    out = out[columns]
    return out, len(added_keys), len(matched), len(kept_keys)


def upsert_wef(
    existing: pd.DataFrame | None,
    incoming: pd.DataFrame,
) -> tuple[pd.DataFrame, int, int, int]:
    """Match WEF rows on core_skill. Keep existing wef_skill_id; new rows get max+1."""
    incoming = incoming.copy()
    incoming["core_skill"] = incoming["core_skill"].astype(str)
    if existing is None or existing.empty:
        incoming.insert(0, "wef_skill_id", range(1, len(incoming) + 1))
        return incoming[WEF_COLS].reset_index(drop=True), len(incoming), 0, 0

    existing = existing.copy()
    existing["core_skill"] = existing["core_skill"].astype(str)
    if "wef_skill_id" not in existing.columns:
        existing.insert(0, "wef_skill_id", range(1, len(existing) + 1))
    id_by_skill = dict(
        zip(existing["core_skill"], pd.to_numeric(existing["wef_skill_id"], errors="coerce"))
    )
    next_id = int(pd.to_numeric(existing["wef_skill_id"], errors="coerce").max() or 0)

    matched = incoming["core_skill"].isin(existing["core_skill"])
    n_update = int(matched.sum())
    n_insert = int((~matched).sum())
    incoming = incoming.copy()
    incoming["wef_skill_id"] = 0
    for i, skill in incoming["core_skill"].items():
        if skill in id_by_skill and pd.notna(id_by_skill[skill]):
            incoming.at[i, "wef_skill_id"] = int(id_by_skill[skill])
        else:
            next_id += 1
            incoming.at[i, "wef_skill_id"] = next_id

    extra = existing[~existing["core_skill"].isin(incoming["core_skill"])].copy()
    n_keep = len(extra)
    for col in WEF_COLS:
        if col not in extra.columns:
            extra[col] = pd.NA
    out = pd.concat([incoming[WEF_COLS], extra[WEF_COLS]], ignore_index=True)
    out["wef_skill_id"] = pd.to_numeric(out["wef_skill_id"], errors="coerce").astype(int)
    out = out.sort_values("wef_skill_id").reset_index(drop=True)
    return out, n_insert, n_update, n_keep


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import raw CSV files into reference tables.")
    parser.add_argument("--raw-dir", type=Path, default=RAW)
    parser.add_argument("--out-dir", type=Path, default=HERE)
    parser.add_argument(
        "--replace",
        action="store_true",
        help="Rebuild reference tables from raw (overwrite). Default is match-then-insert.",
    )
    return parser.parse_args()


def report(name: str, n_insert: int, n_update: int, n_keep: int, total: int, path: Path) -> None:
    print(
        f"{name}: insert={n_insert} update={n_update} keep={n_keep} "
        f"total={total} -> {path}"
    )


def main() -> None:
    args = parse_args()
    raw_dir = args.raw_dir.expanduser().resolve()
    out_dir = args.out_dir.expanduser().resolve()
    out_dir.mkdir(parents=True, exist_ok=True)

    masco_path = raw_dir / "masco_occupation_raw.csv"
    ilo_path = raw_dir / "ilo_task_score_raw.csv"
    wef_path = raw_dir / "wef_skill_master_raw.csv"
    for path in (masco_path, ilo_path, wef_path):
        if not path.exists():
            raise FileNotFoundError(path)

    masco = pd.read_csv(masco_path, dtype=str)
    ilo = pd.read_csv(ilo_path, dtype={"isco_08": str})
    wef = pd.read_csv(wef_path)

    incoming_occ = build_occupations(masco)
    unit_codes = incoming_occ.loc[incoming_occ["level"] == "unit", "occupation_code"].tolist()
    incoming_ilo = build_ilo_tasks(ilo, unit_codes)
    incoming_ilo["task_id"] = incoming_ilo["task_id"].astype(str)
    incoming_wef = build_wef_skills(wef)

    occ_out = out_dir / "ref_occupations.csv"
    ilo_out = out_dir / "ref_ilo_tasks.csv"
    wef_out = out_dir / "ref_wef_skills.csv"

    if args.replace:
        occupations = incoming_occ
        ilo_tasks = incoming_ilo
        incoming_wef.insert(0, "wef_skill_id", range(1, len(incoming_wef) + 1))
        wef_skills = incoming_wef[WEF_COLS]
        report("ref_occupations", len(occupations), 0, 0, len(occupations), occ_out)
        report("ref_ilo_tasks", len(ilo_tasks), 0, 0, len(ilo_tasks), ilo_out)
        report("ref_wef_skills", len(wef_skills), 0, 0, len(wef_skills), wef_out)
    else:
        occupations, i, u, k = upsert(
            load_existing(occ_out, dtype=str),
            incoming_occ,
            ["occupation_code"],
            OCCUPATION_COLS,
        )
        occupations = occupations.sort_values("occupation_code").reset_index(drop=True)
        report("ref_occupations", i, u, k, len(occupations), occ_out)

        ilo_tasks, i, u, k = upsert(
            load_existing(ilo_out, dtype={"isco_08": str, "task_id": str}),
            incoming_ilo,
            ["isco_08", "task_id"],
            ILO_COLS,
        )
        ilo_tasks["isco_08"] = ilo_tasks["isco_08"].astype(str).str.zfill(4)
        ilo_tasks = ilo_tasks.sort_values(["isco_08", "task_id"]).reset_index(drop=True)
        report("ref_ilo_tasks", i, u, k, len(ilo_tasks), ilo_out)

        wef_skills, i, u, k = upsert_wef(load_existing(wef_out), incoming_wef)
        report("ref_wef_skills", i, u, k, len(wef_skills), wef_out)

    occupations.to_csv(occ_out, index=False)
    ilo_tasks.to_csv(ilo_out, index=False)
    wef_skills.to_csv(wef_out, index=False)


if __name__ == "__main__":
    main()
