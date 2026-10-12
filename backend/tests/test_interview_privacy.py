"""Synthetic response privacy checks; no database, live AI or credentials."""
import uuid
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import create_app
from app.routers.accounts import current_account
from app.routers.interview import _optional_provider
from app.routers.resume import get_resume_provider
from app.schemas.interview import QuestionBankResponse
from app.services.auth import AuthService, get_current_user


MARKER = "SYNTHETIC-PRIVATE-INPUT"


@pytest.fixture
def private_client(monkeypatch):
    app = create_app()
    user = SimpleNamespace(id=uuid.uuid4(), email="synthetic@example.com",
                           full_name="Synthetic person", is_active=True, occupation_id=None)
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[current_account] = lambda: SimpleNamespace(
        user_id=user.id, username="synthetic", workspace={}, revision=0)
    app.dependency_overrides[get_db] = lambda: None
    app.dependency_overrides[_optional_provider] = lambda: None
    app.dependency_overrides[get_resume_provider] = lambda: None
    monkeypatch.setattr(AuthService, "refresh", AsyncMock(return_value=("synthetic-access", "synthetic-refresh")))
    monkeypatch.setattr("app.routers.interview.bank_for_occupation", AsyncMock(
        return_value=QuestionBankResponse(occupation_code="3115", matched="common", questions=[])))
    with TestClient(app) as client:
        yield client


@pytest.mark.parametrize("path,payload", [
    ("/interview/feedback", {"question": {"text": "Describe your work."},
                             "answer": f"{MARKER} private@example.test"}),
    ("/interview/plan", {"role_title": MARKER, "count": 6}),
    ("/interview/plan", {MARKER: "private field name"}),
    ("/auth/login", {"email": "synthetic@example.test", "password": [MARKER]}),
    ("/account/login", {"username": MARKER, "password": [MARKER]}),
    ("/account/workspace", {"owner_id": MARKER, "data": {}, "revision": -1}),
    ("/users/me", {"full_name": [MARKER]}),
])
def test_invalid_sensitive_input_is_not_echoed(private_client, path, payload):
    method = "PATCH" if path in {"/account/workspace", "/users/me"} else "POST"
    response = private_client.request(method, f"/api/v1{path}", json=payload)
    assert response.status_code == 422
    assert MARKER not in response.text
    assert "private@example.test" not in response.text
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["code"] == "invalid_request"
    assert len(response.json()["fields"]) <= 5


@pytest.mark.parametrize("path", ["/auth/login", "/account/login", "/interview/feedback"])
def test_invalid_json_is_private(private_client, path):
    response = private_client.post(f"/api/v1{path}", content=f'{{"answer":"{MARKER}"',
                                   headers={"Content-Type": "application/json"})
    assert response.status_code == 422
    assert MARKER not in response.text
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("method,path,payload", [
    ("GET", "/account/me", None),
    ("GET", "/account/workspace", None),
    ("GET", "/users/me", None),
    ("GET", "/interview/question-bank?occupation_code=3115", None),
    ("POST", "/interview/plan", {"items": [], "count": 3}),
    ("POST", "/auth/refresh", None),
])
def test_unauthenticated_sensitive_response_is_not_cached(method, path, payload):
    with TestClient(create_app()) as client:
        response = client.request(method, f"/api/v1{path}", json=payload)
    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("method,path,payload", [
    ("GET", "/account/me", None),
    ("GET", "/account/workspace", None),
    ("GET", "/users/me", None),
    ("GET", "/interview/question-bank?occupation_code=3115", None),
    ("POST", "/interview/plan", {"items": [], "count": 3}),
    ("POST", "/auth/refresh", None),
])
def test_successful_sensitive_response_is_not_cached(private_client, method, path, payload):
    response = private_client.request(method, f"/api/v1{path}", json=payload)
    assert response.status_code == (204 if path == "/auth/refresh" else 200)
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("path", ["/interview/plan", "/account/me", "/users/me", "/auth/refresh"])
def test_unexpected_sensitive_errors_are_private(monkeypatch, path):
    app = create_app()

    def failed():
        raise RuntimeError(MARKER)

    app.dependency_overrides[get_db] = lambda: None
    app.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id=uuid.uuid4())
    if path == "/interview/plan":
        app.dependency_overrides[_optional_provider] = failed
    elif path == "/account/me":
        app.dependency_overrides[current_account] = failed
    elif path == "/users/me":
        app.dependency_overrides[get_current_user] = failed
    else:
        monkeypatch.setattr(AuthService, "refresh", AsyncMock(side_effect=RuntimeError(MARKER)))
    with TestClient(app, raise_server_exceptions=False) as client:
        method = "POST" if path in {"/interview/plan", "/auth/refresh"} else "GET"
        response = client.request(method, f"/api/v1{path}", json={"items": [], "count": 3})
    assert response.status_code == 500
    assert MARKER not in response.text
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["code"] == "internal_error"
