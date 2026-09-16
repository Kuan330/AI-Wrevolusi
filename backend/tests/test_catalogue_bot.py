from app.services.catalogue import build_bot_catalogue


def test_build_bot_catalogue_groups_real_courses_and_chapters_by_skill():
    rows = [
        {
            "wef_skill_id": 1,
            "core_skill": "AI and big data",
            "core_skill_importance_2025_pct": 88,
            "course_code": "WEF-01-B-01",
            "course_title": "Intro",
            "provider": "Provider",
            "course_url": "https://example.test/course",
            "level": "Beginner",
            "course_no": 1,
            "chapter_count": 3,
        },
        {
            "wef_skill_id": 1,
            "core_skill": "AI and big data",
            "core_skill_importance_2025_pct": 88,
            "course_code": "WEF-01-I-01",
            "course_title": "Next",
            "provider": "Provider",
            "course_url": "https://example.test/next",
            "level": "Intermediate",
            "course_no": 1,
            "chapter_count": 2,
        },
    ]

    result = build_bot_catalogue(rows)

    assert result == [
        {
            "skill_id": "ai-and-big-data",
            "skill_name": "AI and big data",
            "importance_pct": 88,
            "total_chapters": 5,
            "courses": [
                {
                    "course_id": "WEF-01-B-01",
                    "title": "Intro",
                    "provider": "Provider",
                    "url": "https://example.test/course",
                    "level": "Beginner",
                    "course_no": 1,
                    "chapter_count": 3,
                },
                {
                    "course_id": "WEF-01-I-01",
                    "title": "Next",
                    "provider": "Provider",
                    "url": "https://example.test/next",
                    "level": "Intermediate",
                    "course_no": 1,
                    "chapter_count": 2,
                },
            ],
        }
    ]


def test_build_bot_catalogue_rejects_rows_without_required_identity():
    rows = [
        {
            "wef_skill_id": 1,
            "core_skill": "AI and big data",
            "core_skill_importance_2025_pct": 88,
            "course_code": None,
            "course_title": "Broken",
            "provider": "Provider",
            "course_url": "https://example.test/course",
            "level": "Beginner",
            "course_no": 1,
            "chapter_count": 1,
        }
    ]

    assert build_bot_catalogue(rows) == []
