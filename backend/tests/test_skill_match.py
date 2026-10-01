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


def test_mechanical_task_variants_have_grounded_skill_evidence() -> None:
    candidates = [{"id": n, "skill": f"Skill {n}"} for n in range(1, 27)]
    cases = [
        ("Designing and preparing layouts of machines and mechanical installations.", 18),
        ("Collecting and analysing data from mechanical tests.", 1),
        ("Collecting and analyzing data from mechanical tests.", 1),
        ("Preparing detailed estimates of quantities and costs of materials and labour.", 21),
    ]
    for text, expected_id in cases:
        result = match_skills(text, candidates, limit=None)
        assert expected_id in {item.wef_skill_id for item in result}
        assert all(phrase in text for item in result for phrase in item.evidence_phrases)


def test_generic_systems_and_thinking_do_not_claim_cognitive_skills() -> None:
    candidates = [{"id": n, "skill": f"Skill {n}"} for n in range(1, 27)]
    assert match_skills("Installing hydraulic power systems.", candidates, limit=None) == []
    assert match_skills("Thinking about a task and reviewing items.", candidates, limit=None) == []
    assert {item.wef_skill_id for item in match_skills("Use systems thinking to investigate a root cause.", candidates, limit=None)} == {12}


def test_frontend_and_backend_use_identical_task_skill_rules() -> None:
    # Both runtimes ship their own rules. Guard the contract so accepting a skill
    # in the review page cannot silently lose it in career matching.
    import re
    from pathlib import Path
    from app.services.skill_matching import SKILL_RULES

    source = (Path(__file__).resolve().parents[2] / "frontend/src/features/skills/matchSkills.ts").read_text()
    parsed = re.findall(r"skillId: (\d+),\s*phrases: \[(.*?)\],\s*confidence: ([0-9.]+)", source, re.S)
    frontend_rules = [(int(skill_id), tuple(re.findall(r'"([^"]+)"', phrases)), float(confidence)) for skill_id, phrases, confidence in parsed]
    assert frontend_rules == [(rule.skill_id, rule.phrases, rule.confidence) for rule in SKILL_RULES]
