"""Models describing the text the language model is allowed to produce.

These are deliberately narrow. The model never chooses which skills to
recommend, never sees the recommendation order as something it may change, and
never states a number: the numbers in the brief come from the structured fields
the server fills in. Everything here is prose only.
"""

from pydantic import BaseModel, Field


class BriefRecommendationText(BaseModel):
    """Prose for one recommendation the server has already selected."""

    skill_id: str = Field(
        min_length=1,
        max_length=120,
        description='One of the skill identifiers supplied in the request.',
    )
    reason: str = Field(
        min_length=1,
        max_length=400,
        description=(
            'One or two sentences on why this skill is a useful next step today. '
            'Do not state numbers, percentages, dates, or durations.'
        ),
    )


class BriefText(BaseModel):
    """The complete prose of one daily brief.

    There is deliberately no greeting field: the greeting is the learner's local
    time of day, which the server composes itself.
    """

    summary: str = Field(
        min_length=1,
        max_length=600,
        description=(
            'Two or three sentences about the learner progress and check-in streak. '
            'Encouraging and factual. Never state numbers: the interface shows them separately.'
        ),
    )
    recommendations: list[BriefRecommendationText] = Field(
        default_factory=list,
        max_length=2,
        description='One entry per supplied recommendation candidate, in the supplied order.',
    )
    closing: str = Field(
        min_length=1,
        max_length=300,
        description='One short closing line, such as the check-in reminder.',
    )


__all__ = ['BriefRecommendationText', 'BriefText']
