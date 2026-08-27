#!/usr/bin/env python3
"""Build Iteration 1 source row tables as UTF-8 CSV.

Outputs (same folder as this script)
------------------------------------
- masco_occupation_raw.csv
- ilo_task_score_raw.csv
- wef_skill_master_raw.csv

Cleaning record
---------------
MASCO 2020
  Source: Malaysia Standard Classification of Occupations (MASCO) 2020, English PDF.
  https://www.dosm.gov.my/uploads/content-downloads/file_20220920110308.pdf
  Grain: one row = one Unit Group task from "Tasks include".
  Hierarchy is flattened onto every task row:
    major (1 digit) -> sub-major (2) -> minor (3) -> unit (4).
  6-digit job titles are not stored. Tasks in MASCO sit at Unit Group.
  KEEP generic lines such as "Performing related tasks".
  Pilot seed: 5221, 5222, 5223 (parents 5 / 52 / 522).
  This table is for source completeness and later alignment with ILO.
  E1 starter tasks and E2 scores come from ilo_task_score_raw.

Original files (do not edit; copy only):
  data/sources/masco/masco_2020_en.pdf
  data/sources/ilo/Final_Scores_ISCO08_Gmyrek_et_al_2025.xlsx
  data/sources/wef/WEF_Future_of_Jobs_2025_skill_master_table.csv
  data/sources/wef/figure_3_3_core_skills_2025.png
  data/sources/wef/figure_3_4_skills_on_the_rise_2025_2030.png
  data/sources/wef/figure_b3_1_genai_substitution_by_skill_group.png
  data/sources/wef/SOURCE.txt

WEF Future of Jobs 2025 skill master
  Source: compiled from WEF Future of Jobs Report 2025 figures (Survey 2024).
  Grain: one row = one WEF Global Skills Taxonomy core skill (26 rows).
  KEEP the compiled numeric fields; ADD wef_skill_group from Figure 3.3.
  RECOMPUTE future_trend_category from net increase:
    >= 61 Very High Growth; >= 41 High Growth; >= 20 Moderate Growth;
    >= 0 Slight Growth; < 0 Declining.
  KEEP genai_substitution_capacity_category from the compiled table
    (visual read of Figure B3.1; not a percentage).
    Motivation and self-awareness is Not shown (absent from B3.1;
    that chart includes Financial management instead).
  ADD genai_chart_label where Figure B3.1 uses a different skill-group name.
  This table is a skill-group reference for E3 labelling, not an occupation
  or task list. It does not join to MASCO/ILO by 4-digit code.

ILO / Gmyrek et al. 2025
  Source: data/sources/ilo/Final_Scores_ISCO08_Gmyrek_et_al_2025.xlsx
  Grain: one row = one ISCO-08 4-digit occupation task (Excel grain).
  KEEP all 21 source columns. Rename to snake_case only.
  Occupation-level fields stay repeated on each task row:
    mean_score_*, sd_*, potential25, potential23.
  Do not filter to the MASCO pilot; later occupations can join by 4-digit code.

Join key for later matching:
  masco_occupation_raw.unit_code = ilo_task_score_raw.isco_08

Run:
  python clean_row_tables.py
  python clean_row_tables.py --ilo-source /path/to/file.xlsx --wef-source /path/to/wef.csv
"""

from __future__ import annotations

import argparse
import csv
from pathlib import Path

import pandas as pd

HERE = Path(__file__).resolve().parent
SOURCES = HERE.parent / "sources"

DEFAULT_ILO_SOURCE = SOURCES / "ilo" / "Final_Scores_ISCO08_Gmyrek_et_al_2025.xlsx"
DEFAULT_WEF_SOURCE = (
    SOURCES / "wef" / "WEF_Future_of_Jobs_2025_skill_master_table.csv"
)

MASCO_COLUMNS = [
    "major_code",
    "major_title",
    "sub_major_code",
    "sub_major_title",
    "minor_code",
    "minor_title",
    "unit_code",
    "unit_title",
    "unit_description",
    "skill_level",
    "task_letter",
    "task_text",
    "source",
    "source_year",
]

MAJOR_5 = {
    "major_code": "5",
    "major_title": "Service and Sales Workers",
    "skill_level": "2",
    "source": "MASCO 2020",
    "source_year": "2020",
}
SUB_MAJOR_52 = {
    "sub_major_code": "52",
    "sub_major_title": "Sales Workers",
}
MINOR_522 = {
    "minor_code": "522",
    "minor_title": "Shop Salespersons",
}

UNIT_GROUPS = [
    {
        **MAJOR_5,
        **SUB_MAJOR_52,
        **MINOR_522,
        "unit_code": "5221",
        "unit_title": "Shopkeepers",
        "unit_description": (
            "Shopkeepers operate small retail shops either independently or with "
            "support from a small number of others."
        ),
        "tasks": [
            ("a", "Loading and unloading goods for sale"),
            ("b", "Receiving payment and keeping accounts"),
            ("c", "Stacking and displaying items for sale"),
            (
                "d",
                "Advising customers on the selection, price, delivery, use and care of goods and services",
            ),
            ("e", "Preparing bills, invoices or receipts"),
            ("f", "Checking stock and participating in stock takes"),
            ("g", "Performing related tasks"),
            ("h", "Supervising other workers"),
        ],
    },
    {
        **MAJOR_5,
        **SUB_MAJOR_52,
        **MINOR_522,
        "unit_code": "5222",
        "unit_title": "Shop Supervisors",
        "unit_description": (
            "Shop Supervisors supervise and coordinate the activities of shop sales "
            "assistants and other workers in retail and wholesale shops such as "
            "supermarkets and department stores."
        ),
        "tasks": [
            (
                "a",
                "Estimating the types and quantities of goods required by customers and ensuring adequate stock",
            ),
            (
                "b",
                "Teaching staff the sales procedures, including how to deal with difficult and complex cases",
            ),
            ("c", "Supervising sales staff"),
            (
                "d",
                "Estimating needs of the business, purchase or authorise the purchase of goods of the types, qualities and quantities required, usually under the general direction of the proprietor or manager",
            ),
            ("e", "Examining returned goods and deciding on appropriate action"),
            (
                "f",
                "Supervising and instructing sales and other staff or the sales department in their day-to-day work",
            ),
            ("g", "Ensuring the prices of goods and services are displayed"),
            ("h", "Checking stock and participating in stock takes"),
            ("i", "Performing related tasks"),
            ("j", "Supervising other workers"),
        ],
    },
    {
        **MAJOR_5,
        **SUB_MAJOR_52,
        **MINOR_522,
        "unit_code": "5223",
        "unit_title": "Shop Sales Assistants",
        "unit_description": (
            "Shop Sales Assistants sell a range of goods and services directly to the "
            "public or on behalf of retail and wholesale establishments. They explain "
            "the functions and qualities of these goods or services."
        ),
        "tasks": [
            (
                "a",
                "Moving goods to be sold from storage area to sales area and placing them on display",
            ),
            ("b", "Explaining the functions and qualities of a product"),
            (
                "c",
                "Ascertaining the nature and quality of a product desired by a customer",
            ),
            ("d", "Assisting customers in making a choice"),
            ("e", "Quoting prices, credit terms and discounts"),
            ("f", "Packing and arranging delivery of goods, if necessary"),
            ("g", "Preparing bills, invoices or receipts"),
            ("h", "Verifying cashier's receipt, if necessary"),
            (
                "i",
                "Giving demonstrations of articles on sale in order to inform customers about their characteristics and mode of use, as well as to stimulate buying interest",
            ),
            ("j", "Performing related tasks"),
        ],
    },
]

ILO_COLUMN_MAP = {
    "label4d": "label4d",
    "label1d": "label1d",
    "ISCO_08": "isco_08",
    "Title": "title",
    "taskID": "task_id",
    "Task_ISCO": "task_text",
    "score_2023": "score_2023",
    "Weaviate Status": "weaviate_status",
    "predicted_score_2025_gpt4o": "predicted_score_2025_gpt4o",
    "prediction_justification_gpt4o": "prediction_justification_gpt4o",
    "weaviate_status_gemini": "weaviate_status_gemini",
    "predicted_score_2025_gemini": "predicted_score_2025_gemini",
    "prediction_justification_gemini": "prediction_justification_gemini",
    "score_2025": "score_2025",
    "source": "source",
    "mean_score_2023": "mean_score_2023",
    "mean_score_2025": "mean_score_2025",
    "SD_2023": "sd_2023",
    "SD_2025": "sd_2025",
    "potential25": "potential25",
    "potential23": "potential23",
}

# Figure 3.3 colour groups (WEF Global Skills Taxonomy).
WEF_SKILL_GROUP = {
    "Analytical thinking": "Cognitive skills",
    "Resilience, flexibility and agility": "Self-efficacy",
    "Leadership and social influence": "Working with others",
    "Creative thinking": "Cognitive skills",
    "Motivation and self-awareness": "Self-efficacy",
    "Technological literacy": "Technology skills",
    "Empathy and active listening": "Working with others",
    "Curiosity and lifelong learning": "Self-efficacy",
    "Talent management": "Management skills",
    "Service orientation and customer service": "Engagement skills",
    "AI and big data": "Technology skills",
    "Systems thinking": "Cognitive skills",
    "Resource management and operations": "Working with others",
    "Dependability and attention to detail": "Self-efficacy",
    "Quality control": "Management skills",
    "Teaching and mentoring": "Working with others",
    "Networks and cybersecurity": "Technology skills",
    "Design and user experience": "Technology skills",
    "Multi-lingualism": "Cognitive skills",
    "Marketing and media": "Engagement skills",
    "Reading, writing and mathematics": "Cognitive skills",
    "Environmental stewardship": "Ethics",
    "Programming": "Technology skills",
    "Manual dexterity, endurance and precision": "Physical abilities",
    "Global citizenship": "Ethics",
    "Sensory-processing abilities": "Physical abilities",
}

# Figure B3.1 uses a slightly different skill-group label in a few cases.
WEF_GENAI_CHART_LABEL = {
    "AI and big data": "Artificial intelligence and big data",
    "Technological literacy": "Technology literacy",
    "Resource management and operations": "Operations and logistics",
    "Quality control": "Quality management",
    "Teaching and mentoring": "Teaching, mentoring, and coaching",
}

WEF_COLUMNS = [
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


def derive_future_trend(net_increase: float) -> str:
    if net_increase >= 61:
        return "Very High Growth"
    if net_increase >= 41:
        return "High Growth"
    if net_increase >= 20:
        return "Moderate Growth"
    if net_increase >= 0:
        return "Slight Growth"
    return "Declining"


def clean_wef_frame(df: pd.DataFrame) -> pd.DataFrame:
    required = [
        "core_skill",
        "core_skill_importance_2025_pct",
        "future_net_increase_2025_2030",
        "genai_substitution_capacity_category_derived",
    ]
    missing = [col for col in required if col not in df.columns]
    if missing:
        raise ValueError(f"WEF compiled table is missing columns: {missing}")

    out = df.copy()
    out["core_skill"] = out["core_skill"].astype(str).str.strip()
    unknown = [s for s in out["core_skill"] if s not in WEF_SKILL_GROUP]
    if unknown:
        raise ValueError(f"No WEF skill group mapped for: {unknown}")

    out["wef_skill_group"] = out["core_skill"].map(WEF_SKILL_GROUP)
    out["core_skill_importance_2025_pct"] = pd.to_numeric(
        out["core_skill_importance_2025_pct"], errors="raise"
    ).astype(int)
    out["future_net_increase_2025_2030"] = pd.to_numeric(
        out["future_net_increase_2025_2030"], errors="raise"
    ).astype(int)
    out["future_trend_category"] = out["future_net_increase_2025_2030"].map(
        derive_future_trend
    )
    out["genai_substitution_capacity_category"] = (
        out["genai_substitution_capacity_category_derived"].astype(str).str.strip()
    )
    out["genai_chart_label"] = out["core_skill"].map(
        lambda name: WEF_GENAI_CHART_LABEL.get(name, name)
    )
    out.loc[
        out["genai_substitution_capacity_category"].str.lower() == "not shown",
        "genai_chart_label",
    ] = ""
    out["source"] = "WEF Future of Jobs Report 2025"
    out["source_year"] = 2025
    out["source_figures"] = "Figure 3.3; Figure 3.4; Figure B3.1"
    return out[WEF_COLUMNS]


def write_wef_csv(source: Path, output_path: Path) -> pd.DataFrame:
    if not source.exists():
        raise FileNotFoundError(
            f"WEF compiled table not found: {source}\n"
            "Pass --wef-source pointing at WEF_Future_of_Jobs_2025_skill_master_table.csv"
        )
    df = pd.read_csv(source)
    cleaned = clean_wef_frame(df)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_csv(output_path, index=False)
    return cleaned


def build_masco_rows() -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    for unit in UNIT_GROUPS:
        for letter, text in unit["tasks"]:
            row = {col: "" for col in MASCO_COLUMNS}
            for col in MASCO_COLUMNS:
                if col in ("task_letter", "task_text"):
                    continue
                if col in unit:
                    row[col] = str(unit[col])
            row["task_letter"] = letter
            row["task_text"] = text
            rows.append(row)
    return rows


def write_masco_csv(output_path: Path) -> list[dict[str, str]]:
    rows = build_masco_rows()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=MASCO_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
    return rows


def clean_ilo_frame(df: pd.DataFrame) -> pd.DataFrame:
    missing = [col for col in ILO_COLUMN_MAP if col not in df.columns]
    if missing:
        raise ValueError(f"Workbook is missing expected columns: {missing}")

    out = df[list(ILO_COLUMN_MAP.keys())].rename(columns=ILO_COLUMN_MAP)
    out["isco_08"] = out["isco_08"].astype("Int64").astype(str).str.zfill(4)
    out["task_id"] = out["task_id"].astype("Int64")
    out["task_text"] = out["task_text"].astype(str).str.strip()
    out["source_year"] = 2025
    out["source_dataset"] = "Gmyrek et al. 2025 ISCO-08 final scores"
    return out


def write_ilo_csv(source: Path, output_path: Path) -> pd.DataFrame:
    if not source.exists():
        raise FileNotFoundError(
            f"ILO workbook not found: {source}\n"
            "Pass --ilo-source pointing at Final_Scores_ISCO08_Gmyrek_et_al_2025.xlsx"
        )
    df = pd.read_excel(source, sheet_name=0)
    cleaned = clean_ilo_frame(df)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cleaned.to_csv(output_path, index=False)
    return cleaned


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Clean MASCO, ILO, and WEF source row tables to CSV."
    )
    parser.add_argument(
        "--ilo-source",
        type=Path,
        default=DEFAULT_ILO_SOURCE,
        help="Path to Final_Scores_ISCO08_Gmyrek_et_al_2025.xlsx",
    )
    parser.add_argument(
        "--wef-source",
        type=Path,
        default=DEFAULT_WEF_SOURCE,
        help="Path to WEF_Future_of_Jobs_2025_skill_master_table.csv",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=HERE,
        help="Folder for CSV outputs",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    out_dir = args.out_dir.expanduser().resolve()
    masco_path = out_dir / "masco_occupation_raw.csv"
    ilo_path = out_dir / "ilo_task_score_raw.csv"

    masco_rows = write_masco_csv(masco_path)
    masco_units = ", ".join(sorted({row["unit_code"] for row in masco_rows}))
    print(f"MASCO: {len(masco_rows)} rows, units {masco_units} -> {masco_path}")

    ilo = write_ilo_csv(args.ilo_source.expanduser().resolve(), ilo_path)
    print(
        f"ILO: {len(ilo)} rows, {ilo['isco_08'].nunique()} occupations -> {ilo_path}"
    )
    pilot = ilo[ilo["isco_08"].isin(["5221", "5222", "5223"])]
    counts = (
        pilot.groupby("isco_08").size().reindex(["5221", "5222", "5223"]).fillna(0).astype(int)
    )
    print(
        "ILO pilot task counts: "
        + ", ".join(f"{code}={n}" for code, n in counts.items())
    )

    wef_path = out_dir / "wef_skill_master_raw.csv"
    wef = write_wef_csv(args.wef_source.expanduser().resolve(), wef_path)
    print(f"WEF: {len(wef)} skills -> {wef_path}")
    print(
        "WEF groups: "
        + ", ".join(
            f"{name}={n}"
            for name, n in wef.groupby("wef_skill_group").size().sort_index().items()
        )
    )


if __name__ == "__main__":
    main()
