"""Candidate suggestions are temporary ideas, never persisted learning evidence."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class StrictModel(BaseModel):
    model_config = ConfigDict(extra='forbid')


class TaskSuggestionsRequest(StrictModel):
    task_id: str = Field(min_length=1, max_length=200)
    expected_wording: str = Field(min_length=1, max_length=5000)


class GoalSuggestionRequest(StrictModel):
    goal_id: str = Field(min_length=1, max_length=100)
    expected_revision: int = Field(ge=1)


class Activity(StrictModel):
    task_quote: str = Field(min_length=1, max_length=5000)
    search_phrase: str = Field(min_length=1, max_length=300)


class ExtractedActivities(StrictModel):
    activities: list[Activity] = Field(max_length=6)
    coverage_limited: bool


class PreparedIdea(StrictModel):
    goal: str = Field(min_length=1, max_length=1000)
    action: str = Field(min_length=1, max_length=1000)
    practice_idea: str = Field(min_length=1, max_length=1800)


class SelectedConcept(PreparedIdea):
    uri: str = Field(min_length=1, max_length=200)
    task_quote: str = Field(min_length=1, max_length=5000)
    reason: str = Field(min_length=1, max_length=600)


class SelectedConcepts(StrictModel):
    suggestions: list[SelectedConcept] = Field(max_length=3)
    coverage_limited: bool
