from __future__ import annotations

import json
from pathlib import Path

from app.core.config import settings
from app.skills.catalog import SkillCatalog, get_skill_catalog
from app.skills.schemas import SkillTaskInput


def _skills_block_path() -> Path:
    return settings.skill_data_dir / "prompts" / "prompt_v1.skills.md"


def _system_prompt_path() -> Path:
    return settings.skill_data_dir / "prompts" / "prompt_v1.system.md"


def load_system_prompt() -> str:
    return _system_prompt_path().read_text(encoding="utf-8").strip()


def load_skills_block() -> str:
    return _skills_block_path().read_text(encoding="utf-8").strip()


def build_task_payload(task: SkillTaskInput) -> dict[str, str]:
    return {
        "task_id": task.task_id,
        "task_title": task.task_title,
        "task_description": task.task_description or task.task_title,
        "occupation": task.occupation or "Unknown",
        "language": task.language,
        "country": task.country,
    }


def build_user_prompt(task: SkillTaskInput, catalog: SkillCatalog | None = None) -> str:
    _ = catalog or get_skill_catalog()
    payload = build_task_payload(task)
    return (
        "Classify the task below using the WEF skill handbook.\n\n"
        f"## Skill handbook\n{load_skills_block()}\n\n"
        "## Task input\n"
        f"{json.dumps(payload, ensure_ascii=False, indent=2)}\n\n"
        "## Required output JSON shape\n"
        "{\n"
        '  "task_id": "...",\n'
        f'  "model_version": "{settings.skill_llm_model}",\n'
        f'  "prompt_version": "{settings.skill_prompt_version}",\n'
        '  "taxonomy_version": "1.0",\n'
        '  "insufficient_context": false,\n'
        '  "predictions": [\n'
        "    {\n"
        '      "skill_id": "WEF-01",\n'
        '      "confidence": 0.92,\n'
        '      "evidence": "exact substring from task",\n'
        '      "reason": "short justification"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Return JSON only."
    )
