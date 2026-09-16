import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


TaskAssistStatus = Literal['available', 'pending', 'completed']


class TaskAssistDetailInput(BaseModel):
    """One account-scoped task detail registered before assistance is requested."""

    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')

    profile_task_id: str = Field(min_length=1, max_length=128)
    task_text: str = Field(min_length=1, max_length=4000)
    notes: str = Field(default='', max_length=2000)


class TaskAssistDetailBatchRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')

    details: list[TaskAssistDetailInput] = Field(min_length=1, max_length=50)


class TaskAssistRequest(BaseModel):
    """The one allowed question for a previously registered task detail."""

    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')

    task_id: uuid.UUID
    user_message: str = Field(min_length=1, max_length=2000)


class TaskAssistResponse(BaseModel):
    """A bounded model/fallback reply before it is persisted."""

    model_config = ConfigDict(extra='forbid')

    reply: str = Field(min_length=1, max_length=1200)
    generated_by_model: bool = False
    needs_user_confirmation: bool = True


class TaskAssistInteractionRead(BaseModel):
    """The permanent one-question/one-answer state for one task detail."""

    model_config = ConfigDict(extra='forbid')

    task_id: uuid.UUID
    status: TaskAssistStatus
    question: str | None = None
    reply: str | None = None
    generated_by_model: bool | None = None
    needs_user_confirmation: bool = True
    completed_at: datetime | None = None


class TaskAssistDetailBatchResponse(BaseModel):
    model_config = ConfigDict(extra='forbid')

    items: list[TaskAssistInteractionRead]
