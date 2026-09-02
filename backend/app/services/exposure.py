import re
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.exposure_types import ExposureType
from app.ml.task_exposure_score_model import (
    calculate_reference_task_cosine_similarities_with_trained_vectorizer,
    predict_task_exposure_score_with_trained_text_model,
)
from app.schemas.exposure import (
    ConfirmedTaskAssessmentContextInput,
    ConfirmedTaskExposureAssessment,
    ConfirmedTaskExposureAssessmentBatchRequest,
    ConfirmedTaskExposureAssessmentBatchResponse,
    ConfirmedTaskExposureAssessmentRequestItem,
    MatchedIloTaskExposureEvidence,
)

ILO_EXPOSURE_SOURCE_NAME = 'Gmyrek et al. 2025 · ILO Working Paper 140'
ILO_EXPOSURE_SOURCE_YEAR = '2025'
ILO_EXPOSURE_SOURCE_URL = (
    'https://www.ilo.org/publications/'
    'generative-ai-and-jobs-refined-global-index-occupational-exposure'
)
# ponytail: pilot-calibrated threshold and context weights; replace with
# labelled-user calibration before expanding beyond the three pilot occupations.
MINIMUM_RELIABLE_TASK_TEXT_SIMILARITY = 0.18
MAXIMUM_MATCHED_REFERENCE_TASKS = 3


@dataclass(frozen=True)
class IloTaskExposureReference:
    ilo_task_id: str
    task_text: str
    score_2025: float | None
    source_method: str | None


def normalize_task_text_for_matching(task_text: str) -> str:
    return ' '.join(re.findall(r'[a-z0-9]+', task_text.lower()))


def rank_ilo_reference_tasks_by_semantic_similarity(
    task_text: str,
    ilo_reference_tasks: list[IloTaskExposureReference],
) -> list[tuple[IloTaskExposureReference, float]]:
    scorable_reference_tasks = [
        reference_task
        for reference_task in ilo_reference_tasks
        if reference_task.score_2025 is not None and reference_task.task_text.strip()
    ]
    if not scorable_reference_tasks:
        return []
    reference_task_similarities = (
        calculate_reference_task_cosine_similarities_with_trained_vectorizer(
            task_text,
            [reference_task.task_text for reference_task in scorable_reference_tasks],
        )
    )
    ranked_reference_tasks = list(zip(scorable_reference_tasks, reference_task_similarities))
    return sorted(ranked_reference_tasks, key=lambda item: item[1], reverse=True)


def calculate_transparent_context_score_adjustment(
    context: ConfirmedTaskAssessmentContextInput,
) -> tuple[float, list[str], bool]:
    level_multiplier = {'low': 0.25, 'medium': 0.6, 'high': 1.0}
    context_adjustment_rules = [
        ('routine processing', context.routine_processing_level, 0.06),
        ('information use', context.information_use_level, 0.04),
        ('human interaction', context.human_interaction_level, -0.05),
        ('judgement', context.judgement_level, -0.07),
    ]
    adjustment = 0.0
    described_context_factors: list[str] = []
    for label, level, maximum_adjustment in context_adjustment_rules:
        if level is None:
            continue
        adjustment += maximum_adjustment * level_multiplier[level]
        described_context_factors.append(f'{label}: {level}')

    responsibility_adjustments = {'individual': 0.0, 'shared': -0.02, 'lead': -0.04}
    if context.responsibility_level is not None:
        adjustment += responsibility_adjustments[context.responsibility_level]
        described_context_factors.append(f'responsibility: {context.responsibility_level}')

    expected_context_values = [
        context.routine_processing_level,
        context.information_use_level,
        context.human_interaction_level,
        context.judgement_level,
        context.responsibility_level,
    ]
    has_missing_context = any(value is None for value in expected_context_values)
    return adjustment, described_context_factors, has_missing_context


def map_adjusted_exposure_score_to_suggested_state(adjusted_score: float) -> ExposureType:
    if adjusted_score < 0.25:
        return ExposureType.human_led
    if adjusted_score < 0.4:
        return ExposureType.ai_assisted
    if adjusted_score < 0.55:
        return ExposureType.partly_automated
    return ExposureType.reshaped


def create_insufficient_data_task_exposure_assessment(
    confirmed_task: ConfirmedTaskExposureAssessmentRequestItem,
    missing_data_status: str,
    reasoning: str,
) -> ConfirmedTaskExposureAssessment:
    return ConfirmedTaskExposureAssessment(
        task_id=confirmed_task.task_id,
        suggested_state=ExposureType.insufficient_data,
        match_layer='insufficient_data',
        baseline_score=None,
        adjusted_score=None,
        confidence=0.0,
        model_version='not_applied',
        model_type='insufficient_data_abstention',
        source_name=ILO_EXPOSURE_SOURCE_NAME,
        source_year=ILO_EXPOSURE_SOURCE_YEAR,
        source_url=ILO_EXPOSURE_SOURCE_URL,
        reasoning=reasoning,
        uncertainty='High uncertainty because no reliable task-level evidence was found.',
        limitations=(
            'This result is an evidence gap, not a prediction about job replacement or '
            'the value of the user\'s work.'
        ),
        missing_data_status=missing_data_status,
        matched_reference_tasks=[],
    )


def assess_confirmed_task_against_ilo_references(
    confirmed_task: ConfirmedTaskExposureAssessmentRequestItem,
    ilo_reference_tasks: list[IloTaskExposureReference],
) -> ConfirmedTaskExposureAssessment:
    if not ilo_reference_tasks:
        return create_insufficient_data_task_exposure_assessment(
            confirmed_task,
            'missing_reference_tasks',
            'No checked MASCO-to-ISCO correspondence or ILO task evidence is available '
            'for the confirmed occupation.',
        )

    reference_task_by_id = {
        reference_task.ilo_task_id: reference_task for reference_task in ilo_reference_tasks
    }
    exact_reference_task = reference_task_by_id.get(confirmed_task.ilo_task_id or '')
    task_text_matches_exact_reference = bool(
        exact_reference_task
        and normalize_task_text_for_matching(confirmed_task.task_text)
        == normalize_task_text_for_matching(exact_reference_task.task_text)
    )

    if (
        task_text_matches_exact_reference
        and exact_reference_task is not None
        and exact_reference_task.score_2025 is not None
    ):
        matched_reference_tasks = [(exact_reference_task, 1.0)]
        baseline_score = float(exact_reference_task.score_2025)
        match_layer = 'exact'
        confidence = 0.95
        model_version = 'official-ilo-score-2025'
        model_type = 'exact_ilo_task_evidence'
    else:
        ranked_reference_tasks = rank_ilo_reference_tasks_by_semantic_similarity(
            confirmed_task.task_text,
            ilo_reference_tasks,
        )
        if (
            not ranked_reference_tasks
            or ranked_reference_tasks[0][1] < MINIMUM_RELIABLE_TASK_TEXT_SIMILARITY
        ):
            return create_insufficient_data_task_exposure_assessment(
                confirmed_task,
                'no_reliable_match',
                'The confirmed task wording was not sufficiently similar to the available ILO task evidence.',
            )
        matched_reference_tasks = ranked_reference_tasks[:MAXIMUM_MATCHED_REFERENCE_TASKS]
        trained_score_prediction = predict_task_exposure_score_with_trained_text_model(
            confirmed_task.task_text
        )
        baseline_score = trained_score_prediction.predicted_score_2025
        match_layer = 'nlp'
        confidence = min(0.9, matched_reference_tasks[0][1])
        model_version = trained_score_prediction.model_version
        model_type = trained_score_prediction.model_type

    context_adjustment, described_context_factors, has_missing_context = (
        calculate_transparent_context_score_adjustment(confirmed_task.context)
    )
    adjusted_score = min(1.0, max(0.0, baseline_score + context_adjustment))
    suggested_state = map_adjusted_exposure_score_to_suggested_state(adjusted_score)
    strongest_reference_task, strongest_similarity = matched_reference_tasks[0]
    context_summary = (
        ', '.join(described_context_factors)
        if described_context_factors
        else 'no optional workplace context was provided'
    )
    reasoning = (
        f'The {match_layer} assessment used {model_type} ({model_version}) and ILO task '
        f'evidence beginning "'
        f'{strongest_reference_task.task_text[:120]}" with similarity '
        f'{strongest_similarity:.2f}. The baseline score {baseline_score:.2f} was adjusted '
        f'to {adjusted_score:.2f} using {context_summary}.'
    )
    uncertainty = (
        'Low source-matching uncertainty; workplace variation can still change how the task is performed.'
        if match_layer == 'exact'
        else 'Moderate uncertainty because semantic wording similarity is not a verified one-to-one task match.'
    )
    if has_missing_context:
        uncertainty += ' Some optional context factors were not provided.'

    return ConfirmedTaskExposureAssessment(
        task_id=confirmed_task.task_id,
        suggested_state=suggested_state,
        match_layer=match_layer,
        baseline_score=round(baseline_score, 4),
        adjusted_score=round(adjusted_score, 4),
        confidence=round(confidence, 4),
        model_version=model_version,
        model_type=model_type,
        source_name=ILO_EXPOSURE_SOURCE_NAME,
        source_year=ILO_EXPOSURE_SOURCE_YEAR,
        source_url=ILO_EXPOSURE_SOURCE_URL,
        reasoning=reasoning,
        uncertainty=uncertainty,
        limitations=(
            'This is a task-level indication of possible transformation. It is not a prediction '
            'of job replacement, personal readiness, or an employment outcome.'
        ),
        missing_data_status='partial_context' if has_missing_context else 'complete',
        matched_reference_tasks=[
            MatchedIloTaskExposureEvidence(
                ilo_task_id=reference_task.ilo_task_id,
                task_text=reference_task.task_text,
                score_2025=float(reference_task.score_2025),
                similarity=round(similarity, 4),
                source_method=reference_task.source_method,
            )
            for reference_task, similarity in matched_reference_tasks
            if reference_task.score_2025 is not None
        ],
    )


async def load_ilo_task_exposure_references_for_occupation(
    db: AsyncSession,
    occupation_code: str,
) -> list[IloTaskExposureReference]:
    result = await db.execute(
        text(
            'SELECT task_id, task_text, score_2025, source '
            'FROM ref_ilo_tasks WHERE isco_08 = :occupation_code ORDER BY task_id'
        ),
        {'occupation_code': occupation_code},
    )
    return [
        IloTaskExposureReference(
            ilo_task_id=str(row['task_id']),
            task_text=row['task_text'],
            score_2025=row['score_2025'],
            source_method=row['source'],
        )
        for row in result.mappings().all()
    ]


async def assess_confirmed_tasks_against_ilo_references(
    db: AsyncSession,
    request: ConfirmedTaskExposureAssessmentBatchRequest,
) -> ConfirmedTaskExposureAssessmentBatchResponse:
    ilo_reference_tasks = await load_ilo_task_exposure_references_for_occupation(
        db,
        request.occupation_code,
    )
    return ConfirmedTaskExposureAssessmentBatchResponse(
        assessments=[
            assess_confirmed_task_against_ilo_references(confirmed_task, ilo_reference_tasks)
            for confirmed_task in request.confirmed_tasks
        ]
    )


def infer_exposure_state(task_text: str) -> tuple[ExposureType, float, str]:
    if len(normalize_task_text_for_matching(task_text).split()) < 3:
        return (
            ExposureType.insufficient_data,
            0.0,
            'Not enough task context to infer exposure reliably.',
        )
    trained_score_prediction = predict_task_exposure_score_with_trained_text_model(task_text)
    predicted_state = map_adjusted_exposure_score_to_suggested_state(
        trained_score_prediction.predicted_score_2025
    )
    return (
        predicted_state,
        0.5,
        f'The {trained_score_prediction.model_type} model '
        f'({trained_score_prediction.model_version}) predicted exposure score '
        f'{trained_score_prediction.predicted_score_2025:.2f}.',
    )
