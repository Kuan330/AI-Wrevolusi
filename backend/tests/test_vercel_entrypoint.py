from main import app as vercel_app


def test_vercel_mount_preserves_public_api_path() -> None:
    vercel_paths = vercel_app.openapi()['paths']

    assert '/api/v1/auth/login' in vercel_paths
    assert '/api/healthz' in vercel_paths
