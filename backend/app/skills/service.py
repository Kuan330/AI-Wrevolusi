from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache

from app.core.config import settings
from app.skills.catalog import get_skill_catalog
from app.skills.providers.base import SkillInferenceProvider
from app.skills.providers.openrouter import get_openrouter_skill_provider
from app.skills.schemas import SkillTaskInput, ValidatedSkillInferenceResult
from app.skills.validation import service_unavailable, validate_inference


class SkillInferenceService:
    def __init__(self, provider: SkillInferenceProvider | None = None) -> None:
        self._provider = provider or get_openrouter_skill_provider()
        self._catalog = get_skill_catalog()

    @property
    def ready(self) -> bool:
        return self._provider.ready

    @property
    def model_version(self) -> str:
        return self._provider.model_version

    @property
    def prompt_version(self) -> str:
        return settings.skill_prompt_version

    def infer_one(self, task: SkillTaskInput) -> ValidatedSkillInferenceResult:
        if not self.ready:
            return service_unavailable(
                task.task_id,
                model_version=self.model_version,
                prompt_version=self.prompt_version,
            )
        try:
            llm_result = self._provider.infer_skills(task)
            return validate_inference(
                llm_result,
                task_title=task.task_title,
                task_description=task.task_description,
                catalog=self._catalog,
            )
        except Exception:
            return service_unavailable(
                task.task_id,
                model_version=self.model_version,
                prompt_version=self.prompt_version,
            )

    def infer_batch(self, tasks: list[SkillTaskInput]) -> list[ValidatedSkillInferenceResult]:
        if not tasks:
            return []
        workers = min(len(tasks), 4)
        with ThreadPoolExecutor(max_workers=workers) as pool:
            return list(pool.map(self.infer_one, tasks))


@lru_cache
def get_skill_inference_service() -> SkillInferenceService:
    return SkillInferenceService()
