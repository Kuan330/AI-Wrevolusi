from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.skills.catalog import load_catalog
from app.skills.providers.base import SkillInferenceProvider
from app.skills.schemas import LlmSkillInferenceResult, LlmSkillPrediction, SkillTaskInput
from app.skills.service import SkillInferenceService
from app.skills.validation import evidence_is_valid, validate_inference


class StubSkillProvider(SkillInferenceProvider):
    def __init__(self, payload: LlmSkillInferenceResult) -> None:
        self._payload = payload

    @property
    def model_version(self) -> str:
        return "stub-model"

    @property
    def ready(self) -> bool:
        return True

    def infer_skills(self, task: SkillTaskInput) -> LlmSkillInferenceResult:
        return self._payload.model_copy(update={"task_id": task.task_id})


def test_evidence_must_be_exact_substring() -> None:
    assert evidence_is_valid("compare complaint categories", "Review complaint trends", "compare complaint categories")
    assert not evidence_is_valid("complaint trend analysis", "Review complaint trends", "compare complaint categories")


def test_validate_inference_dedupes_and_maps_wef_ids() -> None:
    catalog = load_catalog()
    payload = LlmSkillInferenceResult(
        task_id="TASK-TEST",
        model_version="stub-model",
        prompt_version="skill-inference-prompt-v1",
        insufficient_context=False,
        predictions=[
            LlmSkillPrediction(
                skill_id="WEF-01",
                confidence=0.91,
                evidence="compare complaint categories",
                reason="analysis verb present",
            ),
            LlmSkillPrediction(
                skill_id="WEF-01",
                confidence=0.80,
                evidence="compare complaint categories",
                reason="duplicate",
            ),
        ],
    )
    result = validate_inference(
        payload,
        task_title="Review complaint trends",
        task_description="compare complaint categories and identify recurring causes",
        catalog=catalog,
    )
    assert len(result.predictions) == 1
    assert result.predictions[0].wef_skill_id == 1
    assert result.predictions[0].confidence == "identified"


def test_skill_estimate_api_with_stub_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    stub = StubSkillProvider(
        LlmSkillInferenceResult(
            task_id="client-1",
            model_version="stub-model",
            prompt_version="skill-inference-prompt-v1",
            insufficient_context=False,
            predictions=[
                LlmSkillPrediction(
                    skill_id="WEF-01",
                    confidence=0.66,
                    evidence="compare complaint categories",
                    reason="analysis",
                )
            ],
        )
    )
    monkeypatch.setattr(
        "app.services.skill_inference.get_skill_inference_service",
        lambda: SkillInferenceService(provider=stub),
    )
    client = TestClient(app)
    response = client.post(
        "/api/v1/skills/estimate",
        json={
            "tasks": [
                {
                    "client_task_id": "client-1",
                    "task_title": "Review complaint trends",
                    "task_description": "compare complaint categories and identify recurring causes",
                    "occupation": "Customer Service Executive",
                }
            ]
        },
    )
    assert response.status_code == 200
    body = response.json()
    assert body["llm_ready"] is True
    assert body["results"][0]["predictions"][0]["wef_skill_id"] == 1
    assert body["results"][0]["predictions"][0]["confidence"] == "possible"


def test_skill_estimate_api_service_unavailable(monkeypatch: pytest.MonkeyPatch) -> None:
    class OfflineProvider(StubSkillProvider):
        @property
        def ready(self) -> bool:
            return False

    monkeypatch.setattr(
        "app.services.skill_inference.get_skill_inference_service",
        lambda: SkillInferenceService(provider=OfflineProvider(LlmSkillInferenceResult.model_validate({
            "task_id": "x",
            "model_version": "stub",
            "prompt_version": "skill-inference-prompt-v1",
            "insufficient_context": False,
            "predictions": [],
        }))),
    )
    client = TestClient(app)
    response = client.post(
        "/api/v1/skills/estimate",
        json={"tasks": [{"client_task_id": "client-1", "task_title": "Do work"}]},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["llm_ready"] is False
    assert body["results"][0]["reject_reason"] == "service_unavailable"
