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


class OpenRouterSkillProvider(SkillInferenceProvider):
    def __init__(self) -> None:
        self._client = httpx.Client(
            base_url=settings.skill_llm_base_url.rstrip("/"),
            timeout=settings.skill_request_timeout_s,
            headers=self._headers(),
        )

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if settings.skill_llm_api_key:
            headers["Authorization"] = f"Bearer {settings.skill_llm_api_key}"
        if settings.skill_llm_app_url:
            headers["HTTP-Referer"] = settings.skill_llm_app_url
        if settings.skill_llm_app_name:
            headers["X-Title"] = settings.skill_llm_app_name
        return headers

    @property
    def model_version(self) -> str:
        return settings.skill_llm_model

    @property
    def ready(self) -> bool:
        return bool(settings.skill_llm_api_key)

    def infer_skills(self, task: SkillTaskInput) -> LlmSkillInferenceResult:
        if not self.ready:
            raise RuntimeError("OpenRouter provider is not configured.")

        body = {
            "model": settings.skill_llm_model,
            "messages": [
                {"role": "system", "content": load_system_prompt()},
                {"role": "user", "content": build_user_prompt(task)},
            ],
            "temperature": 0.0,
        }
        last_error: Exception | None = None
        for _attempt in range(settings.skill_max_retries + 1):
            try:
                response = self._client.post("/chat/completions", json=body)
                response.raise_for_status()
                payload = response.json()
                content = payload["choices"][0]["message"]["content"]
                if not content:
                    raise ValueError("OpenRouter returned empty content.")
                parsed = _extract_json(content)
                parsed.setdefault("task_id", task.task_id)
                parsed.setdefault("model_version", self.model_version)
                parsed.setdefault("prompt_version", settings.skill_prompt_version)
                parsed.setdefault("taxonomy_version", "1.0")
                return LlmSkillInferenceResult.model_validate(parsed)
            except (httpx.HTTPError, KeyError, json.JSONDecodeError, ValidationError, ValueError) as exc:
                last_error = exc
        raise RuntimeError("OpenRouter skill inference failed.") from last_error


@lru_cache
def get_openrouter_skill_provider() -> OpenRouterSkillProvider:
    return OpenRouterSkillProvider()
