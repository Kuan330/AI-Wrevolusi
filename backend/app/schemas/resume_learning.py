"""Course curriculum suggestions are references, never personal achievement facts."""
from typing import Annotated, Literal
from pydantic import Field, model_validator
from app.schemas.resume import StrictModel

class LearningSkillsRequest(StrictModel):
    course_ids: list[Annotated[str, Field(min_length=1, max_length=160)]] = Field(min_length=1, max_length=250)

    @model_validator(mode="after")
    def unique_ids(self):
        if len(set(self.course_ids)) != len(self.course_ids):
            raise ValueError("Choose each course once.")
        return self

class LearningSkillSuggestion(StrictModel):
    name: str = Field(min_length=1, max_length=160)
    quote: str = Field(min_length=8, max_length=2000)

class CourseSuggestions(StrictModel):
    course_id: str
    skills: list[dict] = Field(default_factory=list, max_length=20, json_schema_extra={"items": LearningSkillSuggestion.model_json_schema()})

class CourseSkillsResult(StrictModel):
    course_id: str
    title: str
    source_fingerprint: str
    outcomes: str
    skills: list[LearningSkillSuggestion] = Field(default_factory=list, max_length=20)
    notices: list[Literal["no_teaching_objectives", "invalid_suggestions", "no_skill_suggestions"]] = Field(default_factory=list)

class LearningSkillsResponse(StrictModel):
    courses: list[CourseSkillsResult] = Field(max_length=250)

class LearningSkillsEnvelope(StrictModel):
    # Keep row validation isolated without leaving the provider's shape undefined.
    courses: list[dict] = Field(max_length=250, json_schema_extra={"items": CourseSuggestions.model_json_schema()})
