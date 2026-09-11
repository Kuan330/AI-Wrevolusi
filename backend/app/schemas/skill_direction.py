from typing import Literal

from pydantic import BaseModel, Field


SkillDirection = Literal['keep_building', 'strengthen', 'use_with_ai']


class SkillDirectionInput(BaseModel):
    skill_id: int = Field(gt=0)
    skill_name: str = Field(min_length=1, max_length=160)
    direction: SkillDirection
    supporting_tasks: list[str] = Field(min_length=1, max_length=20)
    current_importance_pct: int | None = Field(default=None, ge=0, le=100)
    future_outlook_points: int | None = Field(default=None, ge=-100, le=100)
    genai_capacity: str | None = Field(default=None, max_length=80)


class SkillDirectionAnalysisRequest(BaseModel):
    occupation_title: str = Field(min_length=1, max_length=200)
    skills: list[SkillDirectionInput] = Field(min_length=1, max_length=26)


class LearningTheme(BaseModel):
    theme_id: str
    skill_id: int
    skill_name: str
    direction: SkillDirection
    title: str
    description: str
    why_relevant: str


class SkillDirectionAnalysisResponse(BaseModel):
    themes: list[LearningTheme]
