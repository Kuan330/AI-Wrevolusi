from fastapi.testclient import TestClient

from app.db.session import get_db
from app.main import create_app


class FakeReferenceVersionResult:
    def scalar_one(self) -> str:
        return 'reference-version-1'


class FakeReferenceVersionDatabaseSession:
    async def execute(self, *_args, **_kwargs) -> FakeReferenceVersionResult:
        return FakeReferenceVersionResult()


def test_reference_data_version_endpoint_returns_database_version() -> None:
    application = create_app('/api')

    async def provide_fake_reference_version_database_session():
        yield FakeReferenceVersionDatabaseSession()

    application.dependency_overrides[get_db] = provide_fake_reference_version_database_session
    with TestClient(application) as client:
        response = client.get('/api/v1/reference/version')

    assert response.status_code == 200
    assert response.json() == {'version': 'reference-version-1'}
