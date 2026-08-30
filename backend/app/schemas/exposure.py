from __future__ import annotations

import uuid
from typing import List, Optional

from pydantic import BaseModel, Field

from app.constants.exposure_types import ExposureType


class ExposureResult(BaseModel):
    task_id: uuid.UUID
    exposure_type: ExposureType
    reason: str
    confidence: float


class ExposureEstimateTask(BaseModel):
    client_task_id: str
    task_text: str
    original_task_text: Optional[str] = None


class ExposureEstimateRequest(BaseModel):
    occupation_code: str
    tasks: List[ExposureEstimateTask] = Field(min_length=1)


class ExposureNeighbor(BaseModel):
    isco_08: str
    task_id: str
    task_text: str
    score_2025: float
    similarity: float


class ExposureEstimateItem(BaseModel):
    client_task_id: str
    score_2025: Optional[float]
    band: str
    match_layer: str
    score_source: str
    reject_reason: Optional[str] = None
    neighbors: List[ExposureNeighbor] = Field(default_factory=list)


class ExposureEstimateResponse(BaseModel):
    embedding_model: str
    taxonomy_version: str = '1.0'
    nlp_ready: bool
    results: List[ExposureEstimateItem]
