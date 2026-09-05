import math
import re
from collections import Counter
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.constants.exposure_types import ExposureType
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
TASK_MATCHING_STOP_WORDS = {
    'a',
    'an',
    'and',
    'are',
    'at',
    'for',
    'from',
    'in',
    'is',
    'of',
    'on',
    'or',
    'that',
    'the',
    'this',
    'to',
    'with',
}


@dataclass(frozen=True)
class IloTaskExposureReference:
    ilo_task_id: str
    task_text: str
    score_2025: float | None
    source_method: str | None
    potential25: str | None = None


def normalize_task_text_for_matching(task_text: str) -> str:
    return ' '.join(re.findall(r'[a-z0-9]+', task_text.lower()))


def tokenize_task_text_for_term_frequency_inverse_document_frequency(
    task_text: str,
) -> list[str]:
    words = [
        word
        for word in normalize_task_text_for_matching(task_text).split()
        if word not in TASK_MATCHING_STOP_WORDS
    ]
    adjacent_word_pairs = [f'{first}__{second}' for first, second in zip(words, words[1:])]
    return [*words, *adjacent_word_pairs]


def build_inverse_document_frequency_by_term(reference_task_texts: list[str]) -> dict[str, float]:
    token_sets = [
        set(tokenize_task_text_for_term_frequency_inverse_document_frequency(task_text))
        for task_text in reference_task_texts
    ]
    document_count = len(token_sets)
    document_frequency_by_term: Counter[str] = Counter(
        term for token_set in token_sets for term in token_set
    )
    return {
        term: math.log((1 + document_count) / (1 + document_frequency)) + 1
        for term, document_frequency in document_frequency_by_term.items()
    }


def build_sparse_term_frequency_inverse_document_frequency_vector(
    task_text: str,
    inverse_document_frequency_by_term: dict[str, float],
) -> dict[str, float]:
    tokens = tokenize_task_text_for_term_frequency_inverse_document_frequency(task_text)
    if not tokens:
        return {}
    term_counts = Counter(tokens)
    token_count = len(tokens)
    return {
        term: (count / token_count) * inverse_document_frequency_by_term[term]
        for term, count in term_counts.items()
        if term in inverse_document_frequency_by_term
    }


def calculate_cosine_similarity_between_sparse_vectors(
    first_vector: dict[str, float],
    second_vector: dict[str, float],
) -> float:
    if not first_vector or not second_vector:
        return 0.0
    shared_terms = first_vector.keys() & second_vector.keys()
    dot_product = sum(first_vector[term] * second_vector[term] for term in shared_terms)
    first_magnitude = math.sqrt(sum(value * value for value in first_vector.values()))
    second_magnitude = math.sqrt(sum(value * value for value in second_vector.values()))
    if first_magnitude == 0 or second_magnitude == 0:
        return 0.0
    return dot_product / (first_magnitude * second_magnitude)


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
    inverse_document_frequency_by_term = build_inverse_document_frequency_by_term(
        [reference_task.task_text for reference_task in scorable_reference_tasks]
    )
    task_vector = build_sparse_term_frequency_inverse_document_frequency_vector(
        task_text,
        inverse_document_frequency_by_term,
    )
    ranked_reference_tasks = [
        (
            reference_task,
            calculate_cosine_similarity_between_sparse_vectors(
                task_vector,
                build_sparse_term_frequency_inverse_document_frequency_vector(
                    reference_task.task_text,
                    inverse_document_frequency_by_term,
                ),
            ),
        )
        for reference_task in scorable_reference_tasks
    ]
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
        potential25=None,
        match_layer='insufficient_data',
        baseline_score=None,
        adjusted_score=None,
        confidence=0.0,
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
            'No ILO reference tasks are available for the confirmed occupation.',
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
        similarity_total = sum(similarity for _, similarity in matched_reference_tasks)
        baseline_score = sum(
            float(reference_task.score_2025) * similarity
            for reference_task, similarity in matched_reference_tasks
            if reference_task.score_2025 is not None
        ) / similarity_total
        match_layer = 'nlp'
        confidence = min(0.9, matched_reference_tasks[0][1])

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
        f'The {match_layer} match used ILO task evidence beginning "'
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
        potential25=strongest_reference_task.potential25,
        match_layer=match_layer,
        baseline_score=round(baseline_score, 4),
        adjusted_score=round(adjusted_score, 4),
        confidence=round(confidence, 4),
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
            'SELECT task_id, task_text, score_2025, potential25, source '
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
            potential25=row.get('potential25'),
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
    normalized = task_text.lower()

    reshaped_keywords = ['strategy', 'planning', 'cross-team', 'coach']
    automated_keywords = ['report', 'data entry', 'spreadsheet', 'email sorting']
    assisted_keywords = ['draft', 'review', 'summarise', 'support']

    if any(keyword in normalized for keyword in reshaped_keywords):
        return (
            ExposureType.reshaped,
            0.72,
            'Task likely shifts toward judgement and orchestration with AI co-work.',
        )

    if any(keyword in normalized for keyword in automated_keywords):
        return (
            ExposureType.partly_automated,
            0.78,
            'Task includes routine steps that can be automated, while validation stays human-led.',
        )

    if any(keyword in normalized for keyword in assisted_keywords):
        return (
            ExposureType.ai_assisted,
            0.64,
            'Task can be accelerated by AI suggestions but still needs human review.',
        )

    if len(normalized.strip()) < 8:
        return (
            ExposureType.insufficient_data,
            0.2,
            'Not enough task context to infer exposure reliably.',
        )

    return (
        ExposureType.human_led,
        0.58,
        'Task appears to rely on context-heavy interpersonal judgement.',
    )
