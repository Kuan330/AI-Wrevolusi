import uuid

from pydantic import BaseModel, ConfigDict, Field

from app.models.preparation import PriorityLevel


class PreparationCreate(BaseModel):
    title: str
    rationale: str
    effort_level: int = Field(ge=1, le=5, default=3)
    priority: PriorityLevel = PriorityLevel.medium


class PreparationUpdate(BaseModel):
    title: str | None = None
    rationale: str | None = None
    effort_level: int | None = Field(ge=1, le=5, default=None)
    priority: PriorityLevel | None = None


class PreparationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    title: str
    rationale: str
    effort_level: int
    priority: PriorityLevel
