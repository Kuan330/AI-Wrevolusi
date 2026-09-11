from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import create_app


def test_skill_direction_analysis_reports_missing_model_configuration() -> None:
    previous_key = settings.skill_llm_api_key
    settings.skill_llm_api_key = None
    try:
        client = TestClient(create_app())
        response = client.post(
            '/api/v1/skill-directions/analyse',
            json={
                'occupation_title': 'Sales and Marketing Managers',
                'skills': [
                    {
                        'skill_id': 1,
                        'skill_name': 'Analytical thinking',
                        'direction': 'keep_building',
                        'supporting_tasks': ['Review sales performance and budgets'],
                        'current_importance_pct': 69,
                        'future_outlook_points': 55,
                        'genai_capacity': 'Low',
                    }
                ],
            },
        )
    finally:
        settings.skill_llm_api_key = previous_key

    assert response.status_code == 503
    assert 'SKILL_LLM_API_KEY' in response.json()['detail']
