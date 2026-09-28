"""Fuzzy recall tests for the occupation search endpoint.

These tests exercise ``GET /api/v1/reference/occupations?q=...`` against an
in-memory SQLite fixture (the same technique as ``test_reference.py``) and the
optional keyword normaliser through a fake gateway dependency.
"""

from __future__ import annotations

import time
from types import SimpleNamespace

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.db.session import get_db
from app.routers.reference import clear_occupation_search_caches, get_reference_ai_gateway, router
from app.services.occupation_search import (
    MAXIMUM_FUZZY_OCCUPATION_RESULTS,
    normalise_search_query,
    search_occupation_rows,
)

UNIT_ROWS = [
    dict(
        code='5222',
        level='unit',
        parent='5',
        title='Shop supervisors',
        description='Supervise sales staff in shops and stores.',
    ),
    dict(
        code='5221',
        level='unit',
        parent='5',
        title='Shopkeepers',
        description='Run small shops and manage stock.',
    ),
    dict(
        code='2512',
        level='unit',
        parent='2',
        title='Software developers',
        description='Design and build software applications.',
    ),
    dict(
        code='2221',
        level='unit',
        parent='2',
        title='Nursing professionals',
        description='Provide patient care.',
    ),
]

MAJOR_ROW = dict(
    code='2',
    level='major',
    parent=None,
    title='Professionals',
    description='',
)


def _make_client(gateway=None) -> TestClient:
    clear_occupation_search_caches()
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False})
    connection = engine.connect()
    connection.execute(
        text(
            'CREATE TABLE ref_occupations '
            '(occupation_code TEXT, level TEXT, parent_code TEXT, title TEXT, description TEXT)'
        )
    )
    for row in [MAJOR_ROW, *UNIT_ROWS]:
        connection.execute(
            text('INSERT INTO ref_occupations VALUES (:code, :level, :parent, :title, :description)'),
            row,
        )

    class Database:
        async def execute(self, statement, parameters=None):
            return connection.execute(
                text(str(statement).replace('ILIKE', 'LIKE')), parameters or {}
            )

    async def database():
        yield Database()

    application = FastAPI()
    application.include_router(router)
    application.dependency_overrides[get_db] = database
    if gateway is not None:
        application.dependency_overrides[get_reference_ai_gateway] = lambda: gateway

    client = TestClient(application)
    client._fixture_connection = connection  # type: ignore[attr-defined]
    client._fixture_engine = engine  # type: ignore[attr-defined]
    return client


def _search(client: TestClient, query: str) -> list[dict]:
    response = client.get('/reference/occupations', params={'q': query})
    assert response.status_code == 200
    return response.json()


class FakeGateway:
    """Minimal gateway seam returning fixed English keywords."""

    def __init__(self, keywords) -> None:
        self.keywords = keywords
        self.calls: list[tuple[str, dict]] = []

    def run_structured(self, *, operation, payload, response_model, **_kwargs):
        self.calls.append((operation, payload))
        return SimpleNamespace(value=response_model(keywords=self.keywords))


def test_plurals_and_case_are_recalled_with_high_confidence() -> None:
    client = _make_client()
    try:
        rows = _search(client, 'nursing professional')
        assert [row['occupation_code'] for row in rows] == ['2221']
        assert rows[0]['confidence'] >= 0.9
        assert rows[0]['match_type'] in {'direct', 'fuzzy'}
    finally:
        client._fixture_connection.close()
        client._fixture_engine.dispose()


def test_word_order_does_not_matter() -> None:
    client = _make_client()
    try:
        rows = _search(client, 'developers software')
        assert rows[0]['occupation_code'] == '2512'
    finally:
        client._fixture_connection.close()
        client._fixture_engine.dispose()


def test_typos_within_two_edits_still_recall_the_occupation() -> None:
    client = _make_client()
    try:
        rows = _search(client, 'shoop superviser')
        assert rows[0]['occupation_code'] == '5222'
        assert any('close to' in entry for entry in rows[0]['evidence'])

        rows = _search(client, 'superveser')
        assert rows and rows[0]['occupation_code'] == '5222'
        assert rows[0]['confidence'] >= 0.5
    finally:
        client._fixture_connection.close()
        client._fixture_engine.dispose()


def test_mixed_script_query_recalls_by_its_english_tokens() -> None:
    client = _make_client()
    try:
        rows = _search(client, 'shop 主管')
        assert rows[0]['occupation_code'] == '5222'
    finally:
        client._fixture_connection.close()
        client._fixture_engine.dispose()


def test_direct_substring_hits_are_preserved_and_ranked_first() -> None:
    client = _make_client()
    try:
        rows = _search(client, 'SOFTWARE')
        assert [row['occupation_code'] for row in rows] == ['2512']
        assert rows[0]['match_type'] == 'direct'

        rows = _search(client, 'patient care')
        assert [row['occupation_code'] for row in rows] == ['2221']

        rows = _search(client, '2512')
        assert [row['occupation_code'] for row in rows] == ['2512']
    finally:
        client._fixture_connection.close()
        client._fixture_engine.dispose()


def test_unrelated_queries_return_an_empty_list_instead_of_guessing() -> None:
    client = _make_client()
    try:
        assert _search(client, 'astronaut trainer') == []
        assert _search(client, 'zebra wrangler') == []
        assert _search(client, "' OR 1=1 --") == []
    finally:
        client._fixture_connection.close()
        client._fixture_engine.dispose()


def test_search_results_expose_confidence_and_evidence_only_when_searching() -> None:
    client = _make_client()
    try:
        row = _search(client, 'shop supervisor')[0]
        assert {
            'occupation_code',
            'level',
            'parent_code',
            'title',
            'description',
            'confidence',
            'evidence',
            'match_type',
        } <= set(row)

        plain = client.get('/reference/occupations').json()[0]
        assert 'confidence' not in plain
        parent_rows = client.get('/reference/occupations', params={'parent': '2'}).json()
        assert all('confidence' not in item for item in parent_rows)
    finally:
        client._fixture_connection.close()
        client._fixture_engine.dispose()


def test_chinese_query_uses_the_optional_keyword_normaliser() -> None:
    gateway = FakeGateway(['shop', 'supervisor'])
    client = _make_client(gateway=gateway)
    try:
        rows = _search(client, '商店主管')
        assert rows and rows[0]['occupation_code'] == '5222'
        assert rows[0]['match_type'] == 'fuzzy'
        assert any('keywords' in entry for entry in rows[0]['evidence'])
        assert gateway.calls and gateway.calls[0][0] == 'occupation-search-keywords'
    finally:
        client._fixture_connection.close()
        client._fixture_engine.dispose()


def test_chinese_query_without_a_normaliser_returns_empty_rather_than_guessing() -> None:
    client = _make_client()
    try:
        assert _search(client, '商店主管') == []
    finally:
        client._fixture_connection.close()
        client._fixture_engine.dispose()


def test_keyword_normaliser_failures_are_contained() -> None:
    class ExplodingGateway:
        def run_structured(self, **_kwargs):
            raise RuntimeError('provider down')

    assert normalise_search_query('商店主管', ExplodingGateway()) == []

    class JunkGateway:
        def run_structured(self, *, response_model, **_kwargs):
            return SimpleNamespace(
                value=response_model(
                    keywords=['SHOP!!', '商店', 'supervisor', 'supervisor', '  ']
                )
            )

    assert normalise_search_query('商店主管', JunkGateway()) == ['shop', 'supervisor']


def test_scoring_a_thousand_rows_stays_within_the_latency_budget() -> None:
    rows = [
        dict(
            occupation_code=str(1000 + index),
            level='unit',
            parent_code='9',
            title=f'Occupation {index} specialists',
            description=f'Handle records and coordinate work for unit {index}.',
        )
        for index in range(1000)
    ]
    rows.append(
        dict(
            occupation_code='5222',
            level='unit',
            parent_code='5',
            title='Shop supervisors',
            description='Supervise sales staff in shops and stores.',
        )
    )

    started = time.perf_counter()
    hits = search_occupation_rows(rows, [], 'shoop superviser')
    elapsed = time.perf_counter() - started

    assert hits and hits[0]['occupation_code'] == '5222'
    assert len(hits) <= MAXIMUM_FUZZY_OCCUPATION_RESULTS
    assert elapsed < 1.0, f'fuzzy scoring took {elapsed:.3f}s for 1001 rows'
