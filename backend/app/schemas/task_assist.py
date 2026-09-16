from pydantic import BaseModel, ConfigDict, Field


class TaskAssistRequest(BaseModel):
    """One stateless question about the supplied workplace task context."""

    model_config = ConfigDict(str_strip_whitespace=True, extra='forbid')

    task_text: str = Field(min_length=1, max_length=4000)
    user_message: str = Field(min_length=1, max_length=2000)
    notes: str = Field(default='', max_length=2000)


class TaskAssistResponse(BaseModel):
    """A bounded reply plus transparent provenance and human-review status."""

    model_config = ConfigDict(extra='forbid')

    reply: str = Field(min_length=1, max_length=1200)
    generated_by_model: bool = False
    needs_user_confirmation: bool = True
