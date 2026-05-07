"""Trace storage for harness results.

Supports both in-memory (mock) and database-backed persistence.
"""

from __future__ import annotations

import json
from typing import Any

from harness_core.schemas import HarnessResult


class TraceStore:
    """Stores and retrieves ``HarnessResult`` traces.

    When no database session is provided, results are held in an in-memory
    dictionary (mock mode).
    """

    def __init__(self, db_session: Any = None) -> None:
        self._db = db_session
        self._memory: dict[str, list[HarnessResult]] = {}

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------

    def save_trace(self, result: HarnessResult) -> None:
        """Persist a single harness result."""
        if self._db is not None:
            self._save_to_db(result)
        else:
            self._save_to_memory(result)

    def save_traces(self, results: list[HarnessResult]) -> None:
        """Persist multiple harness results."""
        for r in results:
            self.save_trace(r)

    def _save_to_memory(self, result: HarnessResult) -> None:
        run_id = result.harness_id.split("-")[0] if "-" in result.harness_id else "default"
        if run_id not in self._memory:
            self._memory[run_id] = []
        self._memory[run_id].append(result)

    def _save_to_db(self, result: HarnessResult) -> None:
        """Save to database (stub -- expects a real session)."""
        pass

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    def get_traces(
        self,
        run_id: str,
        wave_number: int | None = None,
    ) -> list[HarnessResult]:
        """Return all traces for a run, optionally filtered by wave."""
        if self._db is not None:
            return self._get_from_db(run_id, wave_number)
        return self._get_from_memory(run_id, wave_number)

    def _get_from_memory(
        self,
        run_id: str,
        wave_number: int | None = None,
    ) -> list[HarnessResult]:
        results = self._memory.get(run_id, [])
        if wave_number is not None:
            # Infer wave number from harness ID suffix
            filtered: list[HarnessResult] = []
            for r in results:
                try:
                    parts = r.harness_id.split("w")
                    if len(parts) >= 2:
                        w = int(parts[1].split("-")[0])
                        if w == wave_number:
                            filtered.append(r)
                        continue
                except (ValueError, IndexError):
                    pass
                filtered.append(r)
            return filtered
        return list(results)

    def _get_from_db(
        self,
        run_id: str,
        wave_number: int | None = None,
    ) -> list[HarnessResult]:
        return []

    def get_failure_traces(self, run_id: str) -> list[HarnessResult]:
        """Return only traces where the harness did not pass."""
        return [r for r in self.get_traces(run_id) if not r.passed]

    # ------------------------------------------------------------------
    # Export
    # ------------------------------------------------------------------

    def export_traces_json(self, run_id: str) -> str:
        """Export all traces for a run as a JSON string."""
        traces = self.get_traces(run_id)
        data = [
            {
                "harness_id": t.harness_id,
                "passed": t.passed,
                "score": t.score,
                "failure_type": t.failure_type,
                "failure_reason": t.failure_reason,
                "duration_ms": t.duration_ms,
            }
            for t in traces
        ]
        return json.dumps(data, indent=2, default=str)
