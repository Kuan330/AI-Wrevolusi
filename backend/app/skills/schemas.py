from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

WEF_SKILL_IDS = tuple(f"WEF-{index:02d}" for index in range(1, 27))
SkillConfidenceBand = Literal["identified", "possible"]


class SkillTaskInput(BaseModel):
    task_id: str
    task_title: str
    task_description: str = ""
    occupation: str = ""
    language: str = "en"
    country: str = "MY"


class LlmSkillPrediction(BaseModel):
    skill_id: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: str = Field(min_length=1)
    reason: str = Field(min_length=1)

    @field_validator("skill_id")
    @classmethod
    def validate_skill_id(cls, value: str) -> str:
        if value not in WEF_SKILL_IDS:
            raise ValueError(f"Unsupported skill_id: {value}")
        return value


class LlmSkillInferenceResult(BaseModel):
    task_id: str
    model_version: str
    prompt_version: str
    taxonomy_version: str = "1.0"
    predictions: list[LlmSkillPrediction] = Field(default_factory=list, max_length=3)
    insufficient_context: bool = False


class ValidatedSkillPrediction(BaseModel):
    skill_id: str
    wef_skill_id: int
    confidence: SkillConfidenceBand
    confidence_score: float
    evidence: str
    reason: str
    match_layer: str = "llm"


class ValidatedSkillInferenceResult(BaseModel):
    task_id: str
    insufficient_context: bool
    predictions: list[ValidatedSkillPrediction] = Field(default_factory=list)
    model_version: str
    prompt_version: str
    taxonomy_version: str = "1.0"
    llm_ready: bool = True
    reject_reason: str | None = None
