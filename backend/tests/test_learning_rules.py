"""Rules that decide what the learner is told: progress, streaks, ranking.

These are pure functions, so the interesting behaviour — including the
counter-intuitive cases — is asserted directly rather than inferred from a
screenshot or a database state.
"""

from datetime import date, timedelta

from app.services.learning import (
    MIN_SKILLS_FOR_RECOMMENDATION,
    ChapterValue,
    rollup_skill,
    select_recommendations,
    streak_days,
    merge_chapter_value,
    progress_for,
)

TODAY = date(2026, 9, 16)


def value(skill: str, chapter: int, points: int, day: date) -> ChapterValue:
    return ChapterValue(
        skill_id=skill,
        course_id='c1',
        chapter_index=chapter,
        value=points,
        last_studied_on=day,
    )


def skill(name: str, chapters: int, values, *, importance=None, day=TODAY):
    return rollup_skill(
        skill_id=name,
        skill_name=name,
        total_chapters=chapters,
        values=values,
        today=day,
        importance_pct=importance,
    )


# --- progress -----------------------------------------------------------------


def test_progress_uses_the_full_scale_of_every_chapter():
    # Two chapters, each reported 5/10, is half the skill.
    assert progress_for(10, 2) == 0.5


def test_progress_of_a_skill_without_chapters_is_zero():
    assert progress_for(0, 0) == 0.0
    assert progress_for(5, 0) == 0.0


def test_progress_is_capped_and_never_negative():
    assert progress_for(999, 1) == 1.0
    assert progress_for(-10, 1) == 0.0


def test_rollup_sums_chapter_values_and_tracks_the_latest_day():
    older = TODAY - timedelta(days=3)
    summary = skill('ai', 2, [value('ai', 0, 4, older), value('ai', 1, 6, TODAY)])

    assert summary.earned_value == 10
    assert summary.target_value == 20
    assert summary.progress == 0.5
    assert summary.last_studied_on == TODAY
    assert summary.studied_today is True
    assert summary.is_candidate is True


def test_rollup_reports_a_skill_with_no_chapter_data_as_not_a_candidate():
    summary = skill('talent-management', 0, [])

    assert summary.total_chapters == 0
    assert summary.progress == 0.0
    assert summary.last_studied_on is None
    assert summary.studied_today is False
    # The whole point: it must not look like "the most behind skill".
    assert summary.is_candidate is False


def test_a_skill_never_studied_still_has_no_study_day():
    summary = skill('networks', 5, [])
    assert summary.last_studied_on is None
    assert summary.studied_today is False


# --- streaks ------------------------------------------------------------------


def test_streak_counts_consecutive_days_ending_today():
    days = [TODAY, TODAY - timedelta(days=1), TODAY - timedelta(days=2)]
    assert streak_days(days, TODAY) == 3


def test_streak_survives_a_day_that_has_not_been_checked_in_yet():
    # Checked in yesterday and the day before, but not yet today. Showing 0 here
    # would tell the learner their streak is already gone.
    days = [TODAY - timedelta(days=1), TODAY - timedelta(days=2)]
    assert streak_days(days, TODAY) == 2


def test_streak_breaks_at_the_first_missing_day():
    days = [TODAY, TODAY - timedelta(days=1), TODAY - timedelta(days=3)]
    assert streak_days(days, TODAY) == 2


def test_streak_is_zero_without_any_checkin_or_when_today_follows_a_gap():
    assert streak_days([], TODAY) == 0
    assert streak_days([TODAY - timedelta(days=2)], TODAY) == 0


def test_streak_ignores_duplicate_and_unordered_days():
    days = [TODAY, TODAY, TODAY - timedelta(days=1), TODAY - timedelta(days=1)]
    assert streak_days(days, TODAY) == 2


# --- ranking ------------------------------------------------------------------


def test_least_progress_is_recommended_first():
    # A third skill is required: with two or fewer there is nothing to choose.
    filler = skill('filler', 2, [value('filler', 0, 10, TODAY)])
    behind = skill('behind', 2, [value('behind', 0, 1, TODAY)])
    ahead = skill('ahead', 2, [value('ahead', 0, 9, TODAY)])

    picked = select_recommendations([ahead, behind, filler], exclude_studied_today=False)
    assert [item.skill_id for item in picked] == ['behind', 'ahead']


def test_equal_progress_breaks_the_tie_on_importance():
    filler = skill('filler', 2, [value('filler', 0, 8, TODAY)], importance=5)
    low = skill('low', 2, [value('low', 0, 5, TODAY)], importance=20)
    high = skill('high', 2, [value('high', 0, 5, TODAY)], importance=69)

    picked = select_recommendations([low, high, filler], exclude_studied_today=False)
    assert [item.skill_id for item in picked] == ['high', 'low']


def test_missing_importance_is_treated_as_the_lowest():
    filler = skill('filler', 2, [value('filler', 0, 8, TODAY)], importance=5)
    none = skill('none', 2, [value('none', 0, 5, TODAY)], importance=None)
    scored = skill('scored', 2, [value('scored', 0, 5, TODAY)], importance=1)

    picked = select_recommendations([none, scored, filler], exclude_studied_today=False)
    assert [item.skill_id for item in picked] == ['scored', 'none']


def test_skills_without_chapters_are_never_recommended_even_when_furthest_behind():
    # These skills have no course mapping in the catalogue, so they report zero
    # progress. Without the guard they would win every single day and recommend a
    # skill the learner cannot actually study.
    empty_a = skill('networks-and-cybersecurity', 0, [])
    empty_b = skill('talent-management', 0, [])
    empty_c = skill('resilience', 0, [])
    real = skill('ai-and-big-data', 4, [value('ai-and-big-data', 0, 2, TODAY)])

    picked = select_recommendations(
        [empty_a, empty_b, empty_c, real], exclude_studied_today=False
    )
    assert [item.skill_id for item in picked] == ['ai-and-big-data']


def test_after_a_checkin_skills_studied_today_are_left_out():
    # Third skill keeps the recommendations gate open in both variants.
    filler = skill('filler', 2, [value('filler', 0, 9, TODAY - timedelta(days=9))])
    studied = skill('studied', 2, [value('studied', 0, 1, TODAY)])
    untouched = skill('untouched', 2, [value('untouched', 0, 8, TODAY - timedelta(days=5))])

    before = select_recommendations([studied, untouched, filler], exclude_studied_today=False)
    assert [item.skill_id for item in before] == ['studied', 'untouched']

    after = select_recommendations([studied, untouched, filler], exclude_studied_today=True)
    assert [item.skill_id for item in after] == ['untouched', 'filler']


def test_no_recommendation_when_two_or_fewer_skills_are_selected():
    one = skill('one', 2, [value('one', 0, 0, TODAY)])
    two = skill('two', 2, [value('two', 0, 0, TODAY)])

    assert select_recommendations([one], exclude_studied_today=False) == []
    assert select_recommendations([one, two], exclude_studied_today=False) == []
    # Three is the first size that produces suggestions.
    assert len(select_recommendations([one, two, skill('three', 2, [])], exclude_studied_today=False)) == 2
    assert MIN_SKILLS_FOR_RECOMMENDATION == 3


def test_at_most_two_recommendations_are_returned():
    skills = [skill(f's{index}', 3, []) for index in range(6)]
    assert len(select_recommendations(skills, exclude_studied_today=False)) == 2


def test_selection_order_is_stable_for_identical_skills():
    a = skill('aaa', 2, [])
    b = skill('bbb', 2, [])
    first = select_recommendations([a, b, skill('ccc', 2, [])], exclude_studied_today=False)
    second = select_recommendations([skill('ccc', 2, []), b, a], exclude_studied_today=False)
    assert [item.skill_id for item in first] == [item.skill_id for item in second]


# --- writing a value ----------------------------------------------------------


def test_a_new_chapter_is_created_with_the_reported_value():
    record, reason = merge_chapter_value(
        None,
        skill_id='ai',
        course_id='c2',
        chapter_index=0,
        value=5,
        local_date=TODAY,
    )
    assert reason is None
    assert record is not None
    assert record.value == 5
    assert record.last_studied_on == TODAY


def test_progress_cannot_go_backwards():
    existing = value('ai', 0, 7, TODAY - timedelta(days=2))
    record, reason = merge_chapter_value(
        existing,
        skill_id='ai',
        course_id='c1',
        chapter_index=0,
        value=3,
        local_date=TODAY,
    )
    assert record is None
    assert reason == 'not_increase'


def test_resending_the_same_value_changes_nothing_including_the_study_date():
    # A double tap or a retry must not mark the chapter as studied today.
    existing = value('ai', 0, 5, TODAY - timedelta(days=4))
    record, reason = merge_chapter_value(
        existing,
        skill_id='ai',
        course_id='c1',
        chapter_index=0,
        value=5,
        local_date=TODAY,
    )
    assert record is None
    assert reason is None


def test_raising_a_value_moves_the_study_date_forward():
    existing = value('ai', 0, 5, TODAY - timedelta(days=4))
    record, reason = merge_chapter_value(
        existing,
        skill_id='ai',
        course_id='c1',
        chapter_index=0,
        value=6,
        local_date=TODAY,
    )
    assert reason is None
    assert record is not None
    assert record.value == 6
    assert record.last_studied_on == TODAY


def test_values_outside_the_scale_are_clamped():
    record, _ = merge_chapter_value(
        None,
        skill_id='ai',
        course_id='c1',
        chapter_index=0,
        value=99,
        local_date=TODAY,
    )
    assert record is not None
    assert record.value == 10
