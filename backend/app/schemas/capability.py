import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.models.capability import CapabilityEvolution
from app.constants.exposure_types import ExposureType


class CapabilityCreate(BaseModel):
    name: str
    description: str | None = None
    evolution: CapabilityEvolution
    task_ids: list[uuid.UUID] = Field(default_factory=list)
    evidence: list[dict[str, Any]] | None = None


class CapabilityUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    evolution: CapabilityEvolution | None = None
    task_ids: list[uuid.UUID] | None = None
    evidence: list[dict[str, Any]] | None = None


class CapabilityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    name: str
    description: str | None
    evolution: CapabilityEvolution
    evidence: list[dict[str, Any]] | None


class ConfirmedTaskCapabilityRecognitionRequestItem(BaseModel):
    task_id: str = Field(min_length=1, max_length=128)
    task_text: str = Field(min_length=3, max_length=1000)
    exposure_state: ExposureType | None = None


class ConfirmedTaskCapabilityRecognitionBatchRequest(BaseModel):
    confirmed_tasks: list[ConfirmedTaskCapabilityRecognitionRequestItem] = Field(
        min_length=1,
        max_length=50,
    )


class CapabilityRecognitionTaskEvidence(BaseModel):
    task_id: str
    task_text: str
    exposure_state: ExposureType | None
    similarity: float


class RecognizedWefCapability(BaseModel):
    wef_skill_id: int
    core_skill: str
    wef_skill_group: str | None
    suggested_evolution: CapabilityEvolution | None
    strongest_similarity: float
    model_version: str
    model_type: str
    source_name: str
    source_year: str
    reasoning: str
    uncertainty: str
    limitations: str
    confirmation_status: Literal['requires_user_confirmation']
    task_evidence: list[CapabilityRecognitionTaskEvidence]


class ConfirmedTaskCapabilityRecognitionBatchResponse(BaseModel):
    capabilities: list[RecognizedWefCapability]
    unmatched_task_ids: list[str]
