"""Optional, generation-only provenance and explainability contracts."""
from typing import Annotated, Literal
from pydantic import BaseModel, ConfigDict, Field

VERSION = "career_evidence_v2"
class CareerModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class SkillOrigin(CareerModel):
    kind: Literal["reviewed_resume", "platform_confirmed", "learning_intention", "reviewed_learning"]
    label: str = Field(min_length=1, max_length=300)
    fact_ids: list[str] = Field(default_factory=list, max_length=20)

class SkillSources(CareerModel):
    skill_id: str = Field(min_length=1, max_length=160)
    origins: list[SkillOrigin] = Field(min_length=1, max_length=20)

class LearningFact(CareerModel):
    fact_id: str = Field(min_length=1, max_length=80)
    record_id: str = Field(min_length=1, max_length=180)
    kind: Literal["course_completion", "study", "course_practice", "workplace_practice"]
    label: str = Field(min_length=1, max_length=300)

class CourseSkillSource(CareerModel):
    skill_id: str = Field(min_length=1, max_length=160)
    course_id: str = Field(min_length=1, max_length=160)
    source_fingerprint: str = Field(min_length=1, max_length=80)
    quote: str = Field(min_length=8, max_length=2000)

class SourceMetadata(CareerModel):
    version: Literal["career_evidence_v1", "career_evidence_v2"]
    skill_sources: list[SkillSources] = Field(default_factory=list, max_length=250)
    learning_facts: list[LearningFact] = Field(default_factory=list, max_length=200)
    course_skill_sources: list[CourseSkillSource] = Field(default_factory=list, max_length=250)

class CareerQuote(CareerModel):
    candidate_id: str = Field(min_length=1, max_length=80)
    fact_id: str = Field(min_length=1, max_length=80)
    quote: str = Field(min_length=8, max_length=2000)

class AlignmentExample(CareerModel):
    fact_id: str
    text: str
    kind: Literal["resume", "course_completion", "study", "course_practice", "workplace_practice"]

class AlignmentLocation(CareerModel):
    section: str
    entry_index: int = Field(ge=0, le=249)

class AlignmentLink(CareerModel):
    skill_id: str
    name: str
    requirement_skill_id: int | None = None
    task_id: str | None = None
    method: Literal["standard_mapping", "ai_semantic"]
    origins: list[SkillOrigin]
    examples: list[AlignmentExample] = Field(default_factory=list)
    locations: list[AlignmentLocation] = Field(default_factory=list)

class AlignmentRequirement(CareerModel):
    skill_id: int
    name: str

class RoleAlignment(CareerModel):
    occupation_code: str
    title: str
    requirements: list[AlignmentRequirement]
    links: list[AlignmentLink]
    task_references: list[dict[str, str]] = Field(default_factory=list, max_length=100)
    summary_fact_ids: list[str] = Field(default_factory=list)
    project_order: list[str] = Field(default_factory=list)
