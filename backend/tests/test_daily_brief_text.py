"""Constraints on the daily brief text.

The point of these tests is that the language model cannot change what the
learner is advised to do, and cannot smuggle in a claim the tool never made. Each
case feeds a deliberately badly-behaved model response through the sanitiser and
asserts the outcome — including the cases where the correct outcome is "throw it
away and use the template".
"""

from datetime import date, datetime, timezone

from app.schemas.brief_text import BriefRecommendationText, BriefText
from app.services.daily_brief import (
    BriefFacts,
    build_brief,
    deterministic_brief,
    greeting_for_hour,
    sanitize_brief_text,
)
from app.services.learning import rollup_skill, select_recommendations
from app.services.learning import ChapterValue

TODAY = date(2026, 9, 16)


def make_skill(name: str, points: int, chapters: int = 2, importance=None):
    values = (
        [ChapterValue('c1', 'c1', 0, points, TODAY)] if points else []
    )
    return rollup_skill(
        skill_id=name,
        skill_name=name,
        total_chapters=chapters,
        values=values,
        today=TODAY,
        importance_pct=importance,
    )


def facts(*, checked_in: bool, three_skills=True) -> BriefFacts:
    skills = [
        make_skill('ai-and-big-data', 2),
        make_skill('creative-thinking', 6),
        make_skill('leadership-and-social-influence', 9),
    ]
    if not three_skills:
        skills = skills[:2]
    recommended = select_recommendations(skills, exclude_studied_today=checked_in)
    return BriefFacts(
        local_date=TODAY,
        local_hour=9,
        display_name='Ella',
        checked_in_today=checked_in,
        streak_days=4 if checked_in else 3,
        recommendations=recommended,
        skills=skills,
    )


# --- greeting -----------------------------------------------------------------


def test_greeting_matches_the_learners_own_hour():
    assert greeting_for_hour(8, 'Ella') == 'Good morning, Ella.'
    assert greeting_for_hour(12) == 'Good afternoon.'
    assert greeting_for_hour(16) == 'Good afternoon.'
    assert greeting_for_hour(17) == 'Good evening.'
    assert greeting_for_hour(21) == 'Good evening.'
    # Late night and pre-dawn share the neutral form.
    assert greeting_for_hour(23) == 'Hello.'
    assert greeting_for_hour(2, 'Ella') == 'Hello, Ella.'


# --- the template -------------------------------------------------------------


def test_template_brief_is_complete_on_its_own():
    text = deterministic_brief(facts(checked_in=False))

    assert text.summary
    assert text.closing
    assert len(text.recommendations) == 2
    # Recommendations are the server's picks, in the server's order.
    assert [item.skill_id for item in text.recommendations] == [
        skill.skill_id for skill in facts(checked_in=False).recommendations
    ]


def test_template_after_a_checkin_does_not_tell_the_learner_to_check_in_again():
    text = deterministic_brief(facts(checked_in=True))
    assert 'check in' not in text.closing.lower()


def test_template_without_recommendations_never_points_at_missing_suggestions():
    # Two selected skills means no recommendations at all.
    text = deterministic_brief(facts(checked_in=True, three_skills=False))
    assert text.recommendations == []
    assert 'above' not in text.closing.lower()


def test_template_never_states_a_number():
    text = deterministic_brief(facts(checked_in=True))
    joined = ' '.join([text.summary, text.closing, *(item.reason for item in text.recommendations)])
    assert not any(character.isdigit() for character in joined)


# --- the sanitiser ------------------------------------------------------------


def good_text() -> BriefText:
    return BriefText(
        summary='You are making steady progress and your streak is holding.',
        recommendations=[
            BriefRecommendationText(skill_id='ai-and-big-data', reason='This is your widest gap right now.'),
            BriefRecommendationText(
                skill_id='creative-thinking',
                reason='A small session here would round out the week.',
            ),
        ],
        closing='When you finish today, remember to check in.',
    )


ALLOWED = ['ai-and-big-data', 'creative-thinking']
ALLOWED_NUMBERS: set[str] = set()


def test_a_well_behaved_brief_passes_through():
    result = sanitize_brief_text(
        good_text(), allowed_skill_ids=ALLOWED, allowed_numbers=ALLOWED_NUMBERS
    )
    assert result is not None
    assert [item.skill_id for item in result.recommendations] == ALLOWED


def test_a_skill_the_server_did_not_choose_is_rejected():
    # The model tries to recommend a skill that has no course mapping. Accepting
    # it would send the learner to a skill they cannot study.
    text = good_text()
    text.recommendations[1].skill_id = 'talent-management'

    assert sanitize_brief_text(text, allowed_skill_ids=ALLOWED, allowed_numbers=set()) is None


def test_a_missing_reason_is_rejected_rather_than_silently_filled():
    text = BriefText(
        summary=good_text().summary,
        recommendations=[good_text().recommendations[0]],
        closing=good_text().closing,
    )
    assert sanitize_brief_text(text, allowed_skill_ids=ALLOWED, allowed_numbers=set()) is None


def test_an_invented_number_rejects_the_whole_brief():
    text = good_text()
    text.summary = 'You are 87 percent of the way through your plan.'

    assert sanitize_brief_text(text, allowed_skill_ids=ALLOWED, allowed_numbers=set()) is None


def test_a_number_the_server_supplied_is_tolerated():
    text = good_text()
    text.summary = 'You are 25 percent of the way through your plan.'

    result = sanitize_brief_text(
        text, allowed_skill_ids=ALLOWED, allowed_numbers={'25'}
    )
    assert result is not None


def test_a_prediction_or_a_judgement_rejects_the_whole_brief():
    for sentence in (
        'Without this you will be replaced within a year.',
        'You failed to keep up last week.',
        'You are falling behind your peers.',
        'This guarantees a promotion.',
    ):
        text = good_text()
        text.summary = sentence
        assert (
            sanitize_brief_text(text, allowed_skill_ids=ALLOWED, allowed_numbers=set()) is None
        ), sentence


def test_a_duplicate_recommendation_is_dropped_and_then_rejected_for_the_gap():
    text = good_text()
    text.recommendations[1].skill_id = 'ai-and-big-data'

    # Duplicates collapse, which leaves the second selected skill uncovered, so
    # the brief is rejected rather than shipped half-written.
    assert sanitize_brief_text(text, allowed_skill_ids=ALLOWED, allowed_numbers=set()) is None


# --- build_brief wiring -------------------------------------------------------


class FakeGateway:
    """Stands in for AIGateway, returning whatever the model 'said'."""

    def __init__(self, value, *, fallback: bool = False, provider: str = 'fake'):
        self._value = value
        self._fallback = fallback
        self._provider = provider
        self.calls = 0

    def run_structured(self, **kwargs):
        from app.services.ai_gateway import GatewayMetadata, GatewayResult

        self.calls += 1
        metadata = GatewayMetadata(
            provider=self._provider,
            used_fallback=self._fallback,
            cached=False,
            attempts=1,
            elapsed_ms=1,
            error=None if self._provider != 'local' else 'no provider',
        )
        return GatewayResult(self._value, metadata)


def test_a_model_brief_is_used_when_it_passes_every_check():
    gateway = FakeGateway(good_text())
    text, used_model, _ = build_brief(facts=facts(checked_in=False), gateway=gateway)

    assert used_model is True
    assert text.summary == good_text().summary


def test_a_rejected_model_brief_falls_back_to_the_template():
    bad = good_text()
    bad.summary = 'You will be replaced soon.'
    gateway = FakeGateway(bad)

    text, used_model, _ = build_brief(facts=facts(checked_in=False), gateway=gateway)

    assert used_model is False
    assert text.summary == deterministic_brief(facts(checked_in=False)).summary


def test_a_provider_failure_falls_back_to_the_template():
    gateway = FakeGateway(good_text(), fallback=True)
    text, used_model, _ = build_brief(facts=facts(checked_in=False), gateway=gateway)

    assert used_model is False
    assert text.closing


def test_the_brief_asks_the_model_for_the_page_footing_not_candidate_matching():
    captured = {}

    class CapturingGateway(FakeGateway):
        def run_structured(self, **kwargs):
            captured.update(kwargs)
            return super().run_structured(**kwargs)

    gateway = CapturingGateway(good_text())
    build_brief(facts=facts(checked_in=False), gateway=gateway)

    prompt = captured['system_prompt']
    # Prose rules, not the candidate-matching default.
    assert 'Never state numbers' in prompt
    assert 'Only write about the skills listed' in prompt
    assert 'candidate-constrained matching assistant' not in prompt
    # The operation name and a per-learner cache key keep briefs from colliding.
    assert captured['operation'] == 'daily_brief_text'
    assert captured['cache_key'].startswith('daily_brief_text::2026-09-16::')


def test_the_cache_key_separates_the_two_variants_of_a_day():
    keys = []
    for checked_in in (False, True):
        class Capturing(FakeGateway):
            def run_structured(self, **kwargs):
                keys.append(kwargs['cache_key'])
                return super().run_structured(**kwargs)

        build_brief(facts=facts(checked_in=checked_in), gateway=Capturing(good_text()))

    assert keys[0] != keys[1]
    assert 'before_checkin' in keys[0]
    assert 'after_checkin' in keys[1]
