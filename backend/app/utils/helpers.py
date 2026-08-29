from datetime import UTC, datetime


def utc_now() -> datetime:
    return datetime.now(UTC)


def is_blank(value: str | None) -> bool:
    return not value or not value.strip()
