from __future__ import annotations

import json
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Any

from app.core.config import settings


@dataclass(frozen=True)
class SkillRecord:
    skill_id: str
    wef_skill_id: int
    name_en: str
    name_ms: str | None
    skill_group: str | None
    definition_en: str | None
    inclusion_rules: str | None
    exclusion_rules: str | None
    insufficient_context_rule: str | None
    confusions: list[dict[str, Any]]
    examples: list[dict[str, Any]]


@dataclass(frozen=True)
class SkillCatalog:
    manifest: dict[str, Any]
    skills: dict[str, SkillRecord]
    skill_ids: list[str]

    def get(self, skill_id: str) -> SkillRecord | None:
        return self.skills.get(skill_id)


def _parse_skill(payload: dict[str, Any]) -> SkillRecord:
    return SkillRecord(
        skill_id=str(payload["skill_id"]),
        wef_skill_id=int(payload["wef_skill_id"]),
        name_en=str(payload.get("name_en") or ""),
        name_ms=payload.get("name_ms"),
        skill_group=payload.get("skill_group"),
        definition_en=payload.get("definition_en"),
        inclusion_rules=payload.get("inclusion_rules"),
        exclusion_rules=payload.get("exclusion_rules"),
        insufficient_context_rule=payload.get("insufficient_context_rule"),
        confusions=list(payload.get("confusions") or []),
        examples=list(payload.get("examples") or []),
    )


def load_catalog(data_dir: Path | None = None) -> SkillCatalog:
    root = data_dir or settings.skill_data_dir
    manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    skills_dir = root / "skills"
    skills: dict[str, SkillRecord] = {}
    skill_ids: list[str] = list(manifest.get("skill_ids") or [])
    for skill_id in skill_ids:
        payload = json.loads((skills_dir / f"{skill_id}.json").read_text(encoding="utf-8"))
        skills[skill_id] = _parse_skill(payload)
    return SkillCatalog(manifest=manifest, skills=skills, skill_ids=skill_ids)


@lru_cache
def get_skill_catalog() -> SkillCatalog:
    return load_catalog()
