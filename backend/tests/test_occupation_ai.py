from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas.occupation_ai import (
    OccupationRecommendationsRequest,
    OccupationRecommendationsResponse,
    OccupationSuggestionsRequest,
    OccupationSuggestionsResponse,
)
from app.services.occupation_ai import recommend_occupations, suggest_occupations


SUGGESTION_CANDIDATES = [
    {
        'code': '2512',
        'title': 'Software developers',
        'description': 'Design, build, test, and maintain software applications.',
    },
    {
        'code': '2221',
        'title': 'Nursing professionals',
        'description': 'Provide patient care and support clinical treatment.',
    },
]


def test_suggestion_ranks_a_supplied_candidate_and_explains_the_match() -> None:
    request = OccupationSuggestionsRequest(
        user_description='I design and build software applications and debug code.',
        extracted={
            'actions': ['design', 'build', 'debug'],
            'objects': ['software applications', 'code'],
            'scope': ['product team'],
            'industry': ['technology'],
        },
        candidates=SUGGESTION_CANDIDATES,
    )

    result = suggest_occupations(request)

    assert result.status == 'suggestions'
    assert result.candidates[0].occupation_code == '2512'
    assert result.candidates[0].title == 'Software developers'
    assert result.candidates[0].confidence >= 0.5
    assert result.candidates[0].evidence
    assert result.candidates[0].difference
    assert result.clarifying_questions == []


def test_suggestions_return_questions_only_when_all_candidates_are_weak() -> None:
    result = suggest_occupations(
        OccupationSuggestionsRequest(
            user_description='Tune guitars and perform songs at weddings.',
            candidates=SUGGESTION_CANDIDATES,
        )
    )

    assert result.status == 'clarifying'
    assert result.candidates == []
    assert result.clarifying_questions


def test_suggestions_return_questions_only_for_an_empty_candidate_list() -> None:
    result = suggest_occupations(
        OccupationSuggestionsRequest(
            user_description='I design software applications.',
            candidates=[],
        )
    )

    assert result.status == 'clarifying'
    assert result.candidates == []
    assert result.clarifying_questions


def test_suggestions_preserve_exact_candidate_ids_titles_and_limit_results() -> None:
    candidates = [
        {
            'code': f'  exact-{index}  ',
            'title': f'Software developer {index}',
            'description': 'Design and develop software applications.',
        }
        for index in range(7)
    ]

    result = suggest_occupations(
        OccupationSuggestionsRequest(
            user_description='Design and develop software applications.',
            candidates=candidates,
        )
    )

    assert len(result.candidates) == 5
    assert result.candidates[0].occupation_code == '  exact-0  '
    assert result.candidates[0].title == 'Software developer 0'
    assert {item.occupation_code for item in result.candidates} <= {
        candidate['code'] for candidate in candidates
    }
    assert {item.title for item in result.candidates} <= {
        candidate['title'] for candidate in candidates
    }


def test_recommendations_rank_only_supplied_candidates_for_exploration() -> None:
    request = OccupationRecommendationsRequest(
        selected_occupation={
            'occupation_code': '2512',
            'title': 'Software developers',
        },
        user_context={
            'interests': ['analyse systems', 'technology'],
            'preferred_scope': 'software products',
        },
        candidates=[
            {
                'code': '2511',
                'title': 'Computer systems analysts',
                'why-similar': 'Both analyse software systems and technology requirements.',
            },
            {
                'code': '2221',
                'title': 'Nursing professionals',
                'why-similar': 'Works directly with patients in clinical settings.',
            },
        ],
    )

    result = recommend_occupations(request)

    assert result.status == 'suggestions'
    assert result.candidates[0].occupation_code == '2511'
    assert result.candidates[0].title == 'Computer systems analysts'
    assert any('exploration only' in item.casefold() for item in result.candidates[0].evidence)
    assert any('similarity' in item.casefold() for item in result.candidates[0].evidence)
    assert result.candidates[0].difference
    assert {item.occupation_code for item in result.candidates} <= {'2511', '2221'}


def test_recommendations_return_questions_only_when_no_candidate_is_reliable() -> None:
    result = recommend_occupations(
        OccupationRecommendationsRequest(
            selected_occupation={
                'occupation_code': '2512',
                'title': 'Software developers',
            },
            user_context={},
            candidates=[
                {
                    'code': '2221',
                    'title': 'Nursing professionals',
                    'why_similar': '',
                }
            ],
        )
    )

    assert result.status == 'clarifying'
    assert result.candidates == []
    assert result.clarifying_questions


def test_recommendations_preserve_exact_ids_and_limit_results() -> None:
    candidates = [
        {
            'code': f' alt-{index} ',
            'title': f'Software systems specialist {index}',
            'why_similar': 'Both work with software systems and applications.',
        }
        for index in range(8)
    ]

    result = recommend_occupations(
        OccupationRecommendationsRequest(
            selected_occupation={
                'occupation_code': '2512',
                'title': 'Software developers',
            },
            user_context='software systems applications',
            candidates=candidates,
        )
    )

    assert len(result.candidates) == 5
    assert result.candidates[0].occupation_code == ' alt-0 '
    assert {item.occupation_code for item in result.candidates} <= {
        candidate['code'] for candidate in candidates
    }


def test_occupation_routes_are_published_with_explicit_response_schemas() -> None:
    paths = create_app('/api').openapi()['paths']

    suggestions_schema = paths['/api/v1/ai/occupation-suggestions']['post'][
        'responses'
    ]['200']['content']['application/json']['schema']
    recommendations_schema = paths['/api/v1/ai/occupation-recommendations']['post'][
        'responses'
    ]['200']['content']['application/json']['schema']
    assert suggestions_schema['$ref'].endswith('/OccupationSuggestionsResponse')
    assert recommendations_schema['$ref'].endswith('/OccupationRecommendationsResponse')


def test_occupation_api_responses_validate_against_the_contract() -> None:
    application = create_app('/api')

    with TestClient(application) as client:
        suggestions_response = client.post(
            '/api/v1/ai/occupation-suggestions',
            json={
                'user_description': 'I design and build software applications.',
                'extracted': {
                    'actions': ['design', 'build'],
                    'objects': ['software applications'],
                    'scope': [],
                    'industry': ['technology'],
                },
                'candidates': SUGGESTION_CANDIDATES,
            },
        )
        recommendations_response = client.post(
            '/api/v1/ai/occupation-recommendations',
            json={
                'selected_occupation': {
                    'occupation_code': '2512',
                    'title': 'Software developers',
                },
                'user_context': {'interests': ['software systems']},
                'candidates': [
                    {
                        'code': '2511',
                        'title': 'Computer systems analysts',
                        'why_similar': 'Both analyse software systems.',
                    }
                ],
            },
        )

    assert suggestions_response.status_code == 200
    assert recommendations_response.status_code == 200
    OccupationSuggestionsResponse.model_validate(suggestions_response.json())
    parsed_recommendations = OccupationRecommendationsResponse.model_validate(
        recommendations_response.json()
    )
    assert parsed_recommendations.candidates
    assert any(
        'not hiring advice' in evidence.casefold()
        for evidence in parsed_recommendations.candidates[0].evidence
    )


def test_occupation_api_rejects_blank_required_text_and_oversized_candidate_lists() -> None:
    application = create_app('/api')

    with TestClient(application) as client:
        blank = client.post(
            '/api/v1/ai/occupation-suggestions',
            json={
                'user_description': '   ',
                'candidates': SUGGESTION_CANDIDATES,
            },
        )
        oversized = client.post(
            '/api/v1/ai/occupation-recommendations',
            json={
                'selected_occupation': {
                    'occupation_code': '2512',
                    'title': 'Software developers',
                },
                'user_context': {},
                'candidates': [
                    {
                        'code': str(index),
                        'title': 'Software specialist',
                        'why_similar': 'Both work with software.',
                    }
                    for index in range(501)
                ],
            },
        )

    assert blank.status_code == 422
    assert oversized.status_code == 422


def test_outputs_do_not_add_prohibited_predictions() -> None:
    result = suggest_occupations(
        OccupationSuggestionsRequest(
            user_description='Design and develop software applications.',
            candidates=SUGGESTION_CANDIDATES,
        )
    )
    rendered = result.model_dump_json().casefold()

    assert 'job loss' not in rendered
    assert 'skill gap' not in rendered
    assert 'will lose' not in rendered
