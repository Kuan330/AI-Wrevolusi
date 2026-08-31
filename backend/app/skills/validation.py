from __future__ import annotations

from app.skills.catalog import SkillCatalog
from app.skills.schemas import (
    LlmSkillInferenceResult,
    LlmSkillPrediction,
    ValidatedSkillInferenceResult,
    ValidatedSkillPrediction,
)

IDENTIFIED_THRESHOLD = 0.75


def _task_corpus(task_title: str, task_description: str) -> str:
    parts = [part.strip() for part in (task_title, task_description) if part and part.strip()]
    return "\n".join(parts)


def _confidence_band(score: float) -> str:
    return "identified" if score >= IDENTIFIED_THRESHOLD else "possible"


def evidence_is_valid(evidence: str, task_title: str, task_description: str) -> bool:
    corpus = _task_corpus(task_title, task_description)
    return bool(evidence) and evidence in corpus


def dedupe_predictions(predictions: list[LlmSkillPrediction]) -> list[LlmSkillPrediction]:
    seen: set[str] = set()
    unique: list[LlmSkillPrediction] = []
    for prediction in predictions:
        if prediction.skill_id in seen:
            continue
        seen.add(prediction.skill_id)
        unique.append(prediction)
        if len(unique) >= 3:
            break
    return unique


def validate_inference(
    payload: LlmSkillInferenceResult,
    *,
    task_title: str,
    task_description: str,
    catalog: SkillCatalog,
) -> ValidatedSkillInferenceResult:
    predictions: list[ValidatedSkillPrediction] = []
    if not payload.insufficient_context:
        for item in dedupe_predictions(payload.predictions):
            skill = catalog.get(item.skill_id)
            if not skill:
                continue
            if not evidence_is_valid(item.evidence, task_title, task_description):
                continue
            predictions.append(
                ValidatedSkillPrediction(
                    skill_id=item.skill_id,
                    wef_skill_id=skill.wef_skill_id,
                    confidence=_confidence_band(item.confidence),  # type: ignore[arg-type]
                    confidence_score=item.confidence,
                    evidence=item.evidence,
                    reason=item.reason,
                )
            )
    return ValidatedSkillInferenceResult(
        task_id=payload.task_id,
        insufficient_context=payload.insufficient_context,
        predictions=predictions,
        model_version=payload.model_version,
        prompt_version=payload.prompt_version,
        taxonomy_version=payload.taxonomy_version,
        llm_ready=True,
    )


def service_unavailable(task_id: str, *, model_version: str, prompt_version: str) -> ValidatedSkillInferenceResult:
    return ValidatedSkillInferenceResult(
        task_id=task_id,
        insufficient_context=False,
        predictions=[],
        model_version=model_version,
        prompt_version=prompt_version,
        llm_ready=False,
        reject_reason="service_unavailable",
    )
