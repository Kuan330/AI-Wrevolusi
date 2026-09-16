from __future__ import annotations

from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StrictInt, field_validator

SkillState = Literal['have', 'learning', 'shortlisted', 'missing']
PositiveStrictInt = Annotated[StrictInt, Field(gt=0)]


class PossibilitiesSchema(BaseModel):
    model_config = ConfigDict(extra='forbid')


class CurrentRole(PossibilitiesSchema):
    occupation_code: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=300)


class PossibilitySkill(PossibilitiesSchema):
    skill_id: int = Field(gt=0)
    skill_slug: str = Field(min_length=1, max_length=120, pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$')
    name: str = Field(min_length=1, max_length=120)
    state: SkillState

    @field_validator('skill_slug')
    @classmethod
    def reject_demo_identifiers(cls, value: str) -> str:
        if value.startswith('demo-'):
            raise ValueError('demo skill identifiers are not valid live data')
        return value


class PossibilityDirection(PossibilitiesSchema):
    occupation_code: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=300)
    area: str | None = Field(default=None, max_length=200)
    description: str = Field(default='', max_length=5000)
    coverage_pct: int | None = Field(default=None, ge=0, le=100)
    skills: list[PossibilitySkill] = Field(default_factory=list, max_length=60)


class PossibilitiesResponse(PossibilitiesSchema):
    contract_version: Literal['1'] = '1'
    score_semantics: Literal['direction_skill_coverage'] = 'direction_skill_coverage'
    disclaimer: str = Field(min_length=1, max_length=500)
    source: Literal['live', 'demo']
    status: Literal['ready', 'needs_profile', 'unavailable']
    current_role: CurrentRole | None = None
    current_role_coverage_pct: int | None = Field(default=None, ge=0, le=100)
    skills: list[PossibilitySkill] = Field(default_factory=list, max_length=60)
    directions: list[PossibilityDirection] = Field(default_factory=list, max_length=20)
    chosen_direction_code: str | None = Field(default=None, max_length=100)
    chosen_direction_coverage_pct: float | None = Field(default=None, ge=0, le=100)
    shortlisted_skill_ids: list[PositiveStrictInt] = Field(default_factory=list, max_length=60)


class PossibilityPreferenceRequest(PossibilitiesSchema):
    chosen_direction_code: str | None = Field(default=None, max_length=100)


class PossibilityShortlistRequest(PossibilitiesSchema):
    skill_ids: list[PositiveStrictInt] = Field(default_factory=list, max_length=60)


__all__ = [
    'CurrentRole',
    'PossibilitiesResponse',
    'PossibilityDirection',
    'PossibilityPreferenceRequest',
    'PossibilityShortlistRequest',
    'PossibilitySkill',
    'SkillState',
]
