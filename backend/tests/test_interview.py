"""Epic 9 interview practice with synthetic data: no database writes, credentials or live AI."""
import time
from threading import Event
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
from app.services.ai_gateway import AIProviderError
from app.services.model_overrides import ModelOverrideError
from app.services.resume_errors import GenerationFailure
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
PLAN = {"role_title": "Junior Data Analyst", "items": ITEMS, "bank": BANK, "topics": [{"id": "task-1", "text": "Prepare weekly sales reports", "item_id": "work-1", "impact_score": 0.7, "reference_id": "ref-task-1", "source_name": "Research example", "source_year": 2025}], "items_reviewed": True}


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
    assert len(template_plan(plan_request(role_title="", items=[], bank=[], topics=[])).questions) == 4


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
    assert len(texts) == 3 and "married" not in " ".join(texts)


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


def test_feedback_prompt_bounds_structure_keys_without_relaxing_validation():
    provider = Provider([feedback().model_dump()])
    feedback_for_answer(feedback_request(), provider)
    assert "Each structure item has exactly these keys: part, status, quote." in provider.calls[0]["system_prompt"]
    invalid = feedback().model_dump()
    invalid["structure"] = [{"part": "result", "status": "no", "quote": None, "note": "No outcome was stated."}]
    with pytest.raises(ValidationError) as error:
        FeedbackResponse.model_validate(invalid)
    assert error.value.errors()[0]["loc"] == ("structure", 0, "note")
    assert error.value.errors()[0]["type"] == "extra_forbidden"


def test_private_structure_note_is_discarded_before_public_feedback():
    raw = feedback().model_dump()
    raw["structure"] = [{"part": "action", "status": "yes", "quote": "I prepared the weekly sales report myself", "note": "A useful private explanation."}]
    result = feedback_for_answer(feedback_request(), Provider([raw]))
    assert len(result.structure) == 1
    assert set(result.model_dump()["structure"][0]) == {"part", "status", "quote"}
    assert "A useful private explanation" not in result.model_dump_json()


@pytest.mark.parametrize("extra", [{"invented": "unsupported"}, {"note": "x" * 1001}])
def test_private_structure_envelope_still_rejects_unknown_or_unbounded_fields(extra):
    raw = feedback().model_dump()
    raw["structure"] = [{"part": "result", "status": "no", "quote": None, **extra}]
    with pytest.raises(GenerationFailure) as error:
        feedback_for_answer(feedback_request(), Provider([raw]))
    assert error.value.code == "ai_schema_invalid"


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


# --- regressions from the local Epic 9 acceptance checks -------------------------------

@pytest.mark.parametrize("count", [3, 4, 5])
@pytest.mark.parametrize("items", [[], ITEMS[:1]])
def test_fallback_always_returns_requested_count_without_a_bank(count, items):
    request = plan_request(role_title="Future Data Analyst", items=items, bank=[], topics=[], count=count)
    result = template_plan(request)
    assert len(result.questions) == count
    assert len({q.text for q in result.questions}) == count
    assert all("Data Analyst" in q.text for q in result.questions if q.kind == "general")


@pytest.mark.parametrize("text", [
    "What religion do you practise?", "Are you a Muslim?", "What is your faith?",
    "Do you have children?", "When will you get married?", "What is your age?",
])
def test_personal_questions_cannot_bypass_the_guard(text):
    with pytest.raises(InterviewRejected):
        validate_plan(PlanModelResponse.model_validate(bad_first_question(text)), plan_request())


@pytest.mark.parametrize("tool", ["ChatGPT", "ai", "Copilot"])
def test_no_tool_experience_cannot_leak_into_any_feedback(tool):
    answer = f"I have not used {tool} at work. I check the totals by hand, and I would learn from my supervisor before using it."
    raw = feedback(
        summary=f"You lack {tool} experience.",
        checks=[{"id": "answered_question", "status": "yes", "quote": "I check the totals by hand"},
                {"id": "ai_check", "status": "no", "note": f"You lack {tool} experience."}],
        improvements=[{"kind": "possible_skill_gap", "text": f"You lack {tool} experience."}],
        skill_gap={"skill_id": 3, "reason": f"Missing {tool} experience"},
    )
    result = normalise_feedback(raw, feedback_request(answer=answer))
    assert f"You lack {tool} experience." not in result.model_dump_json()
    assert not result.improvements and result.skill_gap is None
    assert next(c for c in result.checks if c.id == "ai_check").status == "not_applicable"


@pytest.mark.parametrize("invented", [
    "How did you manage your team of 30 staff?",
    "How did you reduce costs by 40% at Acme?",
    "What did your supervisor say about the launch?",
])
def test_follow_up_quotes_the_answer_and_does_not_invent_facts(invented):
    result = normalise_feedback(feedback(follow_up=invented), feedback_request())
    assert result.follow_up != invented
    assert '\"I prepared the weekly sales report myself\"' in result.follow_up
    assert "30" not in result.follow_up and "Acme" not in result.follow_up


def test_ai_change_cannot_use_legacy_unlinked_topics():
    with pytest.raises(InterviewRejected):
        validate_plan(PlanModelResponse.model_validate(good_plan()), plan_request(topics=[{"id": "task-1", "text": "Prepare weekly sales reports"}]))


@pytest.mark.parametrize("missing", ["item_id", "impact_score", "reference_id", "source_name", "source_year"])
def test_ai_change_requires_every_evidence_field(missing):
    topic = {key: value for key, value in PLAN["topics"][0].items() if key != missing}
    with pytest.raises(InterviewRejected):
        validate_plan(PlanModelResponse.model_validate(good_plan()), plan_request(topics=[topic]))
    assert not any(q.kind == "ai_change" for q in template_plan(plan_request(items=ITEMS[:1], topics=[topic])).questions)


def test_ai_change_must_link_to_the_same_work_item_and_accept_zero_impact():
    items = [*ITEMS, {**ITEMS[0], "id": "work-2"}]
    topic = {**PLAN["topics"][0], "item_id": "work-2"}
    with pytest.raises(InterviewRejected):
        validate_plan(PlanModelResponse.model_validate(good_plan()), plan_request(items=items, topics=[topic]))
    result = template_plan(plan_request(items=ITEMS[:1], topics=[{**PLAN["topics"][0], "impact_score": 0}]))
    ai_question = next(q for q in result.questions if q.kind == "ai_change")
    assert ai_question.item_id == "work-1" and ai_question.topic_id == "task-1"
    assert len(validate_plan(PlanModelResponse(questions=result.questions), plan_request(items=ITEMS[:1])).questions) == 4


@pytest.mark.parametrize("changes", [{"impact_score": 1.1}, {"impact_score": -0.1}, {"source_year": 0}, {"source_name": ""}])
def test_ai_change_evidence_fields_are_bounded(changes):
    with pytest.raises(ValidationError):
        plan_request(topics=[{**PLAN["topics"][0], **changes}])


def test_future_role_and_empty_general_practice_work_without_resume_bank_or_ai():
    with client(configured=False) as http:
        for role in ("Data Analyst", ""):
            result = http.post("/api/v1/interview/plan", json={"role_title": role, "count": 5})
            assert result.status_code == 200
            assert len(result.json()["questions"]) == 5
            assert all(q["kind"] == "general" and q["item_id"] is None for q in result.json()["questions"])


def test_future_role_practice_can_use_ai_without_resume_or_bank():
    body = {"role_title": "Data Analyst", "count": 3}
    output = {"questions": [{"text": f"How would you learn task {n} for a Data Analyst role?", "kind": "general"} for n in range(3)]}
    with client(Provider([output])) as http:
        result = http.post("/api/v1/interview/plan", json=body)
        assert result.status_code == 200 and result.json()["source"] == "ai"
        assert len(result.json()["questions"]) == 3


def test_fallback_bank_filters_personal_and_duplicate_questions():
    bank = [{"id": "religion", "question": "What religion do you practise?"}, BANK[0], {**BANK[0], "id": "duplicate"}]
    result = template_plan(PlanRequest(bank=bank, count=5))
    assert len(result.questions) == len({q.text for q in result.questions}) == 5
    assert result.questions[0].bank_id == BANK[0]["id"]
    assert "religion" not in " ".join(q.text for q in result.questions)


def test_replacing_a_tool_gap_keeps_the_only_supported_quote():
    answer = "I have not used ChatGPT"
    raw = feedback(checks=[], improvements=[{"kind": "possible_skill_gap", "text": "You lack ChatGPT experience.", "quote": answer}])
    result = normalise_feedback(raw, feedback_request(answer=answer))
    assert result.improvements == []
    assert result.checks[0].quote == answer and answer in result.follow_up


def test_supported_follow_up_quote_uses_actual_answer_case_and_spacing():
    raw = feedback(checks=[{"id": "own_actions", "status": "yes", "quote": "i prepared the weekly sales report myself"}], improvements=[])
    result = normalise_feedback(raw, feedback_request())
    assert '"I prepared the weekly sales report myself"' in result.follow_up


@pytest.mark.parametrize("answer", [
    "I have never tried ChatGPT. I would learn it and check the output before using it.",
    "I have no experience with AI tools. I would compare the output with reliable sources.",
    "I don't use Copilot. I would check what it suggests before relying on it.",
])
def test_different_no_tool_experience_phrases_receive_safe_feedback(answer):
    raw = feedback(summary="You need more ChatGPT experience.",
                   checks=[{"id": "ai_check", "status": "no", "quote": answer[:20], "note": "Gain ai experience."}],
                   improvements=[])
    result = normalise_feedback(raw, feedback_request(answer=answer))
    assert result.summary.startswith("Not having used")
    assert next(c for c in result.checks if c.id == "ai_check").status == "not_applicable"


def test_unrelated_unused_equipment_does_not_hide_actual_ai_checks():
    answer = "I have not used cameras. I use AI to prepare reports and check its output against the till records before sending them."
    raw = feedback(checks=[{"id": "ai_check", "status": "yes", "quote": "check its output", "note": "You explained your AI output checks."}], improvements=[])
    result = normalise_feedback(raw, feedback_request(answer=answer))
    assert next(c for c in result.checks if c.id == "ai_check").status == "yes"


# --- rubric scores, stronger answer and real follow-ups -------------------------------

LONG_ANSWER = (
    "I prepared the weekly sales report myself. I checked the totals against the till records and fixed two mistakes before sending it. "
    "After that I added a short note for my manager about why the totals changed, so she could answer questions from the shop floor."
)


def score(**changes):
    return {"competency": "quality_care", "level": 3, "quote": "checked the totals against the till records",
            "reason": "You named a real check.", "next_step": "Say how often the check found a mistake.", **changes}


def test_scores_need_her_own_words_from_level_two_up():
    raw = feedback(scores=[score(), score(competency="results", quote="words I never said"), score(competency="teamwork", level=1, quote=None)])
    result = normalise_feedback(raw, feedback_request(answer=LONG_ANSWER))
    assert [s.competency for s in result.scores] == ["quality_care", "teamwork"]
    assert result.scores[0].quote == "checked the totals against the till records"


@pytest.mark.parametrize("answer,top", [("I checked the totals against the till records and fixed two mistakes.", 2),
                                         (ANSWER, 3), (LONG_ANSWER, 4)])
def test_a_short_answer_can_never_score_as_strong(answer, top):
    raw = feedback(scores=[score(level=4)], checks=[{"id": "answered_question", "status": "yes", "quote": "checked the totals"}], improvements=[])
    result = normalise_feedback(raw, feedback_request(answer=answer))
    assert result.scores[0].level == top


def test_duplicate_scores_and_ai_scores_on_non_ai_questions_are_dropped():
    raw = feedback(scores=[score(), score(level=2), score(competency="ai_change", quote="prepared the weekly sales report myself")])
    result = normalise_feedback(raw, feedback_request(answer=LONG_ANSWER))
    assert [(s.competency, s.level) for s in result.scores] == [("quality_care", 3)]


def test_ai_score_is_kept_for_ai_questions_but_not_when_she_has_not_used_the_tool():
    question = {"text": "How is this task changing with AI?", "kind": "ai_change", "item_label": None}
    answer = "I would check any AI output against the till records before I sent a report to my manager, and ask a colleague to review it."
    base = {"checks": [{"id": "answered_question", "status": "yes", "quote": "check any AI output"}], "improvements": []}
    raw = feedback(scores=[score(competency="ai_change", quote="check any AI output against the till records")], **base)
    assert normalise_feedback(raw, feedback_request(question=question, answer=answer)).scores[0].competency == "ai_change"
    unused = "I have not used any AI tool at work. I check the totals by hand and I would learn the tool from my supervisor if the team started using one."
    raw = feedback(scores=[score(competency="ai_change", quote="I check the totals by hand")],
                   checks=[{"id": "answered_question", "status": "yes", "quote": "I check the totals by hand"}], improvements=[])
    assert normalise_feedback(raw, feedback_request(question=question, answer=unused)).scores == []


def test_score_wording_cannot_judge_the_person():
    with pytest.raises(InterviewRejected):
        normalise_feedback(feedback(scores=[score(reason="You seem like a shy person with a weak personality.")]), feedback_request(answer=LONG_ANSWER))


def test_stronger_answer_keeps_only_facts_from_the_answer():
    ok = "I prepared the weekly sales report myself and checked the totals against the till records. I fixed two mistakes, then sent it. [Add what changed afterwards.]"
    assert normalise_feedback(feedback(stronger_answer=ok), feedback_request()).stronger_answer == ok
    for invented in [
        "I prepared the weekly sales report myself and cut errors by 40% before sending it to the team every week.",
        "I prepared the weekly sales report myself for Acme and checked the totals against the till records each time.",
        "I prepared the weekly sales report myself. Your accent made this hard to follow, so speak slower next time.",
    ]:
        assert normalise_feedback(feedback(stronger_answer=invented), feedback_request()).stronger_answer is None


def test_a_good_follow_up_keeps_the_ai_question_after_the_quote_is_verified():
    raw = feedback(follow_up="What did you change after finding the two mistakes?", follow_up_quote="fixed two mistakes before sending it", follow_up_focus="action")
    result = normalise_feedback(raw, feedback_request())
    assert result.follow_up == 'You said "fixed two mistakes before sending it". What did you change after finding the two mistakes?'


@pytest.mark.parametrize("raw_changes,expected", [
    ({"follow_up_quote": "words I never said"}, "Can you explain your own action"),
    ({"follow_up_quote": "fixed two mistakes before sending it", "follow_up": "What did your supervisor say about the launch?", "follow_up_focus": "result"}, "What happened as a result"),
    ({"follow_up_quote": "fixed two mistakes before sending it", "follow_up": "Tell me more. What happened?"}, "Can you explain your own action"),
    ({"follow_up_quote": "fixed two mistakes before sending it", "follow_up": "How did you reduce them by 40%?", "follow_up_focus": "check"}, "How would you check that this worked?"),
])
def test_follow_up_falls_back_to_a_safe_question_when_it_adds_facts(raw_changes, expected):
    result = normalise_feedback(feedback(**raw_changes), feedback_request())
    assert expected in result.follow_up and "supervisor" not in result.follow_up and "40" not in result.follow_up


def test_feedback_payload_names_the_focus_skill_from_the_question_intent():
    provider = Provider([feedback().model_dump()])
    request = feedback_request(question={"text": "How would you explain a delay to a customer?", "kind": "general", "intent": "customer_communication"})
    feedback_for_answer(request, provider)
    assert provider.calls[0]["payload"]["focus_competency"] == "communication"
    assert "role_knowledge" in provider.calls[0]["system_prompt"]


def test_an_answer_that_misses_the_question_cannot_score_above_started_or_clear():
    base = {"improvements": []}
    no = feedback(scores=[score(level=4)], checks=[{"id": "answered_question", "status": "no", "quote": "checked the totals"}], **base)
    partly = feedback(scores=[score(level=4)], checks=[{"id": "answered_question", "status": "partly", "quote": "checked the totals"}], **base)
    request = feedback_request(answer=LONG_ANSWER)
    assert normalise_feedback(no, request).scores[0].level == 2
    assert normalise_feedback(partly, request).scores[0].level == 3


def test_follow_up_quote_has_no_doubled_punctuation():
    raw = feedback(follow_up_quote="I prepared the weekly sales report myself.", follow_up_focus="reason", follow_up="Can you explain why?")
    answer = "I prepared the weekly sales report myself. I checked the totals against the till records and fixed two mistakes before sending it."
    follow_up = normalise_feedback(raw, feedback_request(answer=answer)).follow_up
    assert follow_up.startswith('You said "I prepared the weekly sales report myself". ')


def test_one_stalled_provider_call_is_retried_once():
    provider = Provider([AIProviderError("timed out", kind="timeout"), feedback().model_dump()])
    assert feedback_for_answer(feedback_request(), provider).summary.startswith("You described")
    assert len(provider.calls) == 2 and "repair_feedback" not in provider.calls[1]["payload"]
    assert all(call["request_timeout_s"] <= 50 for call in provider.calls)


def test_two_provider_failures_stop_after_one_retry():
    provider = Provider([AIProviderError("timed out", kind="timeout")])
    with pytest.raises(Exception, match="slow or busy"):
        feedback_for_answer(feedback_request(), provider)
    assert len(provider.calls) == 2


def test_long_quotes_and_rewrites_do_not_fail_the_whole_reply():
    long_quote = "I prepared the weekly sales report myself " * 12
    raw = feedback(
        scores=[score(quote=long_quote, reason="You named a real check. " * 30, next_step="Say how often it found a mistake. " * 20), score(competency="ownership", level=3)],
        follow_up_quote=long_quote, structure=[{"part": "action", "status": "yes", "quote": long_quote}], stronger_answer="I checked the totals. " * 100,
    )
    result = normalise_feedback(raw, feedback_request(answer=LONG_ANSWER))
    assert result.stronger_answer is None
    assert [s.competency for s in result.scores] == ["ownership"] or all(len(s.reason) <= 300 and len(s.next_step) <= 200 for s in result.scores)
    assert result.structure[0].quote is None


def test_long_reason_text_is_trimmed_to_the_display_limit():
    raw = feedback(scores=[score(reason="You named a real check on the totals. " * 20, next_step="Say how often it found a mistake. " * 20)])
    result = normalise_feedback(raw, feedback_request(answer=LONG_ANSWER))
    assert len(result.scores[0].reason) <= 300 and len(result.scores[0].next_step) <= 200 and result.scores[0].reason.endswith("…")


class SlowFirst:
    """The first call stalls; later calls answer at once."""
    def __init__(self, output, stall):
        self.output, self.stall, self.calls, self.lock = output, stall, [], __import__("threading").Lock()

    def complete_json(self, **kwargs):
        with self.lock:
            self.calls.append(kwargs)
            number = len(self.calls)
        if number == 1:
            time.sleep(self.stall)
        return deepcopy(self.output)


def test_a_stalled_call_is_raced_by_a_second_call_and_the_first_success_wins(monkeypatch):
    monkeypatch.setattr("app.services.interview.HEDGE_AFTER_S", 0.2)
    provider = SlowFirst(feedback().model_dump(), stall=3)
    started = time.monotonic()
    result = feedback_for_answer(feedback_request(), provider)
    assert result.summary.startswith("You described") and len(provider.calls) == 2
    assert time.monotonic() - started < 1.5


def test_a_fast_call_never_starts_a_second_call(monkeypatch):
    monkeypatch.setattr("app.services.interview.HEDGE_AFTER_S", 0.5)
    provider = SlowFirst(feedback().model_dump(), stall=0)
    feedback_for_answer(feedback_request(), provider)
    assert len(provider.calls) == 1


@pytest.mark.parametrize("code", ["ai_models_unavailable", "ai_budget_exhausted"])
def test_retryable_override_failure_waits_for_a_pending_success(monkeypatch, code):
    monkeypatch.setattr("app.services.interview.HEDGE_AFTER_S", 0.01)

    class PendingReply(SlowFirst):
        def __init__(self):
            super().__init__(feedback().model_dump(), stall=0)
            self.hedge_started = Event()

        def complete_json(self, **kwargs):
            with self.lock:
                self.calls.append(kwargs)
                number = len(self.calls)
            if number == 1:
                assert self.hedge_started.wait(1)
                raise ModelOverrideError(code)
            self.hedge_started.set()
            time.sleep(0.05)
            return deepcopy(self.output)

    provider = PendingReply()
    assert feedback_for_answer(feedback_request(), provider).summary.startswith("You described")
    assert len(provider.calls) == 2


@pytest.mark.parametrize("code", ["ai_models_unavailable", "ai_budget_exhausted"])
def test_fast_retryable_override_failure_is_retried_once(code):
    provider = Provider([ModelOverrideError(code), feedback().model_dump()])
    assert feedback_for_answer(feedback_request(), provider).summary.startswith("You described")
    assert len(provider.calls) == 2


@pytest.mark.parametrize("code", ["ai_credentials_invalid", "ai_configuration_invalid", "ai_rate_limited", "ai_request_rejected"])
def test_terminal_override_failure_preserves_error_without_extra_requests(code):
    error = ModelOverrideError(code)
    provider = Provider([error, feedback().model_dump()])
    with pytest.raises(ModelOverrideError) as raised:
        feedback_for_answer(feedback_request(), provider)
    assert raised.value is error
    assert len(provider.calls) == 1


def test_two_retryable_override_failures_preserve_the_last_error():
    error = ModelOverrideError("ai_budget_exhausted")
    provider = Provider([ModelOverrideError("ai_models_unavailable"), error])
    with pytest.raises(ModelOverrideError) as raised:
        feedback_for_answer(feedback_request(), provider)
    assert raised.value is error
    assert len(provider.calls) == 2
