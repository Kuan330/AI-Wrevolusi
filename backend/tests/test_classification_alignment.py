"""Same numeric codes must never silently cross occupation classifications."""
import csv
from pathlib import Path

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.db.session import get_db
from app.routers.reference import router as reference_router
from app.routers.exposure import router as exposure_router
from app.services.classification_alignment import normalize_classification_title


@pytest.fixture
def classification_client():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False})
    connection = engine.connect()
    connection.execute(text('CREATE TABLE ref_occupations (occupation_code TEXT, level TEXT, title TEXT)'))
    connection.execute(text('CREATE TABLE ref_ilo_tasks (isco_08 TEXT, title TEXT, task_id TEXT, task_text TEXT, score_2025 REAL, potential25 TEXT, mean_score_2025 REAL, source TEXT)'))
    root = Path(__file__).resolve().parents[2] / 'data/reference'
    codes = {'2351', '3151', '3115', '2221', '4111'}
    with (root / 'ref_occupations.csv').open() as source:
        for row in csv.DictReader(source):
            if row['occupation_code'] in codes:
                connection.execute(text('INSERT INTO ref_occupations VALUES (:occupation_code, :level, :title)'), row)
    with (root / 'ref_ilo_tasks.csv').open() as source:
        for row in csv.DictReader(source):
            if row['isco_08'] in codes:
                connection.execute(text('INSERT INTO ref_ilo_tasks VALUES (:isco_08, :title, :task_id, :task_text, :score_2025, :potential25, :mean_score_2025, :source)'), row)

    class Database:
        async def execute(self, statement, parameters=None):
            return connection.execute(statement, parameters or {})

    async def get_database():
        yield Database()

    app = FastAPI()
    app.include_router(reference_router)
    app.include_router(exposure_router)
    app.dependency_overrides[get_db] = get_database
    try:
        with TestClient(app) as client:
            yield client
    finally:
        connection.close()
        engine.dispose()


@pytest.mark.parametrize('code', ['2351', '3151', '4111', '9999'])
def test_unaligned_or_missing_classifications_block_tasks_and_exact_task_id_bypass(classification_client, code):
    response = classification_client.get(f'/reference/occupations/{code}/tasks')
    assert response.status_code == 422
    response = classification_client.post('/exposure/assessments', json={
        'occupation_code': code,
        'confirmed_tasks': [{'task_id': 'saved-task', 'task_text': 'Perform my saved work task', 'ilo_task_id': '1'}],
    })
    assert response.status_code == 422
    assert 'no checked ILO mapping' in response.json()['detail']


@pytest.mark.parametrize('code', ['3115', '2221'])
def test_matching_titles_allow_reference_discovery_and_assessment(classification_client, code):
    response = classification_client.get(f'/reference/occupations/{code}/tasks')
    assert response.status_code == 200
    task = response.json()[0]
    response = classification_client.post('/exposure/assessments', json={
        'occupation_code': code,
        'confirmed_tasks': [{'task_id': 'saved-task', 'task_text': task['task_text'], 'ilo_task_id': task['task_id']}],
    })
    assert response.status_code == 200
    assert response.json()['assessments'][0]['match_layer'] == 'exact'
    assert response.json()['classification_check'] == 'same-title-v1'


def test_normalisation_only_ignores_presentation_differences():
    assert normalize_classification_title('  SHIPS’   Engineers ') == normalize_classification_title("Ships' Engineers")
    assert normalize_classification_title('Music Teachers') != normalize_classification_title('Education Methods Specialists')


def test_legacy_response_has_no_classification_attestation():
    from app.schemas.exposure import ConfirmedTaskExposureAssessmentBatchResponse
    assert ConfirmedTaskExposureAssessmentBatchResponse(assessments=[]).classification_check is None
