import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict


class ScheduleCreate(BaseModel):
    preparation_id: uuid.UUID
    planned_for: date
    note: str | None = None


class ScheduleUpdate(BaseModel):
    is_done: bool | None = None
    note: str | None = None


class ScheduleRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    user_id: uuid.UUID
    preparation_id: uuid.UUID
    planned_for: date
    is_done: bool
    note: str | None
