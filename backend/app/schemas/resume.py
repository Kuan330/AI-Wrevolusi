"""Transient resume contracts. These are never workspace/database records."""
from typing import Annotated, Literal
import re
from pydantic import BaseModel, ConfigDict, Field, model_validator

class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

class SkillCandidate(StrictModel):
    id: str = Field(min_length=1, max_length=160)
    name: str = Field(min_length=1, max_length=160)

class Evidence(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=2000)

class GenerateRequest(StrictModel):
    job_requirements: str = Field(min_length=1, max_length=20000)
    skills: list[SkillCandidate] = Field(default_factory=list, max_length=250)
    evidence: list[Evidence] = Field(default_factory=list, max_length=500)
    evidence_reviewed: bool = False

    @model_validator(mode="after")
    def bounded_evidence(self):
        if sum(len(f.text) for f in self.evidence) > 60000:
            raise ValueError("Resume evidence exceeds the text limit.")
        if self.evidence and not self.evidence_reviewed:
            raise ValueError("Review and redact resume evidence before sending it.")
        if any(re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+[1-9][0-9 ().-]{7,}[0-9]", f.text) for f in self.evidence):
            raise ValueError("Remove contact details from reviewed evidence before sending it.")
        if len({s.id for s in self.skills}) != len(self.skills) or len({f.id for f in self.evidence}) != len(self.evidence):
            raise ValueError("Source IDs must be unique.")
        if not self.skills and not self.evidence:
            raise ValueError("Add skills or provide reviewed resume evidence first.")
        return self

class GeneratedEntry(StrictModel):
    text: str = Field(min_length=1, max_length=2000)
    skill_ids: list[str] = Field(default_factory=list, max_length=20)
    fact_ids: list[str] = Field(default_factory=list, max_length=20)

class GeneratedSection(StrictModel):
    title: Literal["Skills", "Experience", "Projects", "Education", "Summary"]
    entries: list[GeneratedEntry] = Field(max_length=80)

class SkillGap(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=200)
    keywords: list[Annotated[str, Field(max_length=120)]] = Field(default_factory=list, max_length=15)
    skill_slugs: list[Annotated[str, Field(max_length=120)]] = Field(default_factory=list, max_length=10)

class GenerateResponse(StrictModel):
    sections: list[GeneratedSection] = Field(max_length=5)
    gaps: list[SkillGap] = Field(default_factory=list, max_length=20)

class RecommendRequest(StrictModel):
    gaps: list[SkillGap] = Field(max_length=20)

class CourseChoice(StrictModel):
    course_id: str = Field(min_length=1, max_length=160)
    gap_ids: list[str] = Field(min_length=1, max_length=20)
    reason: str = Field(min_length=1, max_length=400)

class RecommendResponse(StrictModel):
    courses: list[CourseChoice] = Field(default_factory=list, max_length=5)

class RenderRequest(StrictModel):
    document: dict


class AssistMessage(StrictModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=3000)

class AssistRequest(StrictModel):
    instruction: str = Field(min_length=1, max_length=5000)
    document: dict
    skills: list[SkillCandidate] = Field(default_factory=list, max_length=250)
    context_reviewed: bool = False
    history: list[AssistMessage] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def private_context(self):
        import json
        if not self.context_reviewed: raise ValueError("Review the assistant context first.")
        if set(self.document) - {"cv", "design"} or not isinstance(self.document.get("cv"), dict) or set(self.document["cv"]) - {"sections"}:
            raise ValueError("Only redacted sections and safe design settings may be sent.")
        text = json.dumps(self.model_dump(), ensure_ascii=False)
        if len(text) > 100000 or sum(len(m.content) for m in self.history) > 15000:
            raise ValueError("Assistant context exceeds the size limit.")
        if re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+[1-9][0-9 ().-]{7,}[0-9]", text):
            raise ValueError("Remove contact details before sending assistant context.")
        if len({s.id for s in self.skills}) != len(self.skills): raise ValueError("Source IDs must be unique.")
        return self

class AssistEntry(StrictModel):
    entry: str | dict
    source_ids: list[Annotated[str, Field(min_length=1, max_length=180)]] = Field(min_length=1, max_length=30)

class AssistSection(StrictModel):
    section_index: int = Field(ge=0, le=100)
    entries: list[AssistEntry] = Field(max_length=80)

class AssistDesign(StrictModel):
    path: list[Annotated[str, Field(pattern=r"^[a-z_]{1,64}$")]] = Field(min_length=1, max_length=6)
    value: str | bool | int | float | None

class AssistResponse(StrictModel):
    message: str = Field(min_length=1, max_length=500)
    sections: list[AssistSection] = Field(default_factory=list, max_length=50)
    design: list[AssistDesign] = Field(default_factory=list, max_length=80)
