"""Transient Epic 9 contracts. Nothing here is stored in the database."""
import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

CONTACT = re.compile(r"[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}|\+[1-9][0-9 ().-]{7,}[0-9]")


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


# --- Question bank (reference data) -------------------------------------------------

class BankQuestion(StrictModel):
    id: str = Field(min_length=1, max_length=20)
    question: str = Field(min_length=1, max_length=400)
    intent: str | None = Field(default=None, max_length=60)
    scope: Literal["Exact", "Family", "Common"] | None = None


class QuestionBankResponse(StrictModel):
    occupation_code: str
    matched: Literal["exact", "family", "common"]
    questions: list[BankQuestion]


# --- Plan: choose 3 to 5 questions from the reviewed resume --------------------------

ItemKind = Literal["work", "project", "skill", "requirement", "summary"]
QuestionKind = Literal["resume_item", "requirement_practice", "ai_change", "general"]


class PlanItem(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    kind: ItemKind
    label: str = Field(min_length=1, max_length=200)
    text: str = Field(default="", max_length=1500)


class ChangeTopic(StrictModel):
    id: str = Field(min_length=1, max_length=80)
    text: str = Field(min_length=1, max_length=500)


class PlanRequest(StrictModel):
    role_title: str = Field(default="", max_length=200)
    items: list[PlanItem] = Field(default_factory=list, max_length=40)
    bank: list[BankQuestion] = Field(default_factory=list, max_length=20)
    topics: list[ChangeTopic] = Field(default_factory=list, max_length=10)
    count: int = Field(default=4, ge=3, le=5)
    items_reviewed: bool = False

    @model_validator(mode="after")
    def private_and_unique(self):
        if self.items and not self.items_reviewed:
            raise ValueError("Review the resume items before sending them for question planning.")
        if len({i.id for i in self.items}) != len(self.items) or len({t.id for t in self.topics}) != len(self.topics):
            raise ValueError("Item IDs must be unique.")
        everything = " ".join([self.role_title, *[f"{i.label} {i.text}" for i in self.items], *[t.text for t in self.topics]])
        if CONTACT.search(everything):
            raise ValueError("Remove contact details before sending resume items.")
        if not self.items and not self.bank:
            raise ValueError("Provide resume items or question-bank questions.")
        return self


class PlannedQuestion(StrictModel):
    text: str = Field(min_length=1, max_length=400)
    kind: QuestionKind
    item_id: str | None = Field(default=None, max_length=80)
    topic_id: str | None = Field(default=None, max_length=80)
    bank_id: str | None = Field(default=None, max_length=20)


class PlanModelResponse(StrictModel):
    questions: list[PlannedQuestion] = Field(min_length=1, max_length=8)


class PlanResponse(StrictModel):
    source: Literal["ai", "template"]
    questions: list[PlannedQuestion]


# --- Feedback ------------------------------------------------------------------------

CheckId = Literal["answered_question", "own_actions", "concrete_example", "judgement", "ai_check"]
CheckStatus = Literal["yes", "partly", "no", "not_applicable"]
ImprovementKind = Literal["expression", "missing_example", "possible_skill_gap"]


class QuestionContext(StrictModel):
    text: str = Field(min_length=1, max_length=500)
    kind: QuestionKind = "general"
    item_label: str | None = Field(default=None, max_length=200)


class SkillOption(StrictModel):
    id: int = Field(ge=0, le=100000)
    name: str = Field(min_length=1, max_length=160)


class FeedbackRequest(StrictModel):
    question: QuestionContext
    answer: str = Field(min_length=1, max_length=4000)
    role_title: str = Field(default="", max_length=200)
    attempt: int = Field(default=1, ge=1, le=20)
    follow_ups_asked: int = Field(default=0, ge=0, le=2)
    skills: list[SkillOption] = Field(default_factory=list, max_length=60)

    @model_validator(mode="after")
    def non_empty_private(self):
        if not self.answer.strip():
            raise ValueError("Add your answer before asking for feedback.")
        if CONTACT.search(self.answer):
            raise ValueError("Remove contact details from your answer before sending it.")
        return self


class Check(StrictModel):
    id: CheckId
    status: CheckStatus
    quote: str | None = Field(default=None, max_length=300)
    note: str = Field(default="", max_length=300)


class Improvement(StrictModel):
    kind: ImprovementKind
    text: str = Field(min_length=1, max_length=400)
    quote: str | None = Field(default=None, max_length=300)
    uncertain: bool = False


class SkillGapPick(StrictModel):
    skill_id: int = Field(ge=0, le=100000)
    reason: Annotated[str, Field(min_length=1, max_length=300)]


class FeedbackResponse(StrictModel):
    summary: str = Field(min_length=1, max_length=400)
    checks: list[Check] = Field(max_length=5)
    improvements: list[Improvement] = Field(default_factory=list, max_length=5)
    follow_up: str | None = Field(default=None, max_length=300)
    skill_gap: SkillGapPick | None = None
