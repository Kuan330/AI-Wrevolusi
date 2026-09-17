import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from starlette.concurrency import run_in_threadpool

from app.db.session import get_db
from app.models.user import User
from app.schemas.ai_matching import TaskMatchRequest, TaskMatchResponse
from app.schemas.occupation_ai import (
    OccupationRecommendationsRequest,
    OccupationRecommendationsResponse,
    OccupationSuggestionsRequest,
    OccupationSuggestionsResponse,
)
from app.schemas.skill_matching import (
    SkillMatchCandidate,
    SkillMatchRequest,
    SkillMatchResponse,
)
from app.schemas.task_assist import (
    TaskAssistDetailBatchRequest,
    TaskAssistDetailBatchResponse,
    TaskAssistInteractionRead,
    TaskAssistRequest,
)
from app.services.ai_gateway import AIGateway, default_ai_gateway
from app.services.auth import get_current_user
from app.services.ai_matching import (
    MINIMUM_TASK_MATCH_WORDS,
    DeterministicTaskMatchProvider,
    TaskMatchProvider,
    count_task_text_words_for_matching,
    enforce_task_match_contract,
)
from app.services.occupation_ai import (
    deterministic_recommend_occupations,
    deterministic_suggest_occupations,
)
from app.services.skill_matching import MAX_SKILL_MATCHES, match_skills_response
from app.services.task_assist import deterministic_task_assist, suggest_task_assist
from app.services import task_assist_records



def _finalize_skill_matches(
    response: SkillMatchResponse,
    task_text: str,
    candidates: list[SkillMatchCandidate],
) -> SkillMatchResponse:
    """Verify provider evidence, then fall back to the deterministic rules.

    Two things can empty a provider response: evidence that cannot be traced
    back to the input, and short inputs the model judges too vague to match — a
    lone word like "thinking" can never reproduce the full name "Analytical
    thinking", so a strict evidence check would drop all three of its matches.
    An empty list is a dead end for the user either way, so the rule table
    answers instead when the provider returns nothing.
    """

    verified = [
        item
        for item in response.skills
        if item.evidence_phrases
        and all(phrase in task_text for phrase in item.evidence_phrases)
    ]
    kept = verified or response.skills
    if kept:
        return SkillMatchResponse(skills=kept[:MAX_SKILL_MATCHES])
    return match_skills_response(task_text, candidates)


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
    """Match a user task only against the candidates included in the request.

    The task editor calls this automatically while the user types, so requests
    below the shared minimum word count are answered with an explicit
    ``needs_more_input`` status instead of a forced match.
    """

    if count_task_text_words_for_matching(request.user_task) < MINIMUM_TASK_MATCH_WORDS:
        return TaskMatchResponse(
            candidate_id='',
            confidence=0.0,
            matched_concepts=[],
            unmatched_concepts=[],
            reason=(
                'The task description has fewer than '
                f'{MINIMUM_TASK_MATCH_WORDS} meaningful words, so it was not '
                'matched against the standard tasks yet.'
            ),
            clarifying_question=(
                f'Keep typing — matching starts after {MINIMUM_TASK_MATCH_WORDS} '
                'words. Describe the main steps you perform.'
            ),
            status='needs_more_input',
        )

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
    response = enforce_task_match_contract(result.value, request.candidates)
    return response.model_copy(
        update={'status': 'matched' if response.candidate_id else 'no_match'}
    )


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
    """Match a task only against the caller-supplied skill candidates.

    The deterministic rules answer first. They already cover every skill name
    plus the everyday words for the work behind it, and they return in under a
    millisecond — so the common case never pays for a provider round-trip. The
    model is only consulted when the rules find nothing at all, which is where
    its judgement actually adds something.
    """

    quick = match_skills_response(request.task_text, request.candidates)
    if quick.skills or request.fast_only:
        return quick

    result = gateway.run_candidate_constrained(
        operation='skill-match',
        payload=request.model_dump(mode='json'),
        response_model=SkillMatchResponse,
        candidates=request.candidates,
        candidate_key='id',
        local=lambda: match_skills_response(request.task_text, request.candidates),
        fallback=lambda: SkillMatchResponse(skills=[]),
        post_validate=lambda response: _finalize_skill_matches(
            response, request.task_text, request.candidates
        ),
    )
    return result.value


def _task_assist_read(row) -> TaskAssistInteractionRead:
    return TaskAssistInteractionRead(
        task_key=row.task_key,
        status=row.status,
        question=row.question,
        reply=row.reply,
        generated_by_model=row.generated_by_model,
        needs_user_confirmation=row.needs_user_confirmation,
        completed_at=row.completed_at,
    )


@router.post(
    '/task-assist/details',
    response_model=TaskAssistDetailBatchResponse,
)
async def register_task_assist_details(
    request: TaskAssistDetailBatchRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskAssistDetailBatchResponse:
    """Bind current profile-detail snapshots to the signed-in user."""

    rows = await task_assist_records.register_details(
        db,
        current_user.id,
        request.details,
    )
    return TaskAssistDetailBatchResponse(items=[_task_assist_read(row) for row in rows])


@router.get(
    '/task-assist/{task_key}',
    response_model=TaskAssistInteractionRead,
)
async def get_task_assist_interaction(
    task_key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskAssistInteractionRead:
    """Return only this user's stored state and permanent first exchange."""

    row = await task_assist_records.resolve_stale_pending(
        db,
        current_user.id,
        task_key,
    )
    if row is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Task detail not registered.',
        )
    return _task_assist_read(row)


@router.post('/task-assist', response_model=TaskAssistInteractionRead)
async def task_assist(
    request: TaskAssistRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    gateway: AIGateway = Depends(get_ai_gateway),
) -> TaskAssistInteractionRead:
    """Generate and permanently store at most one answer for this user's detail."""

    claim = await task_assist_records.claim_interaction(
        db,
        current_user.id,
        request.task_key,
        question=request.user_message,
    )
    if claim.outcome == 'missing':
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='Task detail not registered.',
        )
    if claim.outcome == 'completed':
        return _task_assist_read(claim.row)
    if claim.outcome == 'pending':
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail='Task assistance is already being generated.',
        )

    assert claim.row is not None and claim.claim_token is not None
    try:
        response = await run_in_threadpool(
            suggest_task_assist,
            task_text=claim.row.task_text,
            notes=claim.row.notes,
            user_message=request.user_message,
            gateway=gateway,
        )
    except Exception:
        response = deterministic_task_assist(claim.row.task_text)

    try:
        completed = await task_assist_records.complete_interaction(
            db,
            current_user.id,
            request.task_key,
            claim.claim_token,
            response=response,
        )
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail='Task assistance is pending recovery. Please reopen this detail shortly.',
        ) from None
    return _task_assist_read(completed)
