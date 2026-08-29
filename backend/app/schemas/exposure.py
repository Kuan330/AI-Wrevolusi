import uuid

from pydantic import BaseModel

from app.constants.exposure_types import ExposureType


class ExposureResult(BaseModel):
    task_id: uuid.UUID
    exposure_type: ExposureType
    reason: str
    confidence: float
