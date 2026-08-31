from __future__ import annotations

import json
import re
from functools import lru_cache

import httpx
from pydantic import ValidationError

from app.core.config import settings
from app.skills.prompt import build_user_prompt, load_system_prompt
from app.skills.providers.base import SkillInferenceProvider
from app.skills.schemas import LlmSkillInferenceResult, SkillTaskInput


def _extract_json(text: str) -> dict:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)
    return json.loads(stripped)


class QwenSkillProvider(SkillInferenceProvider):
    def __init__(self) -> None:
        self._client = httpx.Client(
            base_url=settings.qwen_base_url.rstrip("/"),
            timeout=settings.skill_request_timeout_s,
            headers={"Authorization": f"Bearer {settings.qwen_api_key}"} if settings.qwen_api_key else {},
        )

    @property
    def model_version(self) -> str:
        return settings.qwen_model

    @property
    def ready(self) -> bool:
        return bool(settings.qwen_api_key)

    def infer_skills(self, task: SkillTaskInput) -> LlmSkillInferenceResult:
        if not self.ready:
            raise RuntimeError("Qwen provider is not configured.")

        body = {
            "model": settings.qwen_model,
            "messages": [
                {"role": "system", "content": load_system_prompt()},
                {"role": "user", "content": build_user_prompt(task)},
            ],
            "response_format": {"type": "json_object"},
            "temperature": 0.0,
        }
        last_error: Exception | None = None
        for _attempt in range(settings.skill_max_retries + 1):
            try:
                response = self._client.post("/chat/completions", json=body)
                response.raise_for_status()
                payload = response.json()
                content = payload["choices"][0]["message"]["content"]
                parsed = _extract_json(content)
                parsed.setdefault("task_id", task.task_id)
                parsed.setdefault("model_version", self.model_version)
                parsed.setdefault("prompt_version", settings.skill_prompt_version)
                parsed.setdefault("taxonomy_version", "1.0")
                return LlmSkillInferenceResult.model_validate(parsed)
            except (httpx.HTTPError, KeyError, json.JSONDecodeError, ValidationError) as exc:
                last_error = exc
        raise RuntimeError("Qwen skill inference failed.") from last_error


@lru_cache
def get_qwen_skill_provider() -> QwenSkillProvider:
    return QwenSkillProvider()
