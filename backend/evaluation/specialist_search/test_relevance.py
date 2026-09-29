"""Read-only relevance checks against an isolated, seeded PostgreSQL catalogue.

Run with SPECIALIST_SEARCH_TEST_DATABASE_URL pointing at a local test database
containing the pinned ESCO 1.2.0 import. No production database is accepted.
"""
import asyncio
import os

import pytest
from sqlalchemy.engine import make_url
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.services.specialist_catalogue import search_catalogue


@pytest.fixture
def search():
    url = os.environ.get('SPECIALIST_SEARCH_TEST_DATABASE_URL')
    if not url:
        pytest.skip('Set SPECIALIST_SEARCH_TEST_DATABASE_URL for PostgreSQL relevance checks')
    parsed = make_url(url)
    assert parsed.host in {'localhost', '127.0.0.1'} and 'test' in parsed.database.lower()

    def run(query, **kwargs):
        async def request():
            engine = create_async_engine(url)
            try:
                async with async_sessionmaker(engine)() as db:
                    return await search_catalogue(db, concepts=True, query=query, **kwargs)
            finally:
                await engine.dispose()
        return asyncio.run(request())
    return run


@pytest.mark.parametrize('query,expected,kind', [
    ('Excel', 'use spreadsheets software', 'terms'),
    ('prepare monthly sales reports', 'produce sales reports', 'related'),
    ('replying to customer complaints', 'handle customer complaints', 'related'),
    ('analyse test data', 'analyse test data', 'exact'),
    ('project management', 'project management', 'exact'),
    ('R', 'R', 'exact'),
    ('C++', 'C++', 'exact'),
    ('C#', 'C#', 'exact'),
    ('AI', 'principles of artificial intelligence', 'terms'),
    ('SQL', 'SQL', 'exact'),
    ('prepare monthly sales reports for our team and explain the main changes in revenue and customer orders', 'produce sales reports', 'related'),
    ('repair electrical wiring', 'repair wiring', 'related'),
])
def test_relevant_concept_is_first(search, query, expected, kind):
    result = search(query, limit=5)
    assert result['items'][0]['label'] == expected
    assert result['items'][0]['match_type'] == kind
    assert result['items'][0]['matched_terms']
    assert result['items'][0]['relation'] is None
    assert result['items'][0]['source'] == 'ESCO'
    assert result['items'][0]['version'] == '1.2.0'
    assert result['search_mode'] == ('related' if kind == 'related' else 'matches')


def test_related_results_pagination_and_full_count(search):
    all_results = search('analyse test data', limit=50)
    first = search('analyse test data', limit=3)
    second = search('analyse test data', limit=3, offset=3)
    assert all_results['total'] == first['total'] == second['total']
    assert all_results['total'] > 50  # Full count, not a truncated candidate pool.
    assert [item['uri'] for item in first['items'] + second['items']] == [item['uri'] for item in all_results['items'][:6]]
    assert any(item['match_type'] == 'related' for item in all_results['items'])


@pytest.mark.parametrize('query', ['zzxxyynonsense', '%', '_', 'the and to'])
def test_no_match_is_not_browse_all(search, query):
    result = search(query)
    assert result['total'] == 0 and result['items'] == []
    assert result['search_mode'] == 'none'


def test_software_terms_do_not_match_unrelated_word_fragments(search):
    excel = search('Excel', limit=50)
    assert not any('performer' in item['label'] or 'sport' in item['label'] for item in excel['items'])
    ai = search('AI', limit=50)
    assert not any(item['label'] == 'tai chi' for item in ai['items'])
    csharp = search('C#', limit=50)
    assert not any(item['label'] == 'C++' for item in csharp['items'])


def test_empty_query_preserves_catalogue_browsing(search):
    result = search('', limit=2)
    assert result['search_mode'] == 'browse'
    assert len(result['items']) == 2 and result['total'] == 13939
