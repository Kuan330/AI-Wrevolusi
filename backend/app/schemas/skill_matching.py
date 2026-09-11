from collections.abc import Mapping
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, field_validator


class SkillMatchCandidate(BaseModel):
    """A WEF skill the caller explicitly allows the matcher to select."""

    model_config = ConfigDict(extra="forbid")

    id: int
    skill: str = Field(min_length=1, max_length=256)

    @field_validator("skill")
    @classmethod
    def reject_blank_skill(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("skill must contain non-whitespace characters")
        return value


class SkillMatchRequest(BaseModel):
    """Task wording plus the complete candidate allowlist for this match."""

    model_config = ConfigDict(extra="forbid")

    task_text: str = Field(min_length=1, max_length=2000)
    candidates: list[SkillMatchCandidate] = Field(default_factory=list, max_length=100)

    @field_validator("task_text")
    @classmethod
    def reject_blank_task_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("task_text must contain non-whitespace characters")
        return value

    @field_validator("candidates")
    @classmethod
    def require_unique_candidate_ids(
        cls, candidates: list[SkillMatchCandidate]
    ) -> list[SkillMatchCandidate]:
        ids = [candidate.id for candidate in candidates]
        if len(ids) != len(set(ids)):
            raise ValueError("candidate IDs must be unique")
        return candidates


class SkillMatchItem(BaseModel):
    """One auditable skill match."""

    model_config = ConfigDict(extra="forbid")

    wef_skill_id: int
    confidence: float = Field(ge=0.0, le=1.0)
    evidence_phrases: list[str] = Field(default_factory=list, max_length=20)


class SkillMatchResponse(BaseModel):
    """Exact public response shape for skill matching."""

    model_config = ConfigDict(extra="forbid")

    skills: list[SkillMatchItem] = Field(default_factory=list, max_length=2)
    needs_user_confirmation: bool = Field(
        default=True,
        description=(
            'Always true: the result is a suggestion that the user must review '
            'and confirm before it is treated as part of their confirmed profile.'
        ),
    )


# Accept the common dictionary shape at the service seam while keeping the API
# request itself strictly validated by Pydantic.
def candidate_id(candidate: SkillMatchCandidate | Mapping[str, Any]) -> int:
    value = candidate["id"] if isinstance(candidate, Mapping) else candidate.id
    return int(value)
