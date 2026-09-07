from pydantic import BaseModel, ConfigDict, Field, field_validator


class TaskMatchCandidate(BaseModel):
    """One candidate task that the matcher is allowed to return."""

    model_config = ConfigDict(extra='forbid')

    id: str = Field(min_length=1, max_length=256)
    text: str = Field(min_length=1, max_length=2000)

    @field_validator('id', 'text')
    @classmethod
    def reject_blank_values(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('value must contain non-whitespace characters')
        return value


class TaskMatchRequest(BaseModel):
    """Input for matching a user-described task against supplied candidates."""

    model_config = ConfigDict(extra='forbid')

    occupation_code: str = Field(pattern=r'^\d{4}$')
    user_task: str = Field(min_length=1, max_length=2000)
    candidates: list[TaskMatchCandidate] = Field(default_factory=list, max_length=100)

    @field_validator('user_task')
    @classmethod
    def reject_blank_task(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('user_task must contain non-whitespace characters')
        return value

    @field_validator('candidates')
    @classmethod
    def require_unique_candidate_ids(
        cls,
        candidates: list[TaskMatchCandidate],
    ) -> list[TaskMatchCandidate]:
        ids = [candidate.id for candidate in candidates]
        if len(ids) != len(set(ids)):
            raise ValueError('candidate IDs must be unique')
        return candidates


class TaskMatchResponse(BaseModel):
    """Structured, provider-independent task matching output."""

    model_config = ConfigDict(extra='forbid')

    candidate_id: str = Field(default='', max_length=256)
    confidence: float = Field(ge=0.0, le=1.0)
    matched_concepts: list[str] = Field(default_factory=list, max_length=50)
    unmatched_concepts: list[str] = Field(default_factory=list, max_length=50)
    reason: str = Field(min_length=1, max_length=2000)
    clarifying_question: str | None = Field(default=None, max_length=1000)


# Explicit aliases keep the contract convenient for callers that distinguish
# request candidates from response objects.
TaskMatchCandidateRequest = TaskMatchCandidate
TaskMatchInput = TaskMatchRequest
TaskMatchOutput = TaskMatchResponse


__all__ = [
    'TaskMatchCandidate',
    'TaskMatchCandidateRequest',
    'TaskMatchInput',
    'TaskMatchRequest',
    'TaskMatchOutput',
    'TaskMatchResponse',
]
