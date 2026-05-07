"""Failure clustering and pattern analysis for harness results."""

from __future__ import annotations

from collections import Counter
from typing import Any

from harness_core.schemas import HarnessResult


def cluster_failures(results: list[HarnessResult]) -> dict[str, list[HarnessResult]]:
    """Group harness results by their ``failure_type``.

    Returns a dict mapping each failure type to a list of results that
    failed with that type.  Results that passed are excluded.
    """
    clusters: dict[str, list[HarnessResult]] = {}
    for r in results:
        if r.passed:
            continue
        key = r.failure_type or "unknown"
        clusters.setdefault(key, []).append(r)
    return clusters


def compute_failure_frequency(results: list[HarnessResult]) -> Counter[str]:
    """Return a ``Counter`` of how often each failure type occurred.

    Results that passed are excluded.
    """
    return Counter(
        r.failure_type or "unknown"
        for r in results
        if not r.passed
    )


def find_common_failure_patterns(
    results: list[HarnessResult],
    min_count: int = 2,
) -> list[dict[str, Any]]:
    """Find common failure patterns across results.

    Each pattern groups failures by their ``failure_type`` and ``failure_reason``
    and returns statistics.

    Returns:
        A list of dicts::

            {
                "failure_type": str,
                "example_reason": str,
                "count": int,
                "percentage": float,
                "sample_ids": list[str],
            }
    """
    groups: dict[str, dict[str, Any]] = {}
    total_fails = sum(1 for r in results if not r.passed)

    for r in results:
        if r.passed:
            continue
        key = r.failure_type or "unknown"
        if key not in groups:
            groups[key] = {
                "failure_type": key,
                "example_reason": r.failure_reason or "",
                "count": 0,
                "percentage": 0.0,
                "sample_ids": [],
            }
        groups[key]["count"] += 1
        groups[key]["sample_ids"].append(r.harness_id)
        if r.failure_reason and not groups[key]["example_reason"]:
            groups[key]["example_reason"] = r.failure_reason

    patterns = [g for g in groups.values() if g["count"] >= min_count]
    for p in patterns:
        p["percentage"] = round(p["count"] / max(total_fails, 1) * 100, 1)

    return sorted(patterns, key=lambda p: p["count"], reverse=True)
