import uuid
from typing import Literal

from pydantic import BaseModel, Field

from app.constants.exposure_types import ExposureType


class ExposureResult(BaseModel):
    task_id: uuid.UUID
    exposure_type: ExposureType
    reason: str
    confidence: float


TaskAssessmentContextLevel = Literal['low', 'medium', 'high']
TaskAssessmentMatchLayer = Literal['exact', 'nlp', 'insufficient_data']
TaskAssessmentMissingDataStatus = Literal[
    'complete',
    'partial_context',
    'no_reliable_match',
    'missing_reference_tasks',
]


class ConfirmedTaskAssessmentContextInput(BaseModel):
    routine_processing_level: TaskAssessmentContextLevel | None = None
    information_use_level: TaskAssessmentContextLevel | None = None
    human_interaction_level: TaskAssessmentContextLevel | None = None
    judgement_level: TaskAssessmentContextLevel | None = None
    responsibility_level: Literal['individual', 'shared', 'lead'] | None = None
    time_spent: str | None = None


class ConfirmedTaskExposureAssessmentRequestItem(BaseModel):
    task_id: str = Field(min_length=1, max_length=128)
    task_text: str = Field(min_length=3, max_length=1000)
    ilo_task_id: str | None = None
    context: ConfirmedTaskAssessmentContextInput = Field(
        default_factory=ConfirmedTaskAssessmentContextInput
    )


class ConfirmedTaskExposureAssessmentBatchRequest(BaseModel):
    occupation_code: str = Field(pattern=r'^\d{4}$')
    confirmed_tasks: list[ConfirmedTaskExposureAssessmentRequestItem] = Field(
        min_length=1,
        max_length=50,
    )


class MatchedIloTaskExposureEvidence(BaseModel):
    ilo_task_id: str
    task_text: str
    score_2025: float
    similarity: float
    source_method: str | None = None


class ConfirmedTaskExposureAssessment(BaseModel):
    task_id: str
    suggested_state: ExposureType
    potential25: str | None
    match_layer: TaskAssessmentMatchLayer
    baseline_score: float | None
    adjusted_score: float | None
    confidence: float
    source_name: str
    source_year: str
    source_url: str
    reasoning: str
    uncertainty: str
    limitations: str
    missing_data_status: TaskAssessmentMissingDataStatus
    matched_reference_tasks: list[MatchedIloTaskExposureEvidence]


class ConfirmedTaskExposureAssessmentBatchResponse(BaseModel):
    assessments: list[ConfirmedTaskExposureAssessment]
