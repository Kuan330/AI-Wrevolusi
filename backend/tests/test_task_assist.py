from fastapi.testclient import TestClient

from app.main import create_app


def test_task_assist_returns_deterministic_reply_without_provider() -> None:
    application = create_app('/api')
    with TestClient(application) as client:
        response = client.post(
            '/api/v1/ai/task-assist',
            json={
                'task_text': 'Planning objectives for the organisation.',
                'user_message': 'How can AI assist me in completing this task?',
                'notes': '',
            },
        )
    assert response.status_code == 200
    body = response.json()
    assert isinstance(body['reply'], str)
    assert 'Planning objectives' in body['reply'] or 'draft' in body['reply'].lower()
