from fastapi.testclient import TestClient

from app.main import create_app
from app.schemas.skill_matching import SkillMatchResponse
from app.services.skill_matching import match_skills


CANDIDATES = [
    {"id": 10, "skill": "Service orientation and customer service"},
    {"id": 7, "skill": "Empathy and active listening"},
    {"id": 21, "skill": "Reading, writing and mathematics"},
    {"id": 99, "skill": "A candidate not covered by the rules"},
]


def test_match_skills_returns_no_more_than_three_candidate_skills() -> None:
    result = match_skills(
        "Provide customer service, prepare the budget, and check the invoice.",
        CANDIDATES,
    )

    assert len(result) <= 3
    assert {item.wef_skill_id for item in result} <= {candidate["id"] for candidate in CANDIDATES}


def test_match_skills_keeps_evidence_as_exact_task_substrings() -> None:
    task_text = "Provide customer service and explain the warranty."

    result = match_skills(task_text, CANDIDATES)

    assert result
    for item in result:
        for phrase in item.evidence_phrases:
            assert phrase in task_text


def test_match_skills_returns_empty_for_unreliable_wording() -> None:
    result = match_skills("Repair satellites in deep space.", CANDIDATES)

    assert result == []


def test_skill_match_route_is_exposed_in_openapi() -> None:
    application = create_app("/api")

    operation = application.openapi()["paths"]["/api/v1/ai/skill-match"]["post"]

    assert operation["responses"]["200"]["content"]["application/json"]["schema"]["$ref"].endswith(
        "/SkillMatchResponse"
    )


def test_skill_match_route_returns_the_compatible_response_shape() -> None:
    application = create_app("/api")

    with TestClient(application) as client:
        response = client.post(
            "/api/v1/ai/skill-match",
            json={
                "task_text": "Provide customer service and explain the warranty.",
                "candidates": CANDIDATES,
            },
        )

    assert response.status_code == 200
    assert set(response.json()) == {"skills", "needs_user_confirmation"}
    assert response.json()["needs_user_confirmation"] is True
    parsed = SkillMatchResponse.model_validate(response.json())
    assert len(parsed.skills) <= 3
    assert all(
        item.wef_skill_id in {candidate["id"] for candidate in CANDIDATES}
        for item in parsed.skills
    )


def test_fast_matching_does_not_call_model_for_unrelated_input() -> None:
    from app.routers.ai import skill_match
    from app.schemas.skill_matching import SkillMatchRequest

    class NoModel:
        def run_candidate_constrained(self, **kwargs):
            raise AssertionError('Fast matching must not wait for a model')

    response = skill_match(
        SkillMatchRequest(task_text='zzzz unrelated banana', candidates=CANDIDATES, fast_only=True),
        gateway=NoModel(),
    )
    assert response.skills == []
