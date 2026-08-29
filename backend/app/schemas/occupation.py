import uuid

from pydantic import BaseModel, ConfigDict


class OccupationRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    masco_code: str
    title: str
    industry: str
    description: str | None = None


class OccupationCreate(BaseModel):
    masco_code: str
    title: str
    industry: str
    description: str | None = None
