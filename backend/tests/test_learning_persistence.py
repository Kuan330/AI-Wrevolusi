"""Offline persistence contracts; PostgreSQL concurrency still needs live testing."""

import asyncio
from datetime import date
from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock
from uuid import uuid4

import pytest
from sqlalchemy.dialects import postgresql

from app.schemas.learning import ChapterProgressIn
from app.services import learning_records as records

TODAY = date(2026, 9, 17)


def session(*results):
    return SimpleNamespace(execute=AsyncMock(side_effect=results), commit=AsyncMock())


def result(rows=(), scalar=None):
    return Mock(all=Mock(return_value=rows), scalar_one_or_none=Mock(return_value=scalar),
                scalar_one=Mock(return_value=scalar))


def chapter(index=0, value=5):
    return ChapterProgressIn(skill_id='skill', course_id='course', chapter_index=index, value=value)


def sql(statement):
    return str(statement.compile(dialect=postgresql.dialect()))


def test_progress_uses_one_conditional_batch_and_preserves_response_order():
    user = uuid4()
    db = session(result(rows=[('skill', 'course', 2)]),
                 result(rows=[('skill', 'course', 0, 5), ('skill', 'course', 1, 8)]))
    items = [chapter(2, 9), chapter(0, 5), chapter(1, 4)]
    accepted, rejected = asyncio.run(records.upsert_progress(db, user, local_date=TODAY, chapters=items))
    assert accepted == items[:2]
    assert [(item.chapter_index, item.stored_value, item.reason) for item in rejected] == [(1, 8, 'not_increase')]
    statement, read = [call.args[0] for call in db.execute.call_args_list]
    query = sql(statement)
    assert 'ON CONFLICT ON CONSTRAINT uq_learning_progress_chapter DO UPDATE' in query
    assert 'WHERE excluded.value > learning_progress.value' in query
    assert 'last_studied_on = excluded.last_studied_on' in query
    assert 'updated_at = now()' in query
    # Values lock in key order, while the HTTP response keeps request order.
    params = statement.compile(dialect=postgresql.dialect()).params
    assert [params[f'chapter_index_m{i}'] for i in range(3)] == [0, 1, 2]
    assert all(params[f'user_id_m{i}'] == user for i in range(3))
    assert 'learning_progress.user_id =' in sql(read)
    assert user in read.compile(dialect=postgresql.dialect()).params.values()
    db.commit.assert_awaited_once()


def test_new_progress_does_not_read_before_atomic_insert():
    db = session(result(rows=[('skill', 'course', 0)]))
    accepted, rejected = asyncio.run(records.upsert_progress(db, uuid4(), local_date=TODAY, chapters=[chapter()]))
    assert len(accepted) == 1 and not rejected
    db.execute.assert_awaited_once()
    db.commit.assert_awaited_once()


def test_duplicate_progress_is_rejected_before_any_database_call():
    db = session()
    with pytest.raises(ValueError, match='only once'):
        asyncio.run(records.upsert_progress(db, uuid4(), local_date=TODAY, chapters=[chapter(), chapter(value=8)]))
    db.execute.assert_not_awaited()
    db.commit.assert_not_awaited()


@pytest.mark.parametrize('returned_id, expected', [(None, False), (uuid4(), True)])
def test_checkin_uses_conflict_ignore_and_reports_whether_inserted(returned_id, expected):
    db = session(result(scalar=returned_id))
    assert asyncio.run(records.create_checkin(db, uuid4(), local_date=TODAY)) is expected
    db.execute.assert_awaited_once()
    assert 'ON CONFLICT ON CONSTRAINT uq_learning_checkin_day DO NOTHING' in sql(db.execute.call_args.args[0])
    db.commit.assert_awaited_once()


def test_brief_replacement_is_one_atomic_statement():
    persisted = object()
    db = session(result(scalar=persisted))
    actual = asyncio.run(records.store_brief(db, uuid4(), brief_date=TODAY, variant='before',
                                            content={'summary': 'Ready'}, generated_by_model=True))
    assert actual is persisted
    db.execute.assert_awaited_once()
    statement = db.execute.call_args.args[0]
    query = sql(statement)
    assert 'ON CONFLICT ON CONSTRAINT uq_daily_brief_day DO UPDATE' in query
    assert 'content = excluded.content' in query
    assert 'generated_by_model = excluded.generated_by_model' in query
    assert 'updated_at = now()' in query
    assert statement.get_execution_options()['populate_existing'] is True
    db.commit.assert_awaited_once()
