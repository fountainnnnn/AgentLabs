"""Replay data construction for the frontend replay view.

Converts harness results into a structured format that can be rendered as
an interactive replay of the agent's responses.
"""

from __future__ import annotations

import json
from typing import Any

from harness_core.schemas import HarnessResult


def build_replay_data(
    run_id: str,
    wave_number: int,
    results: list[HarnessResult],
) -> dict[str, Any]:
    """Build structured replay data from a set of harness results.

    Returns a dict consumable by the frontend's replay view::

        {
            "run_id": str,
            "wave_number": int,
            "total_harnesses": int,
            "harnesses": [
                {
                    "harness_id": str,
                    "passed": bool,
                    "score": float,
                    "failure_type": str | None,
                    "failure_reason": str | None,
                    "duration_ms": float,
                    "trace": list[dict],
                    "response_text": str,
                    "tool_calls": list[dict],
                    "verifier_results": list[dict],
                },
                ...
            ],
            "summary": { ... },
        }
    """
    harnesses_data: list[dict[str, Any]] = []
    for r in results:
        trace: list[dict[str, Any]] = []
        if r.trace_json:
            try:
                trace = json.loads(r.trace_json)
            except (json.JSONDecodeError, TypeError):
                trace = []

        verifier_data = [
            {
                "passed": v.passed,
                "rule_name": v.rule_name,
                "reason": v.reason,
                "matched_snippets": v.matched_snippets,
            }
            for v in r.verifier_results
        ]

        harnesses_data.append({
            "harness_id": r.harness_id,
            "passed": r.passed,
            "score": r.score,
            "failure_type": r.failure_type,
            "failure_reason": r.failure_reason,
            "duration_ms": r.duration_ms,
            "trace": trace,
            "response_text": r.response_text,
            "tool_calls": r.tool_calls,
            "verifier_results": verifier_data,
        })

    passed = sum(1 for r in results if r.passed)
    total = len(results)

    return {
        "run_id": run_id,
        "wave_number": wave_number,
        "total_harnesses": total,
        "harnesses": harnesses_data,
        "summary": {
            "passed": passed,
            "failed": total - passed,
            "pass_rate": round(passed / max(total, 1) * 100, 1),
            "avg_duration_ms": round(
                sum(r.duration_ms for r in results) / max(total, 1), 1
            ),
        },
    }


def build_replay_summary(replay_data: dict[str, Any]) -> dict[str, Any]:
    """Condense replay data into a lightweight summary for overviews.

    Omits per-harness trace details to keep the payload small.
    """
    harnesses = replay_data.get("harnesses", [])
    summary_harnesses: list[dict[str, Any]] = []
    for h in harnesses:
        summary_harnesses.append({
            "harness_id": h.get("harness_id"),
            "passed": h.get("passed"),
            "score": h.get("score"),
            "failure_type": h.get("failure_type"),
            "failure_reason": h.get("failure_reason"),
        })

    return {
        "run_id": replay_data.get("run_id"),
        "wave_number": replay_data.get("wave_number"),
        "total_harnesses": replay_data.get("total_harnesses"),
        "summary": replay_data.get("summary"),
        "harnesses": summary_harnesses,
    }
