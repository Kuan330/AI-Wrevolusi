from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field


class SkillEstimateTask(BaseModel):
    client_task_id: str
    task_title: str
    task_description: Optional[str] = None
    occupation: Optional[str] = None
    language: Optional[str] = "en"


class SkillEstimateRequest(BaseModel):
    tasks: List[SkillEstimateTask] = Field(min_length=1)


class SkillPredictionItem(BaseModel):
    skill_id: str
    wef_skill_id: int
    confidence: Literal["identified", "possible"]
    confidence_score: float
    evidence: str
    reason: str
    match_layer: str = "llm"


class SkillEstimateItem(BaseModel):
    client_task_id: str
    insufficient_context: bool
    predictions: List[SkillPredictionItem] = Field(default_factory=list)
    reject_reason: Optional[str] = None


class SkillEstimateResponse(BaseModel):
    model_version: str
    prompt_version: str
    taxonomy_version: str = "1.0"
    llm_ready: bool
    results: List[SkillEstimateItem]
