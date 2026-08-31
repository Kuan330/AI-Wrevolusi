from app.schemas.skill import (
    SkillEstimateItem,
    SkillEstimateRequest,
    SkillEstimateResponse,
    SkillPredictionItem,
)
from app.skills.schemas import SkillTaskInput
from app.skills.service import SkillInferenceService, get_skill_inference_service


class SkillInferenceApiService:
    @staticmethod
    def estimate_batch(payload: SkillEstimateRequest) -> SkillEstimateResponse:
        service = get_skill_inference_service()
        tasks = [
            SkillTaskInput(
                task_id=task.client_task_id,
                task_title=task.task_title,
                task_description=task.task_description or task.task_title,
                occupation=task.occupation or "",
                language=task.language or "en",
            )
            for task in payload.tasks
        ]
        results = service.infer_batch(tasks)
        provider_ready = service.ready
        inference_ok = provider_ready and not any(
            item.reject_reason == "service_unavailable" for item in results
        )
        return SkillEstimateResponse(
            model_version=service.model_version,
            prompt_version=service.prompt_version,
            llm_ready=inference_ok,
            results=[
                SkillEstimateItem(
                    client_task_id=item.task_id,
                    insufficient_context=item.insufficient_context,
                    reject_reason=item.reject_reason,
                    predictions=[
                        SkillPredictionItem(
                            skill_id=prediction.skill_id,
                            wef_skill_id=prediction.wef_skill_id,
                            confidence=prediction.confidence,
                            confidence_score=prediction.confidence_score,
                            evidence=prediction.evidence,
                            reason=prediction.reason,
                            match_layer=prediction.match_layer,
                        )
                        for prediction in item.predictions
                    ],
                )
                for item in results
            ],
        )
