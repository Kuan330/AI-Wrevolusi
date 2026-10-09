"""Epic 9 interview practice with synthetic data: no database writes, credentials or live AI."""
from copy import deepcopy
from types import SimpleNamespace
from unittest.mock import Mock

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app.db.session import get_db
from app.main import create_app
from app.routers.interview import _optional_provider
from app.routers.resume import get_resume_provider
from app.schemas.interview import FeedbackRequest, FeedbackResponse, PlanModelResponse, PlanRequest
from app.services.auth import get_current_user
from app.services.interview import (
    InterviewRejected,
    bank_for_occupation,
    feedback_for_answer,
    normalise_feedback,
    plan_questions,
    template_plan,
    validate_plan,
)

ITEMS = [
    {"id": "work-1", "kind": "work", "label": "Analyst at a retail company", "text": "Prepared weekly sales reports."},
    {"id": "project-1", "kind": "project", "label": "Budget tracker", "text": "A personal spreadsheet project."},
    {"id": "skill-1", "kind": "skill", "label": "Excel", "text": ""},
    {"id": "req-1", "kind": "requirement", "label": "SQL queries", "text": ""},
]
BANK = [{"id": "E9-Q-0001", "question": "How would you handle two urgent requests at once?"}]
PLAN = {"role_title": "Junior Data Analyst", "items": ITEMS, "bank": BANK, "topics": [{"id": "task-1", "text": "Prepare weekly sales reports"}], "items_reviewed": True}


def question(**changes):
    return {"text": "What did you do yourself when preparing weekly reports?", "kind": "resume_item", "item_id": "work-1", **changes}


def good_plan():
    return {"questions": [
        question(),
        question(text="What was your own part in the budget tracker?", item_id="project-1"),
        question(text="How would you approach writing SQL queries for this role?", kind="requirement_practice", item_id="req-1"),
        question(text="How is preparing weekly reports changing with AI, and how would you check AI output?", kind="ai_change", item_id="work-1", topic_id="task-1"),
    ]}


class Provider:
    def __init__(self, outputs):
        self.outputs, self.calls = outputs, []

    def complete_json(self, **kwargs):
        self.calls.append(kwargs)
        output = self.outputs[min(len(self.calls) - 1, len(self.outputs) - 1)]
        if isinstance(output, Exception):
            raise output
        return deepcopy(output)


def plan_request(**changes):
    return PlanRequest.model_validate({**PLAN, **changes})


def bad_first_question(text="Are you married?"):
    bad = good_plan()
    bad["questions"][0]["text"] = text
    return bad


# --- plan contract --------------------------------------------------------------------

def test_plan_needs_reviewed_items_and_no_contact_details():
    with pytest.raises(ValidationError):
        plan_request(items_reviewed=False)
    with pytest.raises(ValidationError):
        plan_request(items=[{**ITEMS[0], "text": "Email me at someone@example.test"}])
    with pytest.raises(ValidationError):
        plan_request(items=[], bank=[])


def test_good_plan_links_each_question_to_an_item():
    result = validate_plan(PlanModelResponse.model_validate(good_plan()), plan_request())
    assert result.source == "ai" and len(result.questions) == 4
    assert all(q.item_id for q in result.questions)


@pytest.mark.parametrize("bad", [
    question(text="How old are you and are you married?"),
    question(text="Do you plan to have children soon?"),
    question(text="How does your religion affect your work?"),
    question(text="Which AI tools do you use at work?"),
    question(text="How would you describe your use of AI tools?"),
    question(item_id="missing"),
    question(kind="general"),
    question(kind="requirement_practice"),
    question(item_id="req-1"),
    question(kind="ai_change", topic_id="unknown"),
    question(kind="ai_change", item_id="project-1", topic_id="task-1"),
    question(topic_id="task-1"),
    question(bank_id="E9-Q-9999"),
])
def test_unsafe_or_ungrounded_questions_are_rejected(bad):
    good = good_plan()
    good["questions"][0] = bad
    with pytest.raises(InterviewRejected):
        validate_plan(PlanModelResponse.model_validate(good), plan_request())


def test_child_care_work_may_mention_children():
    items = [{"id": "w", "kind": "work", "label": "Child care assistant", "text": "Supervised children at a centre."}]
    request = plan_request(items=items, topics=[], bank=[])
    out = {"questions": [question(text=f"How did you keep the children safe during activity {n}?", item_id="w") for n in range(3)]}
    assert len(validate_plan(PlanModelResponse.model_validate(out), request).questions) == 3


def test_duplicate_questions_and_two_ai_questions_are_rejected():
    same = {"questions": [question(), question(), question(item_id="project-1")]}
    with pytest.raises(InterviewRejected):
        validate_plan(PlanModelResponse.model_validate(same), plan_request())
    two = good_plan()
    two["questions"][0] = {**two["questions"][3], "text": "Another AI question about reports?"}
    with pytest.raises(InterviewRejected):
        validate_plan(PlanModelResponse.model_validate(two), plan_request())


def test_general_practice_uses_bank_questions_only():
    bank = [{"id": f"B{n}", "question": f"Practice question number {n}?"} for n in range(4)]
    request = PlanRequest(items=[], bank=bank, count=3)
    out = {"questions": [{"text": b["question"], "kind": "general", "bank_id": b["id"]} for b in bank[:3]]}
    assert validate_plan(PlanModelResponse.model_validate(out), request).questions[0].kind == "general"


def test_one_correction_then_success_and_no_content_cache():
    provider = Provider([bad_first_question(), good_plan()])
    result = plan_questions(plan_request(), provider)
    assert result.source == "ai" and len(provider.calls) == 2
    assert provider.calls[1]["payload"]["repair_feedback"] == {"code": "unfair_question"}
    assert all(call["request_cache_enabled"] is False and call["request_max_retries"] == 0 for call in provider.calls)


def test_two_bad_attempts_raise():
    with pytest.raises(InterviewRejected):
        plan_questions(plan_request(), Provider([bad_first_question()]))


def test_template_plan_prefers_work_then_project_and_marks_requirements_as_practice():
    result = template_plan(plan_request(count=4))
    assert result.source == "template" and len(result.questions) == 4
    assert [q.item_id for q in result.questions] == ["work-1", "project-1", "req-1", "skill-1"]
    assert result.questions[2].kind == "requirement_practice"


def test_template_plan_pads_from_bank_and_skips_unfair_bank_questions():
    request = plan_request(items=[ITEMS[0]], bank=[{"id": "x", "question": "Are you married?"}, *BANK], topics=[], count=3)
    texts = [q.text for q in template_plan(request).questions]
    assert len(texts) == 2 and "married" not in " ".join(texts)


# --- feedback -------------------------------------------------------------------------

ANSWER = "I prepared the weekly sales report myself. I checked the totals against the till records and fixed two mistakes before sending it."


def feedback_request(**changes):
    body = {"question": {"text": "Tell me about your reports.", "kind": "resume_item", "item_label": "Analyst"},
            "answer": ANSWER, "skills": [{"id": 3, "name": "Analytical thinking"}], **changes}
    return FeedbackRequest.model_validate(body)


def feedback(**changes):
    body = {
        "summary": "You described your own actions clearly.",
        "checks": [
            {"id": "answered_question", "status": "yes", "quote": "I prepared the weekly sales report myself", "note": ""},
            {"id": "own_actions", "status": "yes", "note": ""},
            {"id": "concrete_example", "status": "partly", "note": "Add how many reports."},
            {"id": "judgement", "status": "partly", "note": ""},
        ],
        "improvements": [{"kind": "missing_example", "text": "Say how often you did this and who used the report.", "quote": "weekly sales report"}],
        "follow_up": "What did you change after finding the two mistakes?",
        "skill_gap": None,
        **changes,
    }
    return FeedbackResponse.model_validate(body)


def test_feedback_keeps_quotes_found_in_the_answer_and_drops_others():
    result = normalise_feedback(feedback(improvements=[{"kind": "expression", "text": "Shorten the second sentence.", "quote": "words I never said"}]), feedback_request())
    assert result.improvements[0].quote is None
    assert result.checks[0].quote == "I prepared the weekly sales report myself"


def test_feedback_without_any_quote_is_rejected():
    empty = feedback(checks=[{"id": "answered_question", "status": "yes"}], improvements=[])
    with pytest.raises(InterviewRejected, match="your own words"):
        normalise_feedback(empty, feedback_request())


@pytest.mark.parametrize("text", ["Your personality seems shy.", "Your accent made this hard to follow.", "You will be hired for sure."])
def test_feedback_never_judges_the_person_or_predicts_hiring(text):
    with pytest.raises(InterviewRejected):
        normalise_feedback(feedback(summary=text), feedback_request())


def test_all_four_core_checks_are_always_present_in_order():
    result = normalise_feedback(feedback(checks=[{"id": "own_actions", "status": "yes", "quote": "weekly sales report"}]), feedback_request())
    assert [c.id for c in result.checks] == ["answered_question", "own_actions", "concrete_example", "judgement"]
    assert result.checks[0].status == "not_applicable"


def test_follow_up_is_dropped_after_two_follow_ups_and_checked_for_fairness():
    assert normalise_feedback(feedback(), feedback_request(follow_ups_asked=2)).follow_up is None
    assert normalise_feedback(feedback(), feedback_request(follow_ups_asked=1)).follow_up
    with pytest.raises(InterviewRejected):
        normalise_feedback(feedback(follow_up="Are you married?"), feedback_request())


def test_not_having_used_a_tool_is_not_a_weakness():
    answer = "I have not used any AI tool at work. I check the totals by hand, and I would learn the tool from my supervisor if the team started using one."
    raw = feedback(
        checks=[{"id": "answered_question", "status": "yes", "quote": "I check the totals by hand"}, {"id": "ai_check", "status": "no", "note": ""}],
        improvements=[{"kind": "possible_skill_gap", "text": "You lack AI tool experience.", "quote": None}],
        skill_gap={"skill_id": 3, "reason": "AI tools"},
    )
    result = normalise_feedback(raw, feedback_request(answer=answer))
    assert next(c for c in result.checks if c.id == "ai_check").status == "not_applicable"
    assert all(i.kind != "possible_skill_gap" for i in result.improvements)
    assert result.skill_gap is None


def test_short_answers_mark_skill_gaps_as_uncertain_and_drop_the_skill_pick():
    raw = feedback(
        checks=[{"id": "answered_question", "status": "no", "quote": "I did reports"}],
        improvements=[{"kind": "possible_skill_gap", "text": "You may want to strengthen analysis.", "quote": None}],
        skill_gap={"skill_id": 3, "reason": "Analysis"},
    )
    result = normalise_feedback(raw, feedback_request(answer="I did reports"))
    assert result.improvements[0].uncertain is True and result.skill_gap is None


def test_skill_pick_must_come_from_the_supplied_list():
    gap = [{"kind": "possible_skill_gap", "text": "You may want to strengthen analysis.", "quote": "weekly sales report"}]
    with pytest.raises(InterviewRejected):
        normalise_feedback(feedback(improvements=gap, skill_gap={"skill_id": 99, "reason": "Analysis"}), feedback_request())
    ok = normalise_feedback(feedback(improvements=gap, skill_gap={"skill_id": 3, "reason": "Analysis"}), feedback_request())
    assert ok.skill_gap.skill_id == 3


def test_feedback_request_needs_an_answer_without_contact_details():
    with pytest.raises(ValidationError):
        feedback_request(answer="   ")
    with pytest.raises(ValidationError):
        feedback_request(answer="Call me on +60 12 345 6789 please.")


def test_feedback_for_answer_uses_the_provider_once():
    provider = Provider([feedback().model_dump()])
    assert feedback_for_answer(feedback_request(), provider).summary.startswith("You described")
    assert len(provider.calls) == 1


# --- question bank --------------------------------------------------------------------

def bank_db(exact=(), family=(), common=()):
    def row(i):
        return {"question_id": f"E9-Q-{i:04d}", "scope": "Exact", "primary_intent": "debugging", "question": f"Question {i}?"}

    async def execute(statement, params):
        sql = str(statement)
        result = Mock()
        rows = exact if "occupation_code = :code" in sql else family if "family_code" in sql else common
        result.mappings.return_value.all.return_value = [row(i) for i in list(rows)[:params["limit"]]]
        return result

    return SimpleNamespace(execute=execute)


@pytest.mark.anyio
async def test_bank_exact_match_is_used_when_present():
    result = await bank_for_occupation(bank_db(exact=range(1, 13)), "2512", 12)
    assert result.matched == "exact" and len(result.questions) == 12


@pytest.mark.anyio
async def test_bank_falls_back_to_family_then_common():
    family = await bank_for_occupation(bank_db(family=[1, 2], common=[90, 91, 92]), "1120", 4)
    assert family.matched == "family" and [q.id for q in family.questions] == ["E9-Q-0001", "E9-Q-0002", "E9-Q-0090", "E9-Q-0091"]
    common = await bank_for_occupation(bank_db(common=[90]), "9999", 4)
    assert common.matched == "common"


# --- routes ---------------------------------------------------------------------------

def client(provider=None, db=None, configured=True):
    application = create_app("/api")
    application.dependency_overrides[get_current_user] = lambda: SimpleNamespace(id="user-1")
    application.dependency_overrides[_optional_provider] = lambda: provider if configured else None
    application.dependency_overrides[get_resume_provider] = lambda: provider

    async def database():
        yield db or bank_db(common=[90, 91])

    application.dependency_overrides[get_db] = database
    return TestClient(application)


def test_plan_route_returns_ai_questions_with_no_store():
    with client(Provider([good_plan()])) as http:
        response = http.post("/api/v1/interview/plan", json=PLAN)
    assert response.status_code == 200 and response.json()["source"] == "ai"
    assert response.headers["cache-control"] == "no-store"


def test_plan_route_falls_back_to_templates_when_ai_is_off_or_rejected():
    with client(configured=False) as http:
        assert http.post("/api/v1/interview/plan", json=PLAN).json()["source"] == "template"
    with client(Provider([bad_first_question()])) as http:
        assert http.post("/api/v1/interview/plan", json=PLAN).json()["source"] == "template"
    with client(Provider([RuntimeError("private detail")])) as http:
        response = http.post("/api/v1/interview/plan", json=PLAN)
    assert response.json()["source"] == "template" and "private detail" not in response.text


def test_plan_route_rejects_unreviewed_items():
    with client(Provider([good_plan()])) as http:
        assert http.post("/api/v1/interview/plan", json={**PLAN, "items_reviewed": False}).status_code == 422


def test_feedback_route_success_and_safe_failure():
    body = {"question": {"text": "Tell me about your reports."}, "answer": ANSWER, "skills": [{"id": 3, "name": "Analytical thinking"}]}
    with client(Provider([feedback().model_dump()])) as http:
        response = http.post("/api/v1/interview/feedback", json=body)
    assert response.status_code == 200 and response.json()["checks"][0]["id"] == "answered_question"
    assert response.headers["cache-control"] == "no-store"
    with client(Provider([RuntimeError("secret " + ANSWER)])) as http:
        failed = http.post("/api/v1/interview/feedback", json=body)
    assert failed.status_code == 503 and "answer is saved" in failed.json()["detail"] and "secret" not in failed.text


def test_question_bank_route_validates_the_code_and_returns_json():
    with client() as http:
        ok = http.get("/api/v1/interview/question-bank", params={"occupation_code": "2512", "limit": 5})
        assert ok.status_code == 200 and ok.json()["matched"] == "common"
        assert http.get("/api/v1/interview/question-bank", params={"occupation_code": "25;DROP"}).status_code == 422


def test_interview_routes_need_sign_in():
    with TestClient(create_app("/api")) as http:
        assert http.get("/api/v1/interview/question-bank", params={"occupation_code": "2512"}).status_code == 401
        assert http.post("/api/v1/interview/plan", json=PLAN).status_code == 401
