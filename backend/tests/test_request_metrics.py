"""Request timing middleware and /api/metrics snapshot."""

from fastapi.testclient import TestClient

from app.main import create_app
from app.middleware.timing import reset_metrics


def test_metrics_endpoint_records_request_latency():
    reset_metrics()
    application = create_app('/api')
    with TestClient(application) as client:
        health = client.get('/api/healthz')
        assert health.status_code == 200
        assert 'X-Response-Time-Ms' in health.headers

        metrics = client.get('/api/metrics')
        assert metrics.status_code == 200
        body = metrics.json()
        assert body['sample_window'] >= 1
        routes = {item['route'] for item in body['routes']}
        assert 'GET /api/healthz' in routes
        assert any(item['path'] == '/api/healthz' for item in body['recent'])
