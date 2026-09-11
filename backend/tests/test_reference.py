from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text

from app.db.session import get_db
from app.routers.reference import router


def test_database_occupation_search_browsing_and_tasks():
    # SQLite exercises the query against occupations outside the original pilot.
    # PostgreSQL ILIKE is translated to SQLite's case-insensitive LIKE for this fixture.
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False})
    connection = engine.connect()
    connection.execute(text('CREATE TABLE ref_occupations (occupation_code TEXT, level TEXT, parent_code TEXT, title TEXT, description TEXT)'))
    for row in [
        dict(code='2', level='major', parent=None, title='Professionals', description=''),
        dict(code='2512', level='unit', parent='2', title='Software developers', description='Design software applications'),
        dict(code='2221', level='unit', parent='2', title='Nursing professionals', description='Provide patient care'),
    ]:
        connection.execute(text('INSERT INTO ref_occupations VALUES (:code, :level, :parent, :title, :description)'), row)
    connection.execute(text('CREATE TABLE ref_ilo_tasks (isco_08 TEXT, task_id TEXT, task_text TEXT, score_2025 REAL, potential25 TEXT, mean_score_2025 REAL)'))

    class Database:
        async def execute(self, statement, parameters=None):
            return connection.execute(text(str(statement).replace('ILIKE', 'LIKE')), parameters or {})

    async def database():
        yield Database()

    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides[get_db] = database
    try:
        with TestClient(app) as client:
            assert client.get('/reference/occupations').json()[0]['occupation_code'] == '2'
            assert len(client.get('/reference/occupations', params={'parent': '2'}).json()) == 2
            for query, code in [(' SOFTWARE ', '2512'), ('patient care', '2221'), ('2512', '2512')]:
                response = client.get('/reference/occupations', params={'q': query})
                assert response.status_code == 200
                assert [row['occupation_code'] for row in response.json()] == [code]
            assert client.get('/reference/occupations', params={'q': "' OR 1=1 --"}).json() == []
            assert client.get('/reference/occupations/2512').json()['title'] == 'Software developers'
            assert client.get('/reference/occupations/9999').status_code == 404
            assert client.get('/reference/occupations/2512/tasks').json() == []
    finally:
        connection.close()
        engine.dispose()
