from fastapi import APIRouter

from app.schemas.skill import SkillEstimateRequest, SkillEstimateResponse
from app.services.skill_inference import SkillInferenceApiService

router = APIRouter(prefix='/skills', tags=['Skills'])


@router.post('/estimate', response_model=SkillEstimateResponse)
async def estimate_task_skills(payload: SkillEstimateRequest) -> SkillEstimateResponse:
    return SkillInferenceApiService.estimate_batch(payload)
