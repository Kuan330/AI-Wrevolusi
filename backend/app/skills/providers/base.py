from __future__ import annotations

from abc import ABC, abstractmethod

from app.skills.schemas import LlmSkillInferenceResult, SkillTaskInput


class SkillInferenceProvider(ABC):
    @property
    @abstractmethod
    def model_version(self) -> str:
        raise NotImplementedError

    @property
    @abstractmethod
    def ready(self) -> bool:
        raise NotImplementedError

    @abstractmethod
    def infer_skills(self, task: SkillTaskInput) -> LlmSkillInferenceResult:
        raise NotImplementedError
