import uuid
from typing import Any

from pydantic import BaseModel, ConfigDict, Field

from app.models.capability import CapabilityEvolution


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
