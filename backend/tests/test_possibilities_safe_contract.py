from __future__ import annotations

from pydantic import ValidationError
import pytest

from app.schemas.possibilities import (
    PossibilitiesResponse,
    PossibilityDirection,
    PossibilityShortlistRequest,
    PossibilitySkill,
)
from app.services.possibilities import (
    classify_skill_state,
    filter_allowed_directions,
    recommend_occupations,
    skill_overlap_score,
    slugify_skill_name,
    validate_shortlist_ids,
)


def test_skill_state_precedence_is_have_learning_shortlisted_missing() -> None:
    assert classify_skill_state(has_skill=True, learning=True, shortlisted=True) == 'have'
    assert classify_skill_state(has_skill=False, learning=True, shortlisted=True) == 'learning'
    assert classify_skill_state(has_skill=False, learning=False, shortlisted=True) == 'shortlisted'
    assert classify_skill_state(has_skill=False, learning=False, shortlisted=False) == 'missing'


def test_shortlist_accepts_only_unique_allowlisted_wef_ids() -> None:
    assert validate_shortlist_ids([1, 3, 1], allowed_skill_ids={1, 2, 3}, limit=5) == [1, 3]

    with pytest.raises(ValueError, match='unknown WEF skill'):
        validate_shortlist_ids([1, 99], allowed_skill_ids={1, 2, 3}, limit=5)

    with pytest.raises(ValueError, match='too many'):
        validate_shortlist_ids([1, 2, 3], allowed_skill_ids={1, 2, 3}, limit=2)


def test_direction_filter_cannot_return_codes_outside_server_allowlist() -> None:
    rows = [
        {'occupation_code': '2512', 'title': 'Provider changed title', 'confidence': 0.9},
        {'occupation_code': 'invented', 'title': 'Invented', 'confidence': 1.0},
    ]
    allowed = {'2512': {'title': 'Software developers', 'description': 'Build software'}}

    assert filter_allowed_directions(rows, allowed) == [
        {
            'occupation_code': '2512',
            'title': 'Software developers',
            'description': 'Build software',
            'confidence': 0.9,
        }
    ]


def test_direction_filter_skips_malformed_or_non_finite_confidence() -> None:
    rows = [
        {'occupation_code': 'bad', 'confidence': 'not-a-number'},
        {'occupation_code': 'nan', 'confidence': float('nan')},
        {'occupation_code': 'inf', 'confidence': float('inf')},
        {'occupation_code': 'ok', 'confidence': 0.4},
    ]
    allowed = {
        code: {'title': code.upper(), 'description': ''}
        for code in ('bad', 'nan', 'inf', 'ok')
    }

    assert filter_allowed_directions(rows, allowed) == [
        {
            'occupation_code': 'ok',
            'title': 'OK',
            'description': '',
            'confidence': 0.4,
        }
    ]


def test_shortlist_request_and_response_require_strict_positive_integer_ids() -> None:
    assert PossibilityShortlistRequest(skill_ids=[1, 2]).skill_ids == [1, 2]
    for invalid in ([True], [0], [-1], ['2']):
        with pytest.raises(ValidationError):
            PossibilityShortlistRequest(skill_ids=invalid)
        with pytest.raises(ValidationError):
            PossibilitiesResponse(
                disclaimer='Exploratory only.',
                source='live',
                status='ready',
                shortlisted_skill_ids=invalid,
            )


def test_shortlist_validator_rejects_non_integer_identifiers() -> None:
    for invalid in ([True], ['1'], [1.0], [0], [-1]):
        with pytest.raises(ValueError):
            validate_shortlist_ids(invalid, allowed_skill_ids={1}, limit=3)


def test_skill_names_are_normalized_to_safe_slugs() -> None:
    assert slugify_skill_name('Resilience, flexibility and agility') == 'resilience-flexibility-and-agility'
    assert slugify_skill_name('Reading, writing and mathematics') == 'reading-writing-and-mathematics'


def test_response_contract_rejects_demo_skill_ids_and_bounds_scores() -> None:
    valid = PossibilitiesResponse(
        contract_version='1',
        score_semantics='direction_skill_coverage',
        disclaimer='Exploratory skill connections only; not job readiness or hiring probability.',
        source='live',
        status='ready',
        current_role=None,
        current_role_coverage_pct=None,
        skills=[PossibilitySkill(skill_id=1, skill_slug='analytical-thinking', name='Analytical thinking', state='have')],
        directions=[],
        chosen_direction_code=None,
        shortlisted_skill_ids=[],
    )
    assert valid.source == 'live'

    with pytest.raises(ValidationError):
        PossibilitySkill(skill_id=1, skill_slug='demo-communication', name='Communication', state='missing')

    with pytest.raises(ValidationError):
        PossibilityDirection(
            occupation_code='2512',
            title='Software developers',
            description='',
            coverage_pct=101,
            skills=[],
        )


def test_recommendations_rank_real_occupations_by_confirmed_skill_overlap() -> None:
    occupations = [
        {
            'occupation_code': '100',
            'title': 'First',
            'description': 'Lead teams and analyse problems',
            'tasks': [
                'analyse data and problem solving',
                'lead a team and supervising staff',
                'mentor and coaching new staff',
            ],
        },
        {
            'occupation_code': '200',
            'title': 'Second',
            'description': 'Analyse business data and write reports for managers',
            'tasks': [
                'analyse data carefully',
                'write reports and documentation',
                'check calculations and budget records',
            ],
        },
        {
            'occupation_code': 'fake',
            'title': 'No mapping',
            'tasks': ['holiday cooking'],
        },
        {
            'occupation_code': 'current',
            'title': 'Current role',
            'tasks': ['analyse data', 'lead a team'],
        },
    ]
    skills = {
        1: {'core_skill': 'Analytical thinking'},
        3: {'core_skill': 'Leadership'},
        16: {'core_skill': 'Teaching and mentoring'},
        21: {'core_skill': 'Reading, writing and mathematics'},
    }
    result = recommend_occupations(
        occupations, {1, 3}, skills, exclude_codes={'current'}
    )
    assert [row['occupation_code'] for row in result] == ['100', '200']
    assert 'current' not in {row['occupation_code'] for row in result}
    assert result[0]['coverage_pct'] >= result[1]['coverage_pct']
    assert len(result[0]['required_skill_ids']) >= 2
    assert {1, 3}.issubset(result[0]['required_skill_ids'])


def test_recommendations_exclude_current_role_before_applying_limit() -> None:
    occupations = [
        {'occupation_code': '100', 'title': 'Current', 'tasks': ['analyse data', 'lead a team']},
        {'occupation_code': '200', 'title': 'Alternative', 'tasks': ['analyse data', 'writing reports']},
    ]
    skills = {1: {'core_skill': 'Analytical thinking'}, 3: {'core_skill': 'Leadership'}, 21: {'core_skill': 'Reading, writing and mathematics'}}

    result = recommend_occupations(
        occupations,
        {1, 3},
        skills,
        limit=1,
        exclude_codes={'100'},
    )

    assert [row['occupation_code'] for row in result] == ['200']


def test_skill_overlap_score_penalizes_narrow_one_skill_matches() -> None:
    assert skill_overlap_score({1, 2, 3}, {3}) == 50
    assert skill_overlap_score({1, 2}, {1, 2}) == 100
    assert skill_overlap_score({1, 2}, {3, 4}) == 0
    assert skill_overlap_score(set(), {1}) == 0


def test_chosen_direction_score_does_not_count_shortlisted_skills_as_owned() -> None:
    from app.services.possibilities import chosen_direction_score

    assert chosen_direction_score({1, 2}, {1, 2, 3, 4}) == 67


def test_direction_payload_maps_database_industry_to_schema_area() -> None:
    from app.routers.possibilities import build_direction_payload

    payload = build_direction_payload(
        {'occupation_code': '2512', 'title': 'Software developers', 'industry': 'ICT', 'description': 'Build software', 'coverage_pct': 50, 'required_skill_ids': []},
        {},
    )
    assert payload == {
        'occupation_code': '2512',
        'title': 'Software developers',
        'area': 'ICT',
        'description': 'Build software',
        'coverage_pct': 50,
        'skills': [],
    }


def test_needs_profile_response_can_be_explicitly_empty() -> None:
    response = PossibilitiesResponse(
        contract_version='1',
        score_semantics='direction_skill_coverage',
        disclaimer='Exploratory skill connections only; not job readiness or hiring probability.',
        source='live',
        status='needs_profile',
        current_role=None,
        current_role_coverage_pct=None,
        skills=[],
        directions=[],
        chosen_direction_code=None,
        shortlisted_skill_ids=[],
    )
    assert response.status == 'needs_profile'
    assert response.directions == []
