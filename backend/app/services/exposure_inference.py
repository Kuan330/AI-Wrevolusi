from app.nlp.policies.exposure import unscored
from app.nlp.runtime import get_exposure_runtime
from app.schemas.exposure import (
    ExposureEstimateItem,
    ExposureEstimateRequest,
    ExposureEstimateResponse,
    ExposureNeighbor,
)


class ExposureInferenceService:
    @staticmethod
    def estimate_batch(payload: ExposureEstimateRequest) -> ExposureEstimateResponse:
        runtime = get_exposure_runtime()
        results: list[ExposureEstimateItem] = []
        for task in payload.tasks:
            estimate = (
                runtime.policy.estimate(
                    task.task_text,
                    payload.occupation_code,
                    original_task_text=task.original_task_text,
                )
                if runtime.ready
                else unscored(reject_reason="service_unavailable")
            )
            results.append(
                ExposureEstimateItem(
                    client_task_id=task.client_task_id,
                    score_2025=estimate.score_2025,
                    band=estimate.band,
                    potential25=estimate.potential25,
                    match_layer=estimate.match_layer,
                    score_source=estimate.score_source,
                    reject_reason=estimate.reject_reason,
                    neighbors=[
                        ExposureNeighbor(
                            isco_08=neighbor.isco_08,
                            task_id=neighbor.task_id,
                            task_text=neighbor.task_text,
                            score_2025=neighbor.score_2025,
                            similarity=neighbor.similarity,
                        )
                        for neighbor in estimate.neighbors
                    ],
                )
            )
        return ExposureEstimateResponse(
            embedding_model=runtime.encoder.name,
            nlp_ready=runtime.ready,
            results=results,
        )
