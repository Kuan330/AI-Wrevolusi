"""Lightweight in-process request latency monitoring.

Records recent request durations so operators can spot slow endpoints without
pulling in a full metrics stack. Slow requests are also logged.
"""

from __future__ import annotations

import logging
import time
from collections import deque
from threading import Lock
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response

logger = logging.getLogger(__name__)

# Keep a bounded ring of recent samples for the /metrics snapshot.
_MAX_SAMPLES = 500
_SLOW_REQUEST_MS = 1500.0

_lock = Lock()
_samples: deque[dict[str, Any]] = deque(maxlen=_MAX_SAMPLES)
_totals: dict[str, dict[str, float | int]] = {}


def record_request(path: str, method: str, status_code: int, duration_ms: float) -> None:
    key = f'{method} {path}'
    with _lock:
        _samples.append(
            {
                'path': path,
                'method': method,
                'status_code': status_code,
                'duration_ms': round(duration_ms, 2),
            }
        )
        bucket = _totals.setdefault(
            key, {'count': 0, 'total_ms': 0.0, 'max_ms': 0.0, 'errors': 0}
        )
        bucket['count'] = int(bucket['count']) + 1
        bucket['total_ms'] = float(bucket['total_ms']) + duration_ms
        bucket['max_ms'] = max(float(bucket['max_ms']), duration_ms)
        if status_code >= 500:
            bucket['errors'] = int(bucket['errors']) + 1


def snapshot_metrics() -> dict[str, Any]:
    with _lock:
        routes = []
        for key, bucket in sorted(_totals.items(), key=lambda item: -float(item[1]['total_ms'])):
            count = int(bucket['count'])
            total_ms = float(bucket['total_ms'])
            routes.append(
                {
                    'route': key,
                    'count': count,
                    'avg_ms': round(total_ms / count, 2) if count else 0.0,
                    'max_ms': round(float(bucket['max_ms']), 2),
                    'errors': int(bucket['errors']),
                }
            )
        recent = list(_samples)[-20:]
    return {
        'sample_window': _MAX_SAMPLES,
        'routes': routes[:40],
        'recent': recent,
    }


def reset_metrics() -> None:
    """Test helper — clears accumulated samples."""

    with _lock:
        _samples.clear()
        _totals.clear()


class RequestTimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(
        self, request: Request, call_next: RequestResponseEndpoint
    ) -> Response:
        started = time.perf_counter()
        response = await call_next(request)
        duration_ms = (time.perf_counter() - started) * 1000
        # Prefer the matched template path so metrics group by route, not by id.
        route = request.scope.get('route')
        path = getattr(route, 'path', None) or request.url.path
        record_request(path, request.method, response.status_code, duration_ms)
        response.headers['X-Response-Time-Ms'] = f'{duration_ms:.1f}'
        if duration_ms >= _SLOW_REQUEST_MS:
            logger.warning(
                'slow_request method=%s path=%s status=%s duration_ms=%.1f',
                request.method,
                path,
                response.status_code,
                duration_ms,
            )
        return response
