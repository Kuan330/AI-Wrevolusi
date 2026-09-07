from typing import Any, Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator


class OccupationAISchema(BaseModel):
    """Shared schema settings for offline occupation-assistance contracts."""

    model_config = ConfigDict(extra='forbid')


class ExtractedOccupationSignals(OccupationAISchema):
    """Optional structured signals extracted from a user's description."""

    actions: list[str] = Field(default_factory=list, max_length=100)
    objects: list[str] = Field(default_factory=list, max_length=100)
    scope: list[str] = Field(default_factory=list, max_length=100)
    industry: list[str] = Field(default_factory=list, max_length=100)


class OccupationSuggestionCandidate(OccupationAISchema):
    """A unit occupation supplied by the caller for safe reranking."""

    code: str = Field(
        min_length=1,
        max_length=100,
        validation_alias=AliasChoices('code', 'occupation_code'),
    )
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(default='', max_length=5000)

    @field_validator('code', 'title')
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('must not be blank')
        return value


class SelectedOccupation(OccupationAISchema):
    occupation_code: str = Field(
        min_length=1,
        max_length=100,
        validation_alias=AliasChoices('occupation_code', 'code'),
    )
    title: str = Field(min_length=1, max_length=300)

    @field_validator('occupation_code', 'title')
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('must not be blank')
        return value


class OccupationRecommendationCandidate(OccupationAISchema):
    """A caller-supplied occupation considered for exploration."""

    code: str = Field(
        min_length=1,
        max_length=100,
        validation_alias=AliasChoices('code', 'occupation_code'),
    )
    title: str = Field(min_length=1, max_length=300)
    why_similar: str = Field(
        default='',
        max_length=2000,
        validation_alias=AliasChoices('why_similar', 'why-similar'),
    )

    @field_validator('code', 'title')
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('must not be blank')
        return value


class OccupationSuggestionsRequest(OccupationAISchema):
    user_description: str = Field(min_length=1, max_length=10000)
    extracted: ExtractedOccupationSignals = Field(default_factory=ExtractedOccupationSignals)
    candidates: list[OccupationSuggestionCandidate] = Field(default_factory=list, max_length=500)

    @field_validator('user_description')
    @classmethod
    def reject_blank_description(cls, value: str) -> str:
        if not value.strip():
            raise ValueError('must not be blank')
        return value


class OccupationRecommendationsRequest(OccupationAISchema):
    selected_occupation: SelectedOccupation
    user_context: dict[str, Any] | list[Any] | str | None = Field(default_factory=dict)
    candidates: list[OccupationRecommendationCandidate] = Field(
        default_factory=list,
        max_length=500,
    )


class OccupationResultItem(OccupationAISchema):
    occupation_code: str
    title: str
    confidence: float = Field(ge=0.0, le=1.0)
    evidence: list[str] = Field(default_factory=list)
    difference: str = Field(min_length=1)


class OccupationSuggestionsResponse(OccupationAISchema):
    status: Literal['suggestions', 'clarifying']
    candidates: list[OccupationResultItem] = Field(default_factory=list, max_length=5)
    clarifying_questions: list[str] = Field(default_factory=list)


class OccupationRecommendationsResponse(OccupationAISchema):
    status: Literal['suggestions', 'clarifying']
    candidates: list[OccupationResultItem] = Field(default_factory=list, max_length=5)
    clarifying_questions: list[str] = Field(default_factory=list)


# Short aliases keep the domain vocabulary convenient for service consumers.
OccupationSuggestionRequest = OccupationSuggestionsRequest
OccupationRecommendationRequest = OccupationRecommendationsRequest
OccupationSuggestion = OccupationResultItem
OccupationRecommendation = OccupationResultItem
