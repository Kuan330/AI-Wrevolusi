import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy.exc import OperationalError

from app.db.session import get_db
from app.routers.reference import router
from app.services.specialist_catalogue import load_pilot


def test_official_pilot_preserves_concepts_and_provenance():
    payload = load_pilot()
    assert len(payload['skills']) == 39
    assert sum(row['relation'] == 'essential' for row in payload['skills']) == 14
    skill = next(row for row in payload['skills'] if row['label'] == 'analyse test data')
    assert skill['uri'] == 'http://data.europa.eu/esco/skill/81a2db2c-7e55-44d0-9cd9-74c25147d7cd'
    assert skill['skill_type'] == 'skill'
    assert skill['description']
    assert len(skill['provenance']['sha256']) == 64
    assert any(row['skill_type'] == 'knowledge' for row in payload['skills'])
    assert 'v1.2.0' in payload['provenance']['url']
    assert 'Malaysian' in payload['mapping_note']
    assert payload['license_url'] and payload['retrieved_at']


@pytest.mark.parametrize('mutation', ['version', 'duplicate', 'relation', 'unpinned'])
def test_import_rejects_invalid_snapshot(tmp_path, mutation):
    payload = load_pilot()
    if mutation == 'version':
        payload['version'] = 'latest'
    elif mutation == 'duplicate':
        payload['skills'].append(payload['skills'][0])
    elif mutation == 'relation':
        payload['skills'][0]['relation'] = 'inferred'
    else:
        payload['skills'][0]['provenance']['url'] = 'https://ec.europa.eu/esco/api/resource/skill'
    file = tmp_path / 'bad.json'
    file.write_text(json.dumps(payload))
    with pytest.raises(ValueError):
        load_pilot(file)


def test_database_failure_is_retryable_without_made_up_skills():
    class Database:
        async def execute(self, statement):
            raise OperationalError('offline', {}, Exception('offline'))

    async def database():
        yield Database()

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = database
    with TestClient(app) as client:
        response = client.get('/reference/specialist-skills', params={'occupation_code': '3115'})
        assert response.status_code == 503
        assert 'skills' not in response.json()
