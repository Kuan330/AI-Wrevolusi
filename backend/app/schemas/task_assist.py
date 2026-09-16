from pydantic import BaseModel, Field


class TaskAssistRequest(BaseModel):
    task_text: str = Field(min_length=1, max_length=4000)
    user_message: str = Field(min_length=1, max_length=2000)
    notes: str = Field(default='', max_length=2000)


class TaskAssistResponse(BaseModel):
    reply: str = Field(min_length=1, max_length=4000)
