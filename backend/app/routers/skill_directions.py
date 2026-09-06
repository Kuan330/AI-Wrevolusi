from fastapi import APIRouter, HTTPException, status

from app.schemas.skill_direction import (
    SkillDirectionAnalysisRequest,
    SkillDirectionAnalysisResponse,
)
from app.services.skill_directions import (
    SkillDirectionConfigurationError,
    SkillDirectionGenerationError,
    generate_learning_themes,
)

router = APIRouter(prefix='/skill-directions', tags=['Skill directions'])


@router.post('/analyse', response_model=SkillDirectionAnalysisResponse)
async def analyse_skill_directions(
    request: SkillDirectionAnalysisRequest,
) -> SkillDirectionAnalysisResponse:
    try:
        return await generate_learning_themes(request)
    except SkillDirectionConfigurationError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc
    except SkillDirectionGenerationError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
