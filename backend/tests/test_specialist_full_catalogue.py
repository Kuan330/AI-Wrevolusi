import asyncio
from copy import deepcopy

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, insert, select, func
from sqlalchemy.exc import IntegrityError

from app.db.session import get_db
from app.models.specialist import SpecialistRelease, SpecialistOccupation, SpecialistConcept, SpecialistRelation
from app.routers.reference import router
from scripts.seed_specialist_catalogue import import_catalogue

MODELS = [SpecialistRelease, SpecialistOccupation, SpecialistConcept, SpecialistRelation]
ROOT = 'http://data.europa.eu/esco/'
A = ROOT + 'occupation/00000000-0000-0000-0000-000000000001'
B = ROOT + 'occupation/00000000-0000-0000-0000-000000000002'
C = ROOT + 'occupation/00000000-0000-0000-0000-000000000003'
X = ROOT + 'skill/00000000-0000-0000-0000-000000000001'
Y = ROOT + 'skill/00000000-0000-0000-0000-000000000002'


def sample():
    return dict(source='ESCO', version='1.2.0', metadata={'attribution': 'European Commission', 'license_url': 'https://example.org/license'},
        occupations=[dict(uri=uri, label=label, description='Source description', isco_code=code, aliases=['drawing technician'] if uri == A else [])
            for uri, label, code in [(A, 'Mechanical technician', '3115'), (B, 'Marine technician', '3115'), (C, 'Nurse', '2221')]],
        skills=[dict(uri=X, label='analyse test data', description='Source text', skill_type='skill', aliases=['evaluate measurements']),
            dict(uri=Y, label='unlinked specialist knowledge', description='Source text', skill_type='knowledge', aliases=['rare knowledge'])],
        relations=[dict(occupation_uri=A, skill_uri=X, relation='essential'), dict(occupation_uri=A, skill_uri=X, relation='optional')])


@pytest.fixture
def catalogue_db():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False})
    event.listen(engine, 'connect', lambda connection, _: connection.execute('PRAGMA foreign_keys=ON'))
    for model in MODELS:
        model.__table__.create(engine)
    connection = engine.connect()

    class Database:
        bind = engine
        async def execute(self, statement, parameters=None):
            return connection.execute(statement, parameters) if parameters is not None else connection.execute(statement)

    db = Database()
    async def dependency():
        yield db
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = dependency
    with TestClient(app) as client:
        yield connection, db, client
    connection.close()
    engine.dispose()


def test_full_release_requires_choice_and_preserves_source_relationships(catalogue_db):
    connection, db, client = catalogue_db
    for endpoint in ['specialist-skills?occupation_code=3115', 'specialist-occupations', 'specialist-skill-search']:
        assert client.get('/reference/' + endpoint).status_code == 503
    asyncio.run(import_catalogue(db, sample()))
    connection.commit()
    response = client.get('/reference/specialist-skills', params={'occupation_code': '3115'}).json()
    assert len(response['occupations']) == 2
    assert response['occupation_uri'] == '' and response['skills'] == []
    response = client.get('/reference/specialist-skills', params={'occupation_uri': A}).json()
    assert response['isco_code'] == '3115'
    assert response['occupation_uri'] == A
    assert len(response['skills']) == 1
    assert response['skills'][0]['source_relations'] == ['essential', 'optional']
    assert response['attribution'] == 'European Commission'
    assert client.get('/reference/specialist-skills', params={'occupation_code': '2221'}).json()['occupation_uri'] == C
    missing = client.get('/reference/specialist-skills', params={'occupation_code': '9999'}).json()
    assert missing['occupations'] == [] and missing['skills'] == []
    assert client.get('/reference/specialist-skills', params={'occupation_code': '2221', 'occupation_uri': A}).status_code == 422
    assert client.get('/reference/specialist-skills', params={'occupation_uri': A[:-1] + '9'}).status_code == 422
    assert client.get('/reference/specialist-skills', params={'occupation_uri': "' OR 1=1"}).status_code == 422
    assert client.get('/reference/specialist-skills').status_code == 422


def test_global_search_preserves_unlinked_concepts_aliases_and_pagination(catalogue_db):
    connection, db, client = catalogue_db
    asyncio.run(import_catalogue(db, sample()))
    connection.commit()
    response = client.get('/reference/specialist-skill-search', params={'q': 'rare knowledge'}).json()
    assert response['total'] == 1 and response['items'][0]['uri'] == Y
    assert response['items'][0]['relation'] is None
    assert response['license_url']
    roles = client.get('/reference/specialist-occupations', params={'q': 'drawing'}).json()
    assert [role['uri'] for role in roles['items']] == [A]
    first = client.get('/reference/specialist-occupations', params={'limit': 1}).json()
    second = client.get('/reference/specialist-occupations', params={'limit': 1, 'offset': 1}).json()
    assert first['total'] == second['total'] == 3
    assert first['items'] != second['items']
    assert client.get('/reference/specialist-occupations', params={'q': '%'}).json()['total'] == 0
    assert client.get('/reference/specialist-occupations', params={'isco_code': '2221'}).json()['total'] == 1
    assert client.get('/reference/specialist-skill-search', params={'limit': 1000}).status_code == 422
    assert client.get('/reference/specialist-skill-search', params={'offset': -1}).status_code == 422


def test_import_is_immutable_idempotent_and_atomic(catalogue_db):
    connection, db, _ = catalogue_db
    payload = sample()
    assert asyncio.run(import_catalogue(db, payload)) is True
    connection.commit()
    assert asyncio.run(import_catalogue(db, payload)) is False
    changed = deepcopy(payload)
    changed['skills'][0]['label'] = 'changed'
    with pytest.raises(ValueError, match='different content'):
        asyncio.run(import_catalogue(db, changed))
    connection.rollback()
    bad = deepcopy(payload)
    bad['version'] = 'test-bad'
    bad['relations'][0]['skill_uri'] = 'missing'
    with pytest.raises(IntegrityError):
        with connection.begin():
            asyncio.run(import_catalogue(db, bad))
    assert connection.execute(select(func.count()).select_from(SpecialistRelease).where(SpecialistRelease.version == 'test-bad')).scalar_one() == 0
    assert connection.execute(select(func.count()).select_from(SpecialistConcept).where(SpecialistConcept.version == 'test-bad')).scalar_one() == 0
