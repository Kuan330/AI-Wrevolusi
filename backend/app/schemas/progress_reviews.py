import uuid
from pydantic import BaseModel, ConfigDict, Field, field_validator


class CreateProgressReview(BaseModel):
    model_config = ConfigDict(extra='forbid')
    request_id: uuid.UUID
    expected_workspace_revision: int = Field(ge=0)
    expected_previous_review_id: uuid.UUID | None
    reset_goal_ids: list[str] = Field(default_factory=list, max_length=100)

    @field_validator('reset_goal_ids')
    @classmethod
    def unique_goals(cls, value):
        if any(not item.strip() or len(item)>100 for item in value) or len(set(value)) != len(value):
            raise ValueError('Choose each goal needing a new starting point once.')
        return value
