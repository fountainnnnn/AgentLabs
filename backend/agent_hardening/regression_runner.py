"""Regression testing runner.

Re-runs previously-failed harnesses against an updated agent configuration to
determine whether patches have fixed the failures or if they persist.
"""

from __future__ import annotations

import asyncio
from typing import Any

from agent_hardening.schemas import AgentConfig, RegressionResult
from harness_core.schemas import HarnessCase, HarnessResult
from harness_core.runner import run_harness


async def run_regression(
    agent_config: AgentConfig | dict[str, Any],
    previous_failures: list[HarnessCase | dict[str, Any]],
    target_agent_fn: Any = None,
    verifier_fn: Any = None,
) -> RegressionResult:
    """Re-run previously-failed harnesses against an updated agent.

    Args:
        agent_config:      The new (patched) agent configuration.
        previous_failures: Harnesses that failed in a previous wave.
        target_agent_fn:   Async function for calling the agent.  If ``None``,
                           a mock that always passes is used.
        verifier_fn:       Verifier function.  If ``None``, a simple default
                           is used.

    Returns:
        A ``RegressionResult`` summarising which failures are fixed and which
        persist.
    """
    if isinstance(agent_config, AgentConfig):
        config_dict = agent_config.model_dump()
    else:
        config_dict = agent_config

    if target_agent_fn is None:
        target_agent_fn = _default_target_agent

    if verifier_fn is None:
        from agent_hardening.verifier_registry import verifier_registry
        verifier_fn = lambda rt, tc, hc, ac: verifier_registry.run(rt, tc, hc, ac)

    # Normalise harness inputs
    harness_cases: list[HarnessCase] = []
    for item in previous_failures:
        if isinstance(item, HarnessCase):
            harness_cases.append(item)
        elif isinstance(item, dict):
            harness_cases.append(HarnessCase(
                id=item.get("id", item.get("harness_id", "unknown")),
                family=item.get("family", item.get("category", "unknown")),
                category=item.get("category", "unknown"),
                severity=item.get("severity", "medium"),
                wave_number=item.get("wave_number", 0),
                messages_json=item.get("messages_json", item.get("prompt", "{}")),
                expected_behavior=item.get("expected_behavior", ""),
                correct_answer=item.get("correct_answer", ""),
                metadata=item.get("metadata", {}),
            ))

    results = await asyncio.gather(*[
        run_harness(h, target_agent_fn, verifier_fn, config_dict)
        for h in harness_cases
    ])

    now_passed = sum(1 for r in results if r.passed)
    still_failing = len(results) - now_passed

    details: list[dict[str, Any]] = []
    for original, result in zip(previous_failures, results):
        orig_id = ""
        if isinstance(original, HarnessCase):
            orig_id = original.id
        elif isinstance(original, dict):
            orig_id = original.get("id", original.get("harness_id", ""))
        details.append({
            "harness_id": orig_id,
            "previously_failed": True,
            "now_passed": result.passed,
            "failure_type": result.failure_type,
            "failure_reason": result.failure_reason,
            "score": result.score,
        })

    total = len(results)
    return RegressionResult(
        total_retested=total,
        previously_failed=total,
        now_passed=now_passed,
        still_failing=still_failing,
        fix_rate=round(now_passed / max(total, 1) * 100, 1),
        details=details,
    )


async def run_full_regression_suite(
    agent_config: AgentConfig | dict[str, Any],
    all_harnesses: list[HarnessCase | dict[str, Any]],
    target_agent_fn: Any = None,
    verifier_fn: Any = None,
) -> dict[str, Any]:
    """Run a comprehensive regression suite against an agent.

    This tests *all* harnesses (not just previously-failed ones) and returns
    a full breakdown.

    Returns:
        A dict with overall results, per-category results, and per-severity
        results.
    """
    if isinstance(agent_config, AgentConfig):
        config_dict = agent_config.model_dump()
    else:
        config_dict = agent_config

    if target_agent_fn is None:
        target_agent_fn = _default_target_agent

    if verifier_fn is None:
        from agent_hardening.verifier_registry import verifier_registry
        verifier_fn = lambda rt, tc, hc, ac: verifier_registry.run(rt, tc, hc, ac)

    # Normalise
    harness_cases: list[HarnessCase] = []
    for item in all_harnesses:
        if isinstance(item, HarnessCase):
            harness_cases.append(item)
        elif isinstance(item, dict):
            harness_cases.append(HarnessCase(
                id=item.get("id", item.get("harness_id", "unknown")),
                family=item.get("family", item.get("category", "unknown")),
                category=item.get("category", "unknown"),
                severity=item.get("severity", "medium"),
                wave_number=item.get("wave_number", 0),
                messages_json=item.get("messages_json", item.get("prompt", "{}")),
                expected_behavior=item.get("expected_behavior", ""),
                correct_answer=item.get("correct_answer", ""),
                metadata=item.get("metadata", {}),
            ))

    results = await asyncio.gather(*[
        run_harness(h, target_agent_fn, verifier_fn, config_dict)
        for h in harness_cases
    ])

    total = len(results)
    passed = sum(1 for r in results if r.passed)

    # Per-category
    cat_stats: dict[str, dict[str, int]] = {}
    for r in results:
        cat = r.failure_type or "unknown"
        if cat not in cat_stats:
            cat_stats[cat] = {"total": 0, "passed": 0}
        cat_stats[cat]["total"] += 1
        if r.passed:
            cat_stats[cat]["passed"] += 1

    per_category = {
        cat: {
            "pass_rate": round(st["passed"] / max(st["total"], 1) * 100, 1),
            "passed": st["passed"],
            "total": st["total"],
        }
        for cat, st in cat_stats.items()
    }

    return {
        "total_harnesses": total,
        "total_passed": passed,
        "total_failed": total - passed,
        "overall_pass_rate": round(passed / max(total, 1) * 100, 1),
        "per_category": per_category,
        "results": [
            {
                "harness_id": r.harness_id,
                "passed": r.passed,
                "score": r.score,
                "failure_type": r.failure_type,
            }
            for r in results
        ],
    }


# ---------------------------------------------------------------------------
# Default mock target agent
# ---------------------------------------------------------------------------

async def _default_target_agent(prompt: str) -> dict[str, Any]:
    """A mock agent that always refuses unsafe requests."""
    # Simple heuristic: return a safe refusal for any prompt containing
    # known attack keywords
    refusal_keywords = [
        "ignore", "override", "DAN", "jailbreak", "disregard",
        "bypass", "approve", "refund", "admin", "password",
    ]
    prompt_lower = prompt.lower()
    if any(kw in prompt_lower for kw in refusal_keywords):
        return {
            "response": "I cannot comply with that request as it violates my safety guidelines.",
            "tool_calls": [],
        }
    return {
        "response": "I'd be happy to help you with that request within policy guidelines.",
        "tool_calls": [],
    }
