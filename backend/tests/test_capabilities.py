from fastapi.testclient import TestClient

from app.constants.exposure_types import ExposureType
from app.db.session import get_db
from app.main import create_app
from app.ml.capability_text_matcher import (
    CAPABILITY_TEXT_MATCHER_VERSION,
    WefCapabilityProfile,
    match_task_texts_to_wef_capability_profiles,
)
from app.models.capability import CapabilityEvolution
from app.services.capabilities import suggest_capability_evolution_from_task_exposure_states


PILOT_CAPABILITY_PROFILES = [
    WefCapabilityProfile(7, 'Empathy and active listening', 'Working with others'),
    WefCapabilityProfile(10, 'Service orientation and customer service', 'Engagement skills'),
    WefCapabilityProfile(13, 'Resource management and operations', 'Working with others'),
    WefCapabilityProfile(14, 'Dependability and attention to detail', 'Self-efficacy'),
]


class FakeWefCapabilityProfileQueryResult:
    def mappings(self) -> 'FakeWefCapabilityProfileQueryResult':
        return self

    def all(self) -> list[dict]:
        return [
            {
                'wef_skill_id': profile.wef_skill_id,
                'core_skill': profile.core_skill,
                'wef_skill_group': profile.wef_skill_group,
            }
            for profile in PILOT_CAPABILITY_PROFILES
        ]


class FakeWefCapabilityProfileDatabaseSession:
    async def execute(self, *_args, **_kwargs) -> FakeWefCapabilityProfileQueryResult:
        return FakeWefCapabilityProfileQueryResult()


def test_tfidf_matcher_links_customer_service_wording_to_reviewed_wef_profiles() -> None:
    matches = match_task_texts_to_wef_capability_profiles(
        ['Ensure that customers receive prompt service and listen to their needs'],
        PILOT_CAPABILITY_PROFILES,
    )[0]

    assert {match.profile.wef_skill_id for match in matches} == {10, 7}
    assert matches[0].similarity >= matches[1].similarity >= 0.10


def test_tfidf_matcher_abstains_for_unsupported_wording() -> None:
    matches = match_task_texts_to_wef_capability_profiles(
        ['Tune guitars and perform songs at a wedding'],
        PILOT_CAPABILITY_PROFILES,
    )[0]

    assert matches == []


def test_tfidf_matcher_is_stable_under_case_and_punctuation_changes() -> None:
    original, reformatted = match_task_texts_to_wef_capability_profiles(
        [
            'Ensure that customers receive prompt service and listen to their needs.',
            'ENSURE THAT CUSTOMERS RECEIVE PROMPT SERVICE AND LISTEN TO THEIR NEEDS',
        ],
        PILOT_CAPABILITY_PROFILES,
    )

    assert [match.profile.wef_skill_id for match in original] == [
        match.profile.wef_skill_id for match in reformatted
    ]


def test_tfidf_matcher_does_not_change_for_man_or_woman_prefixes() -> None:
    woman_matches, man_matches = match_task_texts_to_wef_capability_profiles(
        [
            'A woman performs this task: Ensure customers receive prompt service',
            'A man performs this task: Ensure customers receive prompt service',
        ],
        PILOT_CAPABILITY_PROFILES,
    )

    assert [match.profile.wef_skill_id for match in woman_matches] == [
        match.profile.wef_skill_id for match in man_matches
    ]
    assert [match.similarity for match in woman_matches] == [
        match.similarity for match in man_matches
    ]


def test_epic2_states_drive_only_the_transparent_evolution_rule() -> None:
    assert suggest_capability_evolution_from_task_exposure_states(
        [ExposureType.partly_automated]
    ) == CapabilityEvolution.needs_strengthening
    assert suggest_capability_evolution_from_task_exposure_states(
        [ExposureType.reshaped]
    ) == CapabilityEvolution.needs_updating
    assert suggest_capability_evolution_from_task_exposure_states(
        [ExposureType.insufficient_data]
    ) is None


def test_capability_recognition_endpoint_returns_versioned_evidence() -> None:
    application = create_app('/api')

    async def provide_fake_wef_capability_profile_database_session():
        yield FakeWefCapabilityProfileDatabaseSession()

    application.dependency_overrides[get_db] = (
        provide_fake_wef_capability_profile_database_session
    )
    with TestClient(application) as client:
        response = client.post(
            '/api/v1/capabilities/recognize',
            json={
                'confirmed_tasks': [
                    {
                        'task_id': 'christine-task-1',
                        'task_text': 'Ensuring that customers receive prompt service',
                        'exposure_state': 'partly_automated',
                    }
                ]
            },
        )

    assert response.status_code == 200
    payload = response.json()
    assert payload['capabilities'][0]['wef_skill_id'] == 10
    assert payload['capabilities'][0]['model_version'] == CAPABILITY_TEXT_MATCHER_VERSION
    assert payload['capabilities'][0]['suggested_evolution'] == 'needs_strengthening'
    assert payload['capabilities'][0]['confirmation_status'] == 'requires_user_confirmation'
    assert payload['capabilities'][0]['task_evidence'][0]['task_id'] == 'christine-task-1'
