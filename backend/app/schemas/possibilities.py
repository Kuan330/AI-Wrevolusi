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


class CareerSkill(PossibilitiesSchema):
    uri: str = Field(min_length=1, max_length=200)
    label: str = Field(min_length=1, max_length=300)
    relation: Literal['essential', 'optional']
    state: Literal['current', 'developing', 'not_yet_evidenced']


class ReviewedCareerSkill(PossibilitiesSchema):
    uri: str = Field(min_length=1, max_length=200)
    label: str = Field(min_length=1, max_length=300)
    state: Literal['current', 'developing']


class CareerSource(PossibilitiesSchema):
    name: Literal['ESCO'] = 'ESCO'
    version: str = Field(min_length=1, max_length=40)
    retrieved_at: str = Field(min_length=1, max_length=40)
    occupation_uri: str = Field(min_length=1, max_length=200)
    source_url: str = Field(min_length=1, max_length=500)
    attribution: str = Field(min_length=1, max_length=1000)


class PossibilityDirection(PossibilitiesSchema):
    occupation_code: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=300)
    area: str | None = Field(default=None, max_length=200)
    description: str = Field(default='', max_length=5000)
    coverage_pct: int | None = Field(default=None, ge=0, le=100)
    skills: list[PossibilitySkill] = Field(default_factory=list, max_length=60)
    occupation_uri: str | None = Field(default=None, max_length=200)
    requirements: list[CareerSkill] = Field(default_factory=list, max_length=200)
    source: CareerSource | None = None
    current_skill_overlap: int = Field(default=0, ge=0)
    developing_skill_overlap: int = Field(default=0, ge=0)
    essential_not_yet_evidenced: int = Field(default=0, ge=0)


class PossibilitiesResponse(PossibilitiesSchema):
    contract_version: Literal['2'] = '2'
    score_semantics: Literal['direction_skill_coverage', 'reviewed_source_skill_overlap', 'current_and_developing_wef_overlap'] = 'current_and_developing_wef_overlap'
    disclaimer: str = Field(min_length=1, max_length=500)
    source: Literal['live', 'demo']
    status: Literal['ready', 'needs_profile', 'needs_skill_review', 'unavailable']
    current_role: CurrentRole | None = None
    current_role_coverage_pct: int | None = Field(default=None, ge=0, le=100)
    skills: list[PossibilitySkill] = Field(default_factory=list, max_length=60)
    directions: list[PossibilityDirection] = Field(default_factory=list, max_length=20)
    chosen_direction_code: str | None = Field(default=None, max_length=100)
    chosen_direction_uri: str | None = Field(default=None, max_length=200)
    chosen_direction_coverage_pct: float | None = Field(default=None, ge=0, le=100)
    shortlisted_skill_ids: list[PositiveStrictInt] = Field(default_factory=list, max_length=60)
    reviewed_esco_skills: list[ReviewedCareerSkill] = Field(default_factory=list, max_length=200)
    career_source_note: str | None = Field(default=None, max_length=1000)


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
