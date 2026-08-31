#!/usr/bin/env python3
"""Benchmark WEF skill inference against v1.4 evaluation set."""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
REPO_DIR = BACKEND_DIR.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings  # noqa: E402
from app.skills.catalog import load_catalog  # noqa: E402
from app.skills.providers.openrouter import OpenRouterSkillProvider  # noqa: E402
from app.skills.schemas import SkillTaskInput  # noqa: E402
from app.skills.service import SkillInferenceService  # noqa: E402
from app.skills.validation import evidence_is_valid, validate_inference  # noqa: E402

GATES = {
    "json_success_rate": 0.995,
    "evidence_validity": 0.980,
    "mean_recall_at_3": 0.900,
    "confusion_pair_accuracy": 0.800,
}


@dataclass
class TaskRun:
    task_id: str
    split: str
    success: bool
    insufficient_context: bool
    predictions: list[str]
    evidence_valid: bool
    error: str | None = None


def _load_eval(data_dir: Path) -> tuple[list[dict], list[dict]]:
    tasks = json.loads((data_dir / "eval" / "evaluation_tasks.json").read_text(encoding="utf-8"))
    labels = json.loads((data_dir / "eval" / "evaluation_labels.json").read_text(encoding="utf-8"))
    return tasks, labels


def _confusion_skill_ids(catalog) -> set[str]:
    ids: set[str] = set()
    for skill in catalog.skills.values():
        ids.add(skill.skill_id)
        for item in skill.confusions:
            other = item.get("confusable_skill_id")
            if other:
                ids.add(other)
    return ids


def _labels_by_task(labels: list[dict]) -> dict[str, list[dict]]:
    grouped: dict[str, list[dict]] = defaultdict(list)
    for row in labels:
        grouped[row["task_id"]].append(row)
    return grouped


def _recall_at_3(predicted: list[str], positives: set[str]) -> float | None:
    if not positives:
        return None
    hits = len(set(predicted[:3]) & positives)
    return hits / len(positives)


def run_benchmark(*, data_dir: Path, split: str, report_path: Path) -> dict:
    catalog = load_catalog(data_dir)
    tasks, labels = _load_eval(data_dir)
    if split.upper() != "ALL":
        tasks = [task for task in tasks if str(task.get("split", "")).upper() == split.upper()]
    labels_by_task = _labels_by_task(labels)
    confusion_skills = _confusion_skill_ids(catalog)

    provider = OpenRouterSkillProvider()
    service = SkillInferenceService(provider=provider)
    if not service.ready:
        raise SystemExit("SKILL_LLM_API_KEY is required for benchmark runs.")

    runs: list[TaskRun] = []
    recalls: list[float] = []
    confusion_total = 0
    confusion_correct = 0
    json_success = 0
    evidence_checks = 0
    evidence_valid_count = 0
    failures: list[dict] = []

    for task in tasks:
        task_id = task["task_id"]
        title = task["task_title"]
        description = task.get("task_description") or title
        try:
            llm_result = provider.infer_skills(
                SkillTaskInput(
                    task_id=task_id,
                    task_title=title,
                    task_description=description,
                    occupation=task.get("occupation") or "",
                    language=task.get("language") or "en",
                )
            )
            validated = validate_inference(
                llm_result,
                task_title=title,
                task_description=description,
                catalog=catalog,
            )
            json_success += 1
            predicted = [item.skill_id for item in validated.predictions]
            positives = {
                row["skill_id"]
                for row in labels_by_task[task_id]
                if int(row.get("final_label") or 0) == 1
            }
            recall = _recall_at_3(predicted, positives)
            if recall is not None and not task.get("final_insufficient_context"):
                recalls.append(recall)

            valid_evidence = True
            for prediction in validated.predictions:
                evidence_checks += 1
                if evidence_is_valid(prediction.evidence, title, description):
                    evidence_valid_count += 1
                else:
                    valid_evidence = False

            if task.get("split") == "POC":
                for row in labels_by_task[task_id]:
                    if row["skill_id"] not in confusion_skills:
                        continue
                    expected = int(row.get("final_label") or 0) == 1
                    predicted_positive = row["skill_id"] in predicted[:3]
                    confusion_total += 1
                    if expected == predicted_positive:
                        confusion_correct += 1

            runs.append(
                TaskRun(
                    task_id=task_id,
                    split=task.get("split") or "",
                    success=True,
                    insufficient_context=validated.insufficient_context,
                    predictions=predicted,
                    evidence_valid=valid_evidence,
                )
            )
            if recall is not None and recall < 1.0:
                failures.append(
                    {
                        "task_id": task_id,
                        "kind": "recall",
                        "expected": sorted(positives),
                        "predicted": predicted,
                        "recall_at_3": recall,
                    }
                )
        except Exception as exc:  # noqa: BLE001
            runs.append(
                TaskRun(
                    task_id=task_id,
                    split=task.get("split") or "",
                    success=False,
                    insufficient_context=False,
                    predictions=[],
                    evidence_valid=False,
                    error=str(exc),
                )
            )
            failures.append({"task_id": task_id, "kind": "json", "error": str(exc)})

    total = len(tasks)
    metrics = {
        "json_success_rate": json_success / total if total else 0.0,
        "evidence_validity": evidence_valid_count / evidence_checks if evidence_checks else 1.0,
        "mean_recall_at_3": sum(recalls) / len(recalls) if recalls else 0.0,
        "confusion_pair_accuracy": confusion_correct / confusion_total if confusion_total else 0.0,
        "task_count": total,
        "json_success_count": json_success,
        "evidence_checks": evidence_checks,
        "eligible_recall_tasks": len(recalls),
        "confusion_decisions": confusion_total,
    }
    gate_results = {
        name: {
            "value": metrics[name],
            "target": target,
            "passed": metrics[name] >= target,
        }
        for name, target in GATES.items()
    }
    report = {
        "generated_at": datetime.now(UTC).isoformat(),
        "model_version": provider.model_version,
        "prompt_version": settings.skill_prompt_version,
        "split": split,
        "metrics": metrics,
        "gates": gate_results,
        "passed": all(item["passed"] for item in gate_results.values()),
        "failures": failures[:100],
        "runs": [asdict(item) for item in runs],
    }
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description="Benchmark skill inference")
    parser.add_argument("--data-dir", type=Path, default=settings.skill_data_dir)
    parser.add_argument("--split", default="ALL", help="ALL or POC")
    parser.add_argument(
        "--report",
        type=Path,
        default=REPO_DIR / "data" / "skills" / "v1.4" / "benchmark_report.json",
    )
    args = parser.parse_args()
    report = run_benchmark(data_dir=args.data_dir, split=args.split, report_path=args.report)
    print(json.dumps({"metrics": report["metrics"], "passed": report["passed"]}, indent=2))
    if not report["passed"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
