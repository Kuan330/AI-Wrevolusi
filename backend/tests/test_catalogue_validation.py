from app.services.catalogue import validate_catalogue_scope


def test_validate_catalogue_scope_accepts_zero_based_chapter_index():
    catalogue = {
        "ai-and-big-data": {
            "WEF-01-B-01": {1, 2, 3},
        }
    }

    assert validate_catalogue_scope(
        catalogue,
        skill_id="ai-and-big-data",
        course_id="WEF-01-B-01",
        chapter_index=2,
    ) is True


def test_validate_catalogue_scope_rejects_unknown_skill_course_and_chapter():
    catalogue = {"ai-and-big-data": {"WEF-01-B-01": {1, 2}}}

    assert validate_catalogue_scope(catalogue, skill_id="missing", course_id="WEF-01-B-01", chapter_index=1) is False
    assert validate_catalogue_scope(catalogue, skill_id="ai-and-big-data", course_id="missing", chapter_index=1) is False
    assert validate_catalogue_scope(catalogue, skill_id="ai-and-big-data", course_id="WEF-01-B-01", chapter_index=9) is False
