from app.main import app as local_app
from main import app as vercel_app


def test_vercel_mount_preserves_public_api_path() -> None:
    local_paths = local_app.openapi()['paths']
    vercel_paths = vercel_app.openapi()['paths']

    assert '/api/v1/auth/login' in local_paths
    assert '/v1/auth/login' in vercel_paths
    assert '/api/v1/auth/login' not in vercel_paths
