"""Two-field occupation browsing uses stored ancestry, not code prefixes."""

import csv
from pathlib import Path

from .test_reference_fuzzy import _make_client
from sqlalchemy import text

from app.services.occupation_search import search_occupation_rows


def test_area_browsing_search_validation_and_cache_isolation():
    client = _make_client()
    connection = client._fixture_connection
    # Intentionally unrelated code prefixes prove that real parent links matter.
    for code, level, parent, title in [
        ('5', 'major', None, 'Service workers'),
        ('95', 'submajor', '2', 'Technical professionals'),
        ('951', 'minor', '95', 'Development professionals'),
        ('1234', 'unit', '951', 'Software testers'),
        ('2999', 'unit', '5', 'Software shop workers'),
    ]:
        connection.execute(text('INSERT INTO ref_occupations VALUES (:code, :level, :parent, :title, :description)'),
                           dict(code=code, level=level, parent=parent, title=title, description=''))
    try:
        with client:
            def codes(**params):
                response = client.get('/reference/occupations', params=params)
                assert response.status_code == 200
                return {row['occupation_code'] for row in response.json()}

            assert codes(area='2') == {'2512', '2221', '1234'}
            assert codes(area='2', q=' ') == {'2512', '2221', '1234'}
            assert codes(q='software') == {'2512', '1234', '2999'}
            assert codes(area='2', q='software') == {'2512', '1234'}
            assert codes(area='5', q='software') == {'2999'}
            # Repeat in another order to exercise scoped cache keys.
            assert codes(area='2', q='software') == {'2512', '1234'}
            assert codes(q='software') == {'2512', '1234', '2999'}
            assert codes(area='2', q='shop') == set()
            assert codes(parent='95') == {'951'}
            for invalid in ['', '999', '951', "2' OR 1=1 --"]:
                assert client.get('/reference/occupations', params={'area': invalid}).status_code == 422
    finally:
        connection.close()
        client._fixture_engine.dispose()


def test_common_job_terms_rank_actual_reference_titles_first():
    path = Path(__file__).resolve().parents[2] / 'data/reference/ref_occupations.csv'
    with path.open(encoding='utf-8-sig', newline='') as source:
        rows = [row for row in csv.DictReader(source) if row['level'] == 'unit']
    for query, title_word in [('nurse', 'nursing'), ('admin', 'administrative'), ('HR', 'human resource')]:
        direct = [row for row in rows if any(query.casefold() in row[field].casefold()
                                            for field in ('title', 'description', 'occupation_code'))]
        results = search_occupation_rows(rows, direct, query)
        assert title_word in results[0]['title'].casefold()
        assert any('Search wording:' in note for note in results[0]['evidence'])
        assert all(result['occupation_code'] in {row['occupation_code'] for row in rows} for result in results)
