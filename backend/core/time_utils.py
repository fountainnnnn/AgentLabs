"""Timestamp and duration utilities."""

import datetime


def utc_now() -> datetime.datetime:
    """Return the current UTC datetime."""
    return datetime.datetime.now(datetime.timezone.utc)


def utc_now_iso() -> str:
    """Return the current UTC time as an ISO-formatted string."""
    return utc_now().isoformat()


def elapsed_ms(start: datetime.datetime) -> float:
    """Compute milliseconds elapsed since *start*."""
    return (datetime.datetime.now(datetime.timezone.utc) - start).total_seconds() * 1000.0
