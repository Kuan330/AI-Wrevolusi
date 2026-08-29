import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict

from app.constants.exposure_types import ExposureType
from app.constants.task_status import TaskStatus


class TaskCreate(BaseModel):
    occupation_id: uuid.UUID | None = None
    title: str
    description: str | None = None
    status: TaskStatus = TaskStatus.needs_review
    context: dict[str, Any] | None = None


class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    status: TaskStatus | None = None
    context: dict[str, Any] | None = None
    exposure_type: ExposureType | None = None


class TaskRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    occupation_id: uuid.UUID | None
    title: str
    description: str | None
    status: TaskStatus
    exposure_type: ExposureType
    context: dict[str, Any] | None
