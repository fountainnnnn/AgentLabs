"""Structured event logger for runs.

Provides an in-memory event buffer that can be flushed to JSON or plain-text
lines for API output, debugging, and export.
"""

import json
from typing import Any

from core.time_utils import utc_now_iso


class EventLog:
    """Structured event logger.

    Stores structured events in an in-memory list. Each event is a dict with
    timestamp, level, tag, message, and optional metadata.
    """

    def __init__(self) -> None:
        self._events: list[dict[str, Any]] = []

    def log(
        self,
        level: str,
        tag: str,
        message: str,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Record a structured event and return it.

        Args:
            level:    Severity level (e.g. ``"info"``, ``"warn"``, ``"error"``).
            tag:      Short event category (e.g. ``"wave_start"``, ``"patch_applied"``).
            message:  Human-readable description.
            metadata: Optional dict of additional structured data.

        Returns:
            The event dict.
        """
        event: dict[str, Any] = {
            "timestamp": utc_now_iso(),
            "level": level,
            "tag": tag,
            "message": message,
            "metadata": metadata or {},
        }
        self._events.append(event)
        return event

    def info(self, tag: str, message: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        """Shorthand for logging an info-level event."""
        return self.log("info", tag, message, metadata)

    def warn(self, tag: str, message: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        """Shorthand for logging a warning-level event."""
        return self.log("warn", tag, message, metadata)

    def error(self, tag: str, message: str, metadata: dict[str, Any] | None = None) -> dict[str, Any]:
        """Shorthand for logging an error-level event."""
        return self.log("error", tag, message, metadata)

    # ------------------------------------------------------------------
    # Queries
    # ------------------------------------------------------------------

    @property
    def events(self) -> list[dict[str, Any]]:
        """Return all recorded events (read-only view)."""
        return list(self._events)

    def by_tag(self, tag: str) -> list[dict[str, Any]]:
        """Return all events with a matching tag."""
        return [e for e in self._events if e["tag"] == tag]

    def by_level(self, level: str) -> list[dict[str, Any]]:
        """Return all events with a matching level."""
        return [e for e in self._events if e["level"] == level]

    def last(self, n: int = 10) -> list[dict[str, Any]]:
        """Return the last *n* events."""
        return self._events[-n:]

    def clear(self) -> None:
        """Clear all recorded events."""
        self._events.clear()

    # ------------------------------------------------------------------
    # Formatting helpers
    # ------------------------------------------------------------------

    def to_json(self, indent: int = 2) -> str:
        """Serialize all events to a JSON string."""
        return json.dumps(self._events, indent=indent, default=str)

    def to_lines(self) -> list[str]:
        """Format each event as a single human-readable line."""
        lines: list[str] = []
        for ev in self._events:
            meta = ev["metadata"]
            meta_str = f" | {json.dumps(meta, default=str)}" if meta else ""
            lines.append(f"[{ev['timestamp']}] [{ev['level']}] <{ev['tag']}> {ev['message']}{meta_str}")
        return lines
