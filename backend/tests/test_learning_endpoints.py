"""Endpoint contracts for learning progress, check-ins and the calendar.

These run against the in-process app with a stubbed database layer, so they assert
the HTTP contract — status codes, rejection reasons, and the guarantee that one
learner can never read or write another learner's records.
"""

from datetime import date, timedelta

import pytest
from fastapi.testclient import TestClient

from app.main import create_app

TODAY = date(2026, 9, 16)


class StubRecords:
    """Minimal in-memory stand-in for the record layer."""

    def __init__(self, user_id):
        self.user_id = user_id
        # Keyed by (skill, course, chapter) and holds ChapterValue objects, which
        # is what the service layer expects to read attributes from.
        self.progress: dict[tuple[str, str, int], object] = {}
        self.checkins: set[date] = set()
        self.briefs: dict[tuple[date, str], dict] = {}
        self.upsert_calls = 0

    async def list_progress(self, _db, _user_id):
        return list(self.progress.values())

    async def list_progress_for_skills(self, _db, _user_id, _skill_ids):
        wanted = set(_skill_ids)
        return [item for key, item in self.progress.items() if key[0] in wanted]

    async def upsert_progress(self, _db, _user_id, *, local_date, chapters):
        from app.schemas.learning import RejectedChapter
        from app.services.learning import merge_chapter_value

        self.upsert_calls += 1
        accepted, rejected = [], []
        for item in chapters:
            key = (item.skill_id, item.course_id, item.chapter_index)
            existing = self.progress.get(key)
            record, reason = merge_chapter_value(
                existing,
                skill_id=item.skill_id,
                course_id=item.course_id,
                chapter_index=item.chapter_index,
                value=item.value,
                local_date=local_date,
            )
            if reason:
                rejected.append(
                    RejectedChapter(
                        course_id=item.course_id,
                        chapter_index=item.chapter_index,
                        reason=reason,
                        stored_value=existing.value if existing else None,
                    )
                )
                continue
            accepted.append(item)
            if record is not None:
                self.progress[key] = record
        return accepted, rejected

    async def list_checkin_days(self, _db, _user_id, *, from_date=None, to_date=None):
        days = sorted(self.checkins, reverse=True)
        if from_date:
            days = [day for day in days if day >= from_date]
        if to_date:
            days = [day for day in days if day <= to_date]
        return days

    async def streak_reference_days(self, _db, _user_id):
        return sorted(self.checkins)

    async def create_checkin(self, _db, _user_id, *, local_date):
        if local_date in self.checkins:
            return False
        self.checkins.add(local_date)
        return True

    async def has_progress_on(self, _db, _user_id, *, local_date):
        return any(item.last_studied_on == local_date for item in self.progress.values())

    async def count_checkins(self, _db, _user_id):
        return len(self.checkins)

    async def get_stored_brief(self, _db, _user_id, *, brief_date, variant):
        return self.briefs.get((brief_date, variant))

    async def store_brief(self, _db, _user_id, *, brief_date, variant, content, generated_by_model):
        class Stored:
            def __init__(self, content):
                self.content = content
                self.generated_by_model = generated_by_model

        stored = Stored(content)
        self.briefs[(brief_date, variant)] = stored
        return stored


@pytest.fixture()
def client(monkeypatch):
    """A signed-in client whose records live in memory."""

    app = create_app('/api')
    store = StubRecords('user-1')

    import app.routers.learning as learning_router
    import app.services.auth as auth_service

    for name in (
        'list_progress',
        'list_progress_for_skills',
        'upsert_progress',
        'list_checkin_days',
        'streak_reference_days',
        'create_checkin',
        'has_progress_on',
        'count_checkins',
        'get_stored_brief',
        'store_brief',
    ):
        monkeypatch.setattr(learning_router.records, name, getattr(store, name))

    async def fake_catalogue_scope(_db):
        return {'ai-and-big-data': {'WEF-11-B-01': {0, 1, 2}, 'c2': {0}}}

    monkeypatch.setattr(learning_router.catalogue_service, 'load_catalogue_scope', fake_catalogue_scope)

    async def fake_skill_catalogue(_db):
        # The server-side catalogue is the source of truth for chapter totals and
        # importance; the client's numbers must never override these.
        return {
            'ai-and-big-data': {
                'skill_name': 'AI and big data',
                'total_chapters': 2,
                'importance_pct': 88,
            },
            'creative-thinking': {
                'skill_name': 'Creative thinking',
                'total_chapters': 4,
                'importance_pct': 57,
            },
            'leadership-and-social-influence': {
                'skill_name': 'Leadership and social influence',
                'total_chapters': 3,
                'importance_pct': 61,
            },
        }

    monkeypatch.setattr(learning_router.catalogue_service, 'load_skill_catalogue', fake_skill_catalogue)

    class FakeUser:
        id = 'user-1'
        email = 'learner@example.com'

    async def fake_current_user():
        return FakeUser()

    app.dependency_overrides[auth_service.get_current_user] = fake_current_user

    with TestClient(app) as test_client:
        test_client.store = store
        yield test_client


def body_chapters(skill_id='ai-and-big-data', value=5, chapter=0, course_id='WEF-11-B-01'):
    return {
        'local_date': TODAY.isoformat(),
        'chapters': [
            {
                'skill_id': skill_id,
                'course_id': course_id,
                'chapter_index': chapter,
                'value': value,
            }
        ],
    }


# --- progress -----------------------------------------------------------------


def test_progress_is_accepted_and_reported_back(client):
    response = client.post('/api/v1/learning/progress', json=body_chapters(value=5))

    assert response.status_code == 200
    payload = response.json()
    assert payload['accepted'] == 1
    assert payload['rejected'] == []
    assert payload['updated'][0]['value'] == 5


def test_a_lower_value_is_rejected_with_the_stored_value(client):
    client.post('/api/v1/learning/progress', json=body_chapters(value=7))
    response = client.post('/api/v1/learning/progress', json=body_chapters(value=4))

    assert response.status_code == 200
    payload = response.json()
    assert payload['accepted'] == 0
    assert payload['rejected'][0]['reason'] == 'not_increase'
    assert payload['rejected'][0]['stored_value'] == 7


def test_resending_the_same_value_is_not_an_error(client):
    client.post('/api/v1/learning/progress', json=body_chapters(value=5))
    response = client.post('/api/v1/learning/progress', json=body_chapters(value=5))

    assert response.status_code == 200
    assert response.json()['accepted'] == 1
    assert response.json()['rejected'] == []


def test_a_value_above_the_scale_is_refused_by_validation(client):
    response = client.post('/api/v1/learning/progress', json=body_chapters(value=11))
    assert response.status_code == 422


def test_progress_rejects_a_skill_course_or_chapter_outside_the_verified_catalogue(client):
    response = client.post(
        '/api/v1/learning/progress',
        json={
            'local_date': TODAY.isoformat(),
            'chapters': [
                body_chapters(skill_id='missing')['chapters'][0],
                body_chapters(course_id='missing')['chapters'][0],
                body_chapters(chapter=99)['chapters'][0],
            ],
        },
    )

    assert response.status_code == 200
    assert response.json()['accepted'] == 0
    assert [item['reason'] for item in response.json()['rejected']] == [
        'unknown_scope',
        'unknown_scope',
        'unknown_scope',
    ]
    assert client.store.upsert_calls == 0


def test_a_future_date_is_refused(client):
    payload = body_chapters()
    payload['local_date'] = (date.today() + timedelta(days=10)).isoformat()

    assert client.post('/api/v1/learning/progress', json=payload).status_code == 422


# --- check-in ------------------------------------------------------------------


def test_checkin_requires_learning_for_that_day(client):
    response = client.post('/api/v1/learning/checkin', json={'local_date': TODAY.isoformat()})

    assert response.status_code == 409
    assert 'no learning recorded' in response.json()['detail']


def test_checkin_succeeds_after_progress_and_reports_a_streak(client):
    client.post('/api/v1/learning/progress', json=body_chapters(value=5))
    response = client.post('/api/v1/learning/checkin', json={'local_date': TODAY.isoformat()})

    assert response.status_code == 200
    payload = response.json()
    assert payload['created'] is True
    assert payload['streak_days'] == 1


def test_checking_in_twice_the_same_day_is_idempotent(client):
    client.post('/api/v1/learning/progress', json=body_chapters(value=5))
    client.post('/api/v1/learning/checkin', json={'local_date': TODAY.isoformat()})
    response = client.post('/api/v1/learning/checkin', json={'local_date': TODAY.isoformat()})

    assert response.status_code == 200
    assert response.json()['created'] is False
    assert response.json()['streak_days'] == 1


# --- calendar -----------------------------------------------------------------


def test_calendar_lights_up_only_days_with_records(client):
    client.post('/api/v1/learning/progress', json=body_chapters(value=5))
    client.post('/api/v1/learning/checkin', json={'local_date': TODAY.isoformat()})

    response = client.get(
        '/api/v1/learning/calendar',
        params={'from': (TODAY - timedelta(days=2)).isoformat(), 'to': TODAY.isoformat()},
    )

    assert response.status_code == 200
    days = {item['day']: item for item in response.json()['days']}
    assert days[TODAY.isoformat()]['checked_in'] is True
    assert days[TODAY.isoformat()]['studied'] is True
    assert days[(TODAY - timedelta(days=1)).isoformat()]['checked_in'] is False
    assert days[(TODAY - timedelta(days=1)).isoformat()]['studied'] is False


def test_calendar_rejects_a_backwards_or_overlong_range(client):
    backwards = client.get(
        '/api/v1/learning/calendar',
        params={'from': TODAY.isoformat(), 'to': (TODAY - timedelta(days=1)).isoformat()},
    )
    assert backwards.status_code == 422

    overlong = client.get(
        '/api/v1/learning/calendar',
        params={'from': (TODAY - timedelta(days=400)).isoformat(), 'to': TODAY.isoformat()},
    )
    assert overlong.status_code == 422


# --- summary ------------------------------------------------------------------


def test_summary_reports_progress_and_flags_unusable_skills(client):
    client.post('/api/v1/learning/progress', json=body_chapters(value=5))

    response = client.post(
        '/api/v1/learning/summary',
        json={
            'local_date': TODAY.isoformat(),
            'skills': [
                {'skill_id': 'ai-and-big-data', 'total_chapters': 2, 'skill_name': 'AI and big data'},
                # No course mapping yet, so no chapters: not recommendable.
                {'skill_id': 'talent-management', 'total_chapters': 0, 'skill_name': 'Talent management'},
            ],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    by_id = {item['skill_id']: item for item in payload['skills']}
    assert by_id['ai-and-big-data']['is_candidate'] is True
    assert by_id['ai-and-big-data']['progress'] == 0.25
    assert by_id['talent-management']['is_candidate'] is False
    assert payload['selected_skill_count'] == 2


# --- the brief ------------------------------------------------------------------


def brief_body(checked_in_setup=True, skills=None):
    return {
        'local_date': TODAY.isoformat(),
        'local_hour': 9,
        'display_name': 'Ella',
        'skills': skills
        or [
            {'skill_id': 'ai-and-big-data', 'total_chapters': 2, 'skill_name': 'AI and big data'},
            {'skill_id': 'creative-thinking', 'total_chapters': 4, 'skill_name': 'Creative thinking'},
            {'skill_id': 'leadership-and-social-influence', 'total_chapters': 3, 'skill_name': 'Leadership'},
        ],
    }


def test_brief_before_checkin_offers_two_recommendations(client):
    response = client.post('/api/v1/learning/daily-brief', json=brief_body())

    assert response.status_code == 200
    payload = response.json()
    assert payload['variant'] == 'before_checkin'
    assert payload['checked_in_today'] is False
    assert payload['greeting'] == 'Good morning, Ella.'
    assert len(payload['recommendations']) == 2
    # No provider is configured in tests, so the deterministic text is used and
    # must not be stored as the final wording for the day.
    assert payload['generated_by_model'] is False
    assert client.store.briefs == {}


def test_brief_does_not_recommend_with_two_or_fewer_skills(client):
    response = client.post(
        '/api/v1/learning/daily-brief',
        json=brief_body(
            skills=[
                {'skill_id': 'ai-and-big-data', 'total_chapters': 2, 'skill_name': 'AI and big data'},
                {'skill_id': 'creative-thinking', 'total_chapters': 4, 'skill_name': 'Creative thinking'},
            ]
        ),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload['recommendations'] == []
    assert payload['summary']


def test_brief_after_checkin_is_a_different_variant_and_skips_skills_studied_today(client):
    client.post(
        '/api/v1/learning/progress',
        json={
            'local_date': TODAY.isoformat(),
            'chapters': [
                {'skill_id': 'ai-and-big-data', 'course_id': 'c2', 'chapter_index': 0, 'value': 5}
            ],
        },
    )
    client.post('/api/v1/learning/checkin', json={'local_date': TODAY.isoformat()})

    response = client.post('/api/v1/learning/daily-brief', json=brief_body())

    assert response.status_code == 200
    payload = response.json()
    assert payload['variant'] == 'after_checkin'
    assert payload['checked_in_today'] is True
    recommended = {item['skill_id'] for item in payload['recommendations']}
    # ai-and-big-data was studied today, so it must not be suggested again.
    assert 'ai-and-big-data' not in recommended


def test_a_stored_model_brief_is_returned_unchanged_on_the_next_visit(client):
    from datetime import datetime, timezone

    stored_payload = {
        'local_date': TODAY.isoformat(),
        'variant': 'before_checkin',
        'checked_in_today': False,
        'streak_days': 0,
        'greeting': 'Good morning, Ella.',
        'summary': 'A stored model-written summary that must not be regenerated.',
        'recommendations': [
            {
                'skill_id': 'ai-and-big-data',
                'skill_name': 'AI and big data',
                'reason': 'Widest gap.',
                'progress': 0.1,
                'importance_pct': None,
            }
        ],
        'closing': 'Keep going.',
        'generated_by_model': True,
        'generated_at': datetime.now(timezone.utc).isoformat(),
    }
    client.store.briefs[(TODAY, 'before_checkin')] = type(
        'Stored', (), {'content': stored_payload, 'generated_by_model': True}
    )()

    response = client.post('/api/v1/learning/daily-brief', json=brief_body())

    assert response.status_code == 200
    payload = response.json()
    assert payload['cached'] is True
    assert payload['summary'] == stored_payload['summary']


# --- catalogue is the source of truth for chapter totals and importance --------


def test_summary_uses_catalogue_chapter_counts_not_the_client_numbers(client):
    """A client cannot inflate or shrink progress by sending its own totals."""

    client.post('/api/v1/learning/progress', json=body_chapters(value=5))

    response = client.post(
        '/api/v1/learning/summary',
        json={
            'local_date': TODAY.isoformat(),
            'skills': [
                # The catalogue says two chapters; the client claims 999.
                {'skill_id': 'ai-and-big-data', 'total_chapters': 999},
            ],
        },
    )

    assert response.status_code == 200
    skill = response.json()['skills'][0]
    # 5 of 2*10 = 0.25, which is only possible when the catalogue total wins.
    assert skill['total_chapters'] == 2
    assert skill['progress'] == 0.25


def test_summary_accepts_a_skill_id_without_any_client_metadata(client):
    response = client.post(
        '/api/v1/learning/summary',
        json={'local_date': TODAY.isoformat(), 'skills': [{'skill_id': 'ai-and-big-data'}]},
    )

    assert response.status_code == 200
    skill = response.json()['skills'][0]
    assert skill['total_chapters'] == 2
    assert skill['is_candidate'] is True


def test_brief_uses_catalogue_importance_for_tie_breaking(client):
    """Importance comes from the catalogue, so the client cannot steer ranking."""

    response = client.post(
        '/api/v1/learning/daily-brief',
        json={
            'local_date': TODAY.isoformat(),
            'local_hour': 9,
            'skills': [
                # All three have equal progress (0), so importance decides.
                {'skill_id': 'creative-thinking', 'importance_pct': 1},
                {'skill_id': 'leadership-and-social-influence', 'importance_pct': 1},
                {'skill_id': 'ai-and-big-data', 'importance_pct': 1},
            ],
        },
    )

    assert response.status_code == 200
    recommended = [item['skill_id'] for item in response.json()['recommendations']]
    # The catalogue stub ranks ai-and-big-data highest; the client's flat 1s are ignored.
    assert recommended[0] == 'ai-and-big-data'
