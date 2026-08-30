from __future__ import annotations

from datetime import datetime, timezone

try:
    from datetime import UTC
except ImportError:
    UTC = timezone.utc


def utc_now() -> datetime:
    return datetime.now(UTC)


def is_blank(value: str | None) -> bool:
    return not value or not value.strip()
