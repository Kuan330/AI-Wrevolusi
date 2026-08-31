#!/usr/bin/env python3
"""Export WEF_skill_inference_review workbook v1.4 into data/skills/v1.4/."""

from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUT = REPO_ROOT / "data" / "skills" / "v1.4"
DEFAULT_WORKBOOK = Path.home() / "Downloads" / "WEF_skill_inference_review_v1_4.xlsm"

PROMPT_VERSION = "skill-inference-prompt-v1"
TAXONOMY_VERSION = "1.0"
PROFILE_VERSION = "1.2"


def _clean(value: object) -> str | None:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    text = str(value).strip()
    return text or None


def _split_aliases(value: object) -> list[str]:
    text = _clean(value)
    if not text:
        return []
    return [part.strip() for part in re.split(r"[;]", text) if part.strip()]


def _wef_num(skill_id: str) -> int:
    match = re.match(r"WEF-(\d+)", skill_id)
    if not match:
        raise ValueError(f"Invalid skill id: {skill_id}")
    return int(match.group(1))


def _extract_json_schema(df: pd.DataFrame, document: str) -> dict:
    lines = df.loc[df["Document"] == document, "JSON"].dropna().astype(str).tolist()
    return json.loads("\n".join(lines))


def _select_examples(examples: pd.DataFrame, skill_id: str, limit: int = 3) -> list[dict]:
    rows = examples[
        (examples["Skill ID"] == skill_id)
        & (examples["Review Status"].astype(str).str.lower() == "approved")
    ]
    picked: list[dict] = []
    for example_type in ("Positive", "Negative"):
        subset = rows[rows["Example Type"] == example_type]
        for _, row in subset.head(1 if example_type == "Negative" else 2).iterrows():
            picked.append(
                {
                    "example_id": _clean(row.get("Example ID")),
                    "type": example_type.lower(),
                    "language": _clean(row.get("Language")),
                    "task_text": _clean(row.get("Task Text")),
                    "evidence": _clean(row.get("Evidence")),
                    "reason": _clean(row.get("Reason")),
                }
            )
        if len(picked) >= limit:
            break
    return picked[:limit]


def export_workbook(workbook: Path, out_dir: Path, generate_prompt: bool) -> None:
    xl = pd.ExcelFile(workbook, engine="openpyxl")
    catalog = pd.read_excel(xl, sheet_name="Skill Catalog")
    profiles = pd.read_excel(xl, sheet_name="Skill Profiles")
    rules = pd.read_excel(xl, sheet_name="Skill Rules")
    confusions = pd.read_excel(xl, sheet_name="Skill Confusions")
    examples = pd.read_excel(xl, sheet_name="Task Examples")
    eval_tasks = pd.read_excel(xl, sheet_name="Evaluation Tasks")
    eval_labels = pd.read_excel(xl, sheet_name="Evaluation Labels")
    schema_df = pd.read_excel(xl, sheet_name="JSON Schemas")

    skills_dir = out_dir / "skills"
    schemas_dir = out_dir / "schemas"
    eval_dir = out_dir / "eval"
    prompts_dir = out_dir / "prompts"
    for path in (skills_dir, schemas_dir, eval_dir, prompts_dir):
        path.mkdir(parents=True, exist_ok=True)

    skill_ids = [str(row["Skill ID"]) for _, row in catalog.sort_values("Skill ID").iterrows()]
    skill_records: list[dict] = []

    profiles_by_id = {row["Skill ID"]: row for _, row in profiles.iterrows()}
    rules_by_id = {row["Skill ID"]: row for _, row in rules.iterrows()}

    for skill_id in skill_ids:
        profile = profiles_by_id[skill_id]
        rule = rules_by_id[skill_id]
        cat_row = catalog[catalog["Skill ID"] == skill_id].iloc[0]
        confusion_rows = confusions[confusions["Skill ID"] == skill_id]
        record = {
            "skill_id": skill_id,
            "wef_skill_id": _wef_num(skill_id),
            "name_en": _clean(cat_row.get("Name EN")),
            "name_ms": _clean(cat_row.get("Name MS")),
            "skill_group": _clean(cat_row.get("Skill Group")),
            "taxonomy_version": TAXONOMY_VERSION,
            "profile_version": PROFILE_VERSION,
            "enabled": bool(cat_row.get("Enabled", True)),
            "status": _clean(cat_row.get("Status")) or "active",
            "definition_en": _clean(profile.get("Definition EN")),
            "definition_ms": _clean(profile.get("Definition MS")),
            "typical_tasks_en": _clean(profile.get("Typical Tasks EN")),
            "typical_tasks_ms": _clean(profile.get("Typical Tasks MS")),
            "aliases_en": _split_aliases(profile.get("English Aliases")),
            "aliases_ms": _split_aliases(profile.get("Malay Aliases")),
            "manglish_aliases": _split_aliases(profile.get("Manglish / Mixed Expressions")),
            "inclusion_rules": _clean(rule.get("Inclusion Rules")),
            "exclusion_rules": _clean(rule.get("Exclusion Rules")),
            "insufficient_context_rule": _clean(rule.get("Insufficient Context Rule")),
            "confusions": [
                {
                    "confusable_skill_id": _clean(row.get("Confusable Skill ID")),
                    "confusable_skill_name": _clean(row.get("Confusable Skill")),
                    "boundary_rule": _clean(row.get("Boundary Rule")),
                    "example_task": _clean(row.get("Example Task")),
                    "expected_labels": _clean(row.get("Expected Label(s)")),
                }
                for _, row in confusion_rows.iterrows()
            ],
            "examples": _select_examples(examples, skill_id),
        }
        skill_records.append(record)
        (skills_dir / f"{skill_id}.json").write_text(
            json.dumps(record, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

    manifest = {
        "workbook_version": "1.4",
        "taxonomy_version": TAXONOMY_VERSION,
        "profile_version": PROFILE_VERSION,
        "prompt_version": PROMPT_VERSION,
        "skill_ids": skill_ids,
        "skill_count": len(skill_ids),
    }
    (out_dir / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")

    input_schema = _extract_json_schema(schema_df, "Input JSON Schema")
    output_schema = _extract_json_schema(schema_df, "Output JSON Schema")
    (schemas_dir / "input.schema.json").write_text(json.dumps(input_schema, indent=2) + "\n", encoding="utf-8")
    (schemas_dir / "output.schema.json").write_text(json.dumps(output_schema, indent=2) + "\n", encoding="utf-8")

    tasks_payload = []
    for _, row in eval_tasks.iterrows():
        if _clean(row.get("Review Status")) != "Approved":
            continue
        tasks_payload.append(
            {
                "task_id": _clean(row.get("Task ID")),
                "split": _clean(row.get("Split")),
                "language": _clean(row.get("Language")),
                "task_title": _clean(row.get("Task Title")),
                "task_description": _clean(row.get("Task Description")),
                "occupation": _clean(row.get("Occupation")),
                "country": _clean(row.get("Country")) or "MY",
                "final_insufficient_context": bool(row.get("Final Insufficient Context")),
            }
        )
    (eval_dir / "evaluation_tasks.json").write_text(
        json.dumps(tasks_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    labels_payload = []
    for _, row in eval_labels.iterrows():
        labels_payload.append(
            {
                "task_id": _clean(row.get("Task ID")),
                "skill_id": _clean(row.get("Skill ID")),
                "skill_name_en": _clean(row.get("Skill Name EN")),
                "final_label": int(row.get("Final Label") or 0),
                "final_evidence": _clean(row.get("Final Evidence")),
                "adjudication_status": _clean(row.get("Adjudication Status")),
            }
        )
    (eval_dir / "evaluation_labels.json").write_text(
        json.dumps(labels_payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    system_prompt = """You are a task-to-skill classifier for Malaysian working women using the WEF 2025 core skills taxonomy.

Hard rules:
- Use only skill IDs WEF-01 through WEF-26 from the provided skill handbook.
- Return at most 3 predictions.
- Every prediction must include evidence copied as an exact substring from the task title or description. Do not paraphrase evidence.
- If the task is too vague to infer skills, set insufficient_context to true and return an empty predictions array.
- Occupation is auxiliary context only. Never infer a skill from occupation alone.
- Do not translate the task before inference. Preserve English, Malay, mixed, or local wording.
- Do not invent skills outside the handbook.
- Return valid JSON only, matching the output schema.
"""
    (prompts_dir / "prompt_v1.system.md").write_text(system_prompt.strip() + "\n", encoding="utf-8")

    if generate_prompt:
        blocks: list[str] = ["# WEF Skill Handbook v1.4", ""]
        for record in skill_records:
            blocks.extend(
                [
                    f"## {record['skill_id']} | {record['name_en']}",
                    f"Definition: {record['definition_en']}",
                    f"Inclusion: {record['inclusion_rules']}",
                    f"Exclusion: {record['exclusion_rules']}",
                    f"Insufficient context: {record['insufficient_context_rule']}",
                ]
            )
            if record["confusions"]:
                blocks.append("Confusions:")
                for item in record["confusions"][:2]:
                    blocks.append(
                        f"- vs {item['confusable_skill_id']}: {item['boundary_rule']}"
                    )
            if record["examples"]:
                blocks.append("Examples:")
                for item in record["examples"]:
                    blocks.append(f"- [{item['type']}] {item['task_text']}")
            blocks.append("")
        (prompts_dir / "prompt_v1.skills.md").write_text("\n".join(blocks).strip() + "\n", encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description="Export WEF skill inference workbook v1.4")
    parser.add_argument("--workbook", type=Path, default=DEFAULT_WORKBOOK)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--generate-prompt", action="store_true", default=True)
    args = parser.parse_args()
    if not args.workbook.is_file():
        raise SystemExit(f"Workbook not found: {args.workbook}")
    export_workbook(args.workbook, args.out_dir, generate_prompt=args.generate_prompt)
    print(f"Exported skill assets to {args.out_dir}")


if __name__ == "__main__":
    main()
