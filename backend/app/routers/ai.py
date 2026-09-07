from fastapi import APIRouter, Depends

from app.schemas.ai_matching import TaskMatchRequest, TaskMatchResponse
from app.schemas.occupation_ai import (
    OccupationRecommendationsRequest,
    OccupationRecommendationsResponse,
    OccupationSuggestionsRequest,
    OccupationSuggestionsResponse,
)
from app.schemas.skill_matching import SkillMatchRequest, SkillMatchResponse
from app.services.ai_gateway import AIGateway, default_ai_gateway
from app.services.ai_matching import (
    DeterministicTaskMatchProvider,
    TaskMatchProvider,
    enforce_task_match_contract,
)
from app.services.occupation_ai import (
    deterministic_recommend_occupations,
    deterministic_suggest_occupations,
)
from app.services.skill_matching import match_skills_response



def _retain_task_evidence(response: SkillMatchResponse, task_text: str) -> SkillMatchResponse:
    """Drop provider skill items whose evidence is not in the input task."""

    valid_items = [
        item
        for item in response.skills
        if item.evidence_phrases
        and all(phrase in task_text for phrase in item.evidence_phrases)
    ][:2]
    return SkillMatchResponse(skills=valid_items)


router = APIRouter(prefix='/ai', tags=['AI Matching'])


def get_task_match_provider() -> TaskMatchProvider:
    """Dependency seam for the credential-free task provider."""

    return DeterministicTaskMatchProvider()


def get_ai_gateway() -> AIGateway:
    """Dependency seam for an optional structured-output provider."""

    return default_ai_gateway()


@router.post('/task-match', response_model=TaskMatchResponse)
def task_match(
    request: TaskMatchRequest,
    provider: TaskMatchProvider = Depends(get_task_match_provider),
    gateway: AIGateway = Depends(get_ai_gateway),
) -> TaskMatchResponse:
    """Match a user task only against the candidates included in the request."""

    result = gateway.run_structured(
        operation='task-match',
        payload=request.model_dump(mode='json'),
        response_model=TaskMatchResponse,
        local=lambda: enforce_task_match_contract(
            provider.match_task(
                request.occupation_code,
                request.user_task,
                request.candidates,
            ),
            request.candidates,
        ),
        fallback=lambda: TaskMatchResponse(
            candidate_id='',
            confidence=0.0,
            matched_concepts=[],
            unmatched_concepts=[],
            reason='Matching was unavailable, so no candidate was selected.',
            clarifying_question=(
                'Could you describe the main steps of the task or choose the closest supplied candidate?'
            ),
        ),
        prefer_local_on_provider_failure=True,
    )
    return enforce_task_match_contract(result.value, request.candidates)


@router.post(
    '/occupation-suggestions',
    response_model=OccupationSuggestionsResponse,
)
def occupation_suggestions(
    request: OccupationSuggestionsRequest,
    gateway: AIGateway = Depends(get_ai_gateway),
) -> OccupationSuggestionsResponse:
    """Suggest only supplied unit occupations for an occupation description."""

    result = gateway.run_candidate_constrained(
        operation='occupation-suggestions',
        payload=request.model_dump(mode='json'),
        response_model=OccupationSuggestionsResponse,
        candidates=request.candidates,
        candidate_key='code',
        local=lambda: deterministic_suggest_occupations(request),
        prefer_local_on_provider_failure=True,
        fallback=lambda: OccupationSuggestionsResponse(
            status='clarifying',
            candidates=[],
            clarifying_questions=['Please provide more detail about the work described.'],
        ),
    )
    return result.value


@router.post(
    '/occupation-recommendations',
    response_model=OccupationRecommendationsResponse,
)
def occupation_recommendations(
    request: OccupationRecommendationsRequest,
    gateway: AIGateway = Depends(get_ai_gateway),
) -> OccupationRecommendationsResponse:
    """Return supplied occupation alternatives for exploration, not hiring advice."""

    result = gateway.run_candidate_constrained(
        operation='occupation-recommendations',
        payload=request.model_dump(mode='json'),
        response_model=OccupationRecommendationsResponse,
        candidates=request.candidates,
        candidate_key='code',
        local=lambda: deterministic_recommend_occupations(request),
        prefer_local_on_provider_failure=True,
        fallback=lambda: OccupationRecommendationsResponse(
            status='clarifying',
            candidates=[],
            clarifying_questions=['Please provide more context for comparing occupations.'],
        ),
    )
    return result.value


@router.post('/skill-match', response_model=SkillMatchResponse)
def skill_match(
    request: SkillMatchRequest,
    gateway: AIGateway = Depends(get_ai_gateway),
) -> SkillMatchResponse:
    """Match a task only against the caller-supplied skill candidates."""

    result = gateway.run_candidate_constrained(
        operation='skill-match',
        payload=request.model_dump(mode='json'),
        response_model=SkillMatchResponse,
        candidates=request.candidates,
        candidate_key='id',
        local=lambda: match_skills_response(request.task_text, request.candidates),
        fallback=lambda: SkillMatchResponse(skills=[]),
        post_validate=lambda response: _retain_task_evidence(response, request.task_text),
    )
    return result.value
