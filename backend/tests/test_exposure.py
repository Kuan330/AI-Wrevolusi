from fastapi.testclient import TestClient

from app.constants.exposure_types import ExposureType
from app.db.session import get_db
from app.main import create_app
from app.schemas.exposure import (
    ConfirmedTaskAssessmentContextInput,
    ConfirmedTaskExposureAssessmentRequestItem,
)
from app.services.exposure import (
    IloTaskExposureReference,
    assess_confirmed_task_against_ilo_references,
    infer_exposure_state,
    map_adjusted_exposure_score_to_suggested_state,
)


SHOP_SUPERVISOR_REFERENCE_TASKS = [
    IloTaskExposureReference(
        ilo_task_id='1',
        task_text='Planning and preparing work schedules and assigning staff to specific duties;',
        score_2025=0.525,
        source_method='predicted',
        potential25='Exposed: Gradient 3',
    ),
    IloTaskExposureReference(
        ilo_task_id='2',
        task_text='Instructing staff on sales procedures and handling difficult cases;',
        score_2025=0.365,
        source_method='predicted',
        potential25='Minimal Exposure',
    ),
    IloTaskExposureReference(
        ilo_task_id='3',
        task_text='Ensuring that customers receive prompt service;',
        score_2025=0.515,
        source_method='predicted',
        potential25='Exposed: Gradient 3',
    ),
]


class FakeIloTaskExposureReferenceQueryResult:
    def mappings(self) -> 'FakeIloTaskExposureReferenceQueryResult':
        return self

    def all(self) -> list[dict]:
        return [
            {
                'task_id': reference_task.ilo_task_id,
                'task_text': reference_task.task_text,
                'score_2025': reference_task.score_2025,
                'source': reference_task.source_method,
                'potential25': reference_task.potential25,
            }
            for reference_task in SHOP_SUPERVISOR_REFERENCE_TASKS
        ]


class FakeIloTaskExposureReferenceDatabaseSession:
    async def execute(self, *_args, **_kwargs) -> FakeIloTaskExposureReferenceQueryResult:
        return FakeIloTaskExposureReferenceQueryResult()


def test_batch_task_exposure_assessment_route_is_published() -> None:
    assert '/api/v1/exposure/assessments' in create_app('/api').openapi()['paths']


def test_batch_task_exposure_assessment_endpoint_returns_explainable_result() -> None:
    application = create_app('/api')

    async def provide_fake_ilo_task_exposure_reference_database_session():
        yield FakeIloTaskExposureReferenceDatabaseSession()

    application.dependency_overrides[get_db] = (
        provide_fake_ilo_task_exposure_reference_database_session
    )
    with TestClient(application) as client:
        response = client.post(
            '/api/v1/exposure/assessments',
            json={
                'occupation_code': '5222',
                'confirmed_tasks': [
                    {
                        'task_id': 'task-api-1',
                        'task_text': SHOP_SUPERVISOR_REFERENCE_TASKS[0].task_text,
                        'ilo_task_id': '1',
                        'context': {},
                    }
                ],
            },
        )

    assert response.status_code == 200
    assessment = response.json()['assessments'][0]
    assert assessment['task_id'] == 'task-api-1'
    assert assessment['match_layer'] == 'exact'
    assert assessment['potential25'] == 'Exposed: Gradient 3'
    assert assessment['reasoning']
    assert assessment['uncertainty']
    assert assessment['limitations']


def test_adjusted_exposure_score_boundaries_map_to_the_four_supported_states() -> None:
    assert map_adjusted_exposure_score_to_suggested_state(0.24) == ExposureType.human_led
    assert map_adjusted_exposure_score_to_suggested_state(0.25) == ExposureType.ai_assisted
    assert map_adjusted_exposure_score_to_suggested_state(0.26) == ExposureType.ai_assisted
    assert map_adjusted_exposure_score_to_suggested_state(0.4) == ExposureType.partly_automated
    assert map_adjusted_exposure_score_to_suggested_state(0.55) == ExposureType.reshaped


def test_infer_exposure_for_reporting_task() -> None:
    exposure, confidence, _ = infer_exposure_state('Prepare weekly sales report')
    assert exposure == ExposureType.partly_automated
    assert confidence > 0.5


def test_exact_ilo_task_uses_exact_match_layer_and_source_score() -> None:
    assessment = assess_confirmed_task_against_ilo_references(
        ConfirmedTaskExposureAssessmentRequestItem(
            task_id='task-1',
            task_text=SHOP_SUPERVISOR_REFERENCE_TASKS[0].task_text,
            ilo_task_id='1',
        ),
        SHOP_SUPERVISOR_REFERENCE_TASKS,
    )

    assert assessment.match_layer == 'exact'
    assert assessment.baseline_score == 0.525
    assert assessment.suggested_state == ExposureType.partly_automated
    assert assessment.matched_reference_tasks[0].similarity == 1.0
    assert assessment.potential25 == 'Exposed: Gradient 3'


def test_edited_task_uses_nlp_similarity_instead_of_stale_exact_score() -> None:
    assessment = assess_confirmed_task_against_ilo_references(
        ConfirmedTaskExposureAssessmentRequestItem(
            task_id='task-2',
            task_text='Prepare staff work schedules and assign duties for each shift',
            ilo_task_id='1',
        ),
        SHOP_SUPERVISOR_REFERENCE_TASKS,
    )

    assert assessment.match_layer == 'nlp'
    assert assessment.confidence >= 0.18
    assert assessment.matched_reference_tasks[0].ilo_task_id == '1'


def test_unrelated_task_returns_insufficient_data_instead_of_forced_classification() -> None:
    assessment = assess_confirmed_task_against_ilo_references(
        ConfirmedTaskExposureAssessmentRequestItem(
            task_id='task-3',
            task_text='Tune guitars and perform songs at a wedding',
        ),
        SHOP_SUPERVISOR_REFERENCE_TASKS,
    )

    assert assessment.suggested_state == ExposureType.insufficient_data
    assert assessment.match_layer == 'insufficient_data'
    assert assessment.missing_data_status == 'no_reliable_match'


def test_workplace_context_changes_the_exposure_score_transparently() -> None:
    routine_assessment = assess_confirmed_task_against_ilo_references(
        ConfirmedTaskExposureAssessmentRequestItem(
            task_id='task-4',
            task_text=SHOP_SUPERVISOR_REFERENCE_TASKS[1].task_text,
            ilo_task_id='2',
            context=ConfirmedTaskAssessmentContextInput(
                routine_processing_level='high',
                information_use_level='high',
                human_interaction_level='low',
                judgement_level='low',
                responsibility_level='individual',
            ),
        ),
        SHOP_SUPERVISOR_REFERENCE_TASKS,
    )
    judgement_assessment = assess_confirmed_task_against_ilo_references(
        ConfirmedTaskExposureAssessmentRequestItem(
            task_id='task-5',
            task_text=SHOP_SUPERVISOR_REFERENCE_TASKS[1].task_text,
            ilo_task_id='2',
            context=ConfirmedTaskAssessmentContextInput(
                routine_processing_level='low',
                information_use_level='low',
                human_interaction_level='high',
                judgement_level='high',
                responsibility_level='lead',
            ),
        ),
        SHOP_SUPERVISOR_REFERENCE_TASKS,
    )

    assert routine_assessment.adjusted_score > judgement_assessment.adjusted_score
    assert routine_assessment.missing_data_status == 'complete'
    assert judgement_assessment.missing_data_status == 'complete'
