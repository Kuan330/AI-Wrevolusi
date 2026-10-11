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

class SourceProject(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    mode: Literal["structured", "verbatim"]
    fact_ids: list[str] = Field(min_length=1, max_length=500)
    name: str | None = Field(default=None, max_length=300)
    date: str | None = Field(default=None, max_length=100)
    highlight_fact_ids: list[str] = Field(default_factory=list, max_length=18)

class ProjectEntry(StrictModel):
    name: str = Field(min_length=1, max_length=300)
    date: str | None = Field(default=None, max_length=100)
    highlights: list[Annotated[str, Field(min_length=1, max_length=2000)]] = Field(max_length=18)

class SourceSection(StrictModel):
    title: str = Field(min_length=1, max_length=100)
    heading_fact_id: str | None = Field(default=None, max_length=80)
    fact_ids: list[str] = Field(default_factory=list, max_length=500)
    polishable_fact_ids: list[str] = Field(default_factory=list, max_length=500)

class GenerateRequest(StrictModel):
    occupation_code: str | None = Field(default=None, min_length=1, max_length=100)
    job_requirements: str = Field(min_length=1, max_length=20000)
    skills: list[SkillCandidate] = Field(default_factory=list, max_length=250)
    evidence: list[Evidence] = Field(default_factory=list, max_length=500)
    evidence_reviewed: bool = False
    source_projects: list[SourceProject] | None = Field(default=None, max_length=80)
    source_sections: list[SourceSection] | None = Field(default=None, max_length=30)

    @model_validator(mode="after")
    def bounded_evidence(self):
        if self.occupation_code is not None and self.source_sections is None:
            raise ValueError("Role-filtered generation requires reviewed source sections.")
        if sum(len(f.text) for f in self.evidence) > 60000:
            raise ValueError("Resume evidence exceeds the text limit.")
        if self.evidence and not self.evidence_reviewed:
            raise ValueError("Review and redact resume evidence before sending it.")
        if any(re.search(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+[1-9][0-9 ().-]{7,}[0-9]", f.text) for f in self.evidence):
            raise ValueError("Remove contact details from reviewed evidence before sending it.")
        if len({s.id for s in self.skills}) != len(self.skills) or len({f.id for f in self.evidence}) != len(self.evidence):
            raise ValueError("Source IDs must be unique.")
        if self.source_projects is not None:
            facts = {f.id: f.text for f in self.evidence}
            project_ids, used = set(), set()
            for project in self.source_projects:
                if project.id in project_ids or len(set(project.fact_ids)) != len(project.fact_ids) or any(fid not in facts or fid in used for fid in project.fact_ids):
                    raise ValueError("Project references must be unique reviewed evidence.")
                project_ids.add(project.id)
                used.update(project.fact_ids)
                if project.mode == "structured":
                    highlights = project.highlight_fact_ids
                    if len(project.fact_ids) > 20 or not project.name or not highlights or len(set(highlights)) != len(highlights) or any(fid not in project.fact_ids for fid in highlights):
                        raise ValueError("Structured projects require a name and separate reviewed highlights.")
                    headers = " ".join(facts[fid] for fid in project.fact_ids if fid not in highlights)
                    if project.name not in headers or (project.date and project.date not in headers):
                        raise ValueError("Project names and dates must occur verbatim in the referenced headers.")
                elif project.name is not None or project.date is not None or project.highlight_fact_ids:
                    raise ValueError("Verbatim projects must not contain inferred metadata.")
        if self.source_sections is not None:
            from app.schemas.resume_sources import validate_source_sections
            validate_source_sections(self)
        if not self.skills and not self.evidence:
            raise ValueError("Add skills or provide reviewed resume evidence first.")
        return self

class GeneratedEntry(StrictModel):
    text: str = Field(min_length=1, max_length=2000)
    skill_ids: list[str] = Field(default_factory=list, max_length=20)
    fact_ids: list[str] = Field(default_factory=list, max_length=20)
    project_id: str | None = Field(default=None, max_length=80)
    project: ProjectEntry | None = None
    verbatim: bool = False

class ResumeSection(StrictModel):
    title: str = Field(min_length=1, max_length=100)
    entries: list[GeneratedEntry] = Field(max_length=80)

class GeneratedSection(ResumeSection):
    title: Literal["Skills", "Experience", "Projects", "Education", "Summary"]
    entries: list[GeneratedEntry] = Field(max_length=80)

class SkillsSection(ResumeSection):
    """Deterministically assembled Skills; all other sections retain 80 entries."""
    title: Literal["Skills"]
    entries: list[GeneratedEntry] = Field(max_length=250)

class SkillGap(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    label: str = Field(min_length=1, max_length=200)
    keywords: list[Annotated[str, Field(max_length=120)]] = Field(default_factory=list, max_length=15)
    skill_slugs: list[Annotated[str, Field(max_length=120)]] = Field(default_factory=list, max_length=10)

class GenerateResponse(StrictModel):
    skill_filter_version: Literal["role_relevance_v1"] | None = None
    sections: list[SkillsSection | ResumeSection] = Field(max_length=30)
    gaps: list[SkillGap] = Field(default_factory=list, max_length=20)

    outcome: Literal["tailored", "source_preserved"] | None = None
    notices: list[Literal["ai_timeout", "ai_unavailable", "ai_output_invalid", "unsupported_polish", "unpolished_evidence", "no_polishable_evidence", "skill_relevance_incomplete", "no_related_skills"]] = Field(default_factory=list, max_length=6)

class Polish(StrictModel):
    fact_id: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=2000)

class ResumePolishResponse(StrictModel):
    patches: list[Polish] = Field(default_factory=list, max_length=500)
    gaps: list[SkillGap] = Field(default_factory=list, max_length=20)

class SkillRelevanceDecision(StrictModel):
    candidate_id: str = Field(min_length=1, max_length=80)
    requirement_skill_id: Annotated[int, Field(strict=True)] | None

class ResumeRolePolishResponse(ResumePolishResponse):
    skill_decisions: list[SkillRelevanceDecision] = Field(max_length=250)

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
    context_mode: Literal["auto_redacted"] | None = None
    history: list[AssistMessage] = Field(default_factory=list, max_length=10)

    @model_validator(mode="after")
    def private_context(self):
        import json
        if not self.context_reviewed and self.context_mode != "auto_redacted": raise ValueError("Use automatically redacted context or review the assistant context first.")
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
