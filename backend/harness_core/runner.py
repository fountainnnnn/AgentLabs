"""Harness execution engine.

Runs individual test harnesses or entire waves against a target agent
function.
"""

from __future__ import annotations

import asyncio
import json
import time
from typing import Any, Callable, Coroutine

from harness_core.schemas import HarnessCase, HarnessResult, VerifierResult, RewardComponent

# Target agent signature: async (prompt: str) -> dict
TargetAgentFn = Callable[[str], Coroutine[Any, Any, dict[str, Any]]]

# Verifier signature: (response_text, tool_calls, harness, agent_config) -> VerifierResult
VerifierFn = Callable[..., VerifierResult]


async def run_harness(
    harness: HarnessCase,
    target_agent_fn: TargetAgentFn,
    verifier_fn: VerifierFn | None = None,
    agent_config: dict[str, Any] | None = None,
) -> HarnessResult:
    """Execute a single harness against an agent function.

    Steps:
    1. Send the prompt(s) to the agent.
    2. Collect the response text and tool calls.
    3. Run verifier checks.
    4. Compute pass/fail and score.
    5. Return a ``HarnessResult``.

    Args:
        harness:         The test case to execute.
        target_agent_fn: Coroutine that takes a prompt string and returns
                         ``{"response": ..., "tool_calls": [...]}``.
        verifier_fn:     Optional callable that returns a ``VerifierResult``.
        agent_config:    Agent configuration dict (passed to verifier).

    Returns:
        Populated ``HarnessResult``.
    """
    start = time.monotonic()
    trace: list[dict[str, Any]] = []

    # Determine the input messages
    try:
        messages = json.loads(harness.messages_json)
        if isinstance(messages, dict):
            messages = [messages]
    except (json.JSONDecodeError, TypeError):
        messages = [{"role": "user", "content": harness.messages_json}]

    # -- Execute agent calls --------------------------------------------------
    response_text = ""
    tool_calls: list[dict[str, Any]] = []
    all_verifier_results: list[VerifierResult] = []

    for msg in messages:
        user_prompt = msg.get("content", "") if isinstance(msg, dict) else str(msg)
        step_start = time.monotonic()
        try:
            agent_output = await target_agent_fn(user_prompt)
            step_duration = (time.monotonic() - step_start) * 1000.0

            step_response = agent_output.get("response", agent_output.get("text", ""))
            step_tools = agent_output.get("tool_calls", agent_output.get("tools", []))

            if isinstance(step_tools, str):
                try:
                    step_tools = json.loads(step_tools)
                except json.JSONDecodeError:
                    step_tools = []

            response_text = step_response
            tool_calls.extend(step_tools)

            trace.append({
                "step": len(trace) + 1,
                "action": "agent_call",
                "input": user_prompt[:200],
                "output": step_response[:200],
                "duration_ms": round(step_duration, 1),
                "timestamp": __import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                ).isoformat(),
            })
        except Exception as exc:
            response_text = f"[EXECUTION ERROR] {exc}"
            trace.append({
                "step": len(trace) + 1,
                "action": "agent_call",
                "input": user_prompt[:200],
                "output": f"ERROR: {exc}",
                "duration_ms": 0.0,
                "timestamp": __import__("datetime").datetime.now(
                    __import__("datetime").timezone.utc
                ).isoformat(),
            })

    # -- Verifier checks -----------------------------------------------------
    if verifier_fn is not None:
        vr = verifier_fn(
            response_text=response_text,
            tool_calls=tool_calls,
            harness_category=harness.category,
            agent_config=agent_config or {},
        )
        all_verifier_results.append(vr)

    passed = all(v.passed for v in all_verifier_results) if all_verifier_results else True
    failure_type = None
    failure_reason = None
    matched_snippets: list[str] = []

    if not passed:
        failed_checks = [v for v in all_verifier_results if not v.passed]
        if failed_checks:
            worst = failed_checks[0]
            failure_type = worst.rule_name
            failure_reason = worst.reason
            matched_snippets = worst.matched_snippets

    duration = (time.monotonic() - start) * 1000.0

    reward_components = [
        RewardComponent(name="policy_adherence", score=1.0 if passed else 0.0, weight=1.0, detail="")
    ]

    score = 1.0 if passed else 0.0

    return HarnessResult(
        harness_id=harness.id,
        response_text=response_text,
        tool_calls=tool_calls,
        verifier_results=all_verifier_results,
        reward_components=reward_components,
        passed=passed,
        score=score,
        failure_type=failure_type,
        failure_reason=failure_reason,
        matched_snippets=matched_snippets,
        trace_json=json.dumps(trace, indent=2, default=str),
        duration_ms=round(duration, 1),
    )


async def run_wave(
    harnesses: list[HarnessCase],
    target_agent_fn: TargetAgentFn,
    verifier_fn: VerifierFn | None = None,
    agent_config: dict[str, Any] | None = None,
    concurrency: int = 1,
) -> list[HarnessResult]:
    """Execute all harnesses in a wave.

    When *concurrency* > 1, harnesses are run concurrently via
    ``asyncio.gather`` (limited by a semaphore).
    """
    if concurrency <= 1:
        results: list[HarnessResult] = []
        for h in harnesses:
            r = await run_harness(h, target_agent_fn, verifier_fn, agent_config)
            results.append(r)
        return results

    sem = asyncio.Semaphore(concurrency)

    async def _limited(h: HarnessCase) -> HarnessResult:
        async with sem:
            return await run_harness(h, target_agent_fn, verifier_fn, agent_config)

    return await asyncio.gather(*(_limited(h) for h in harnesses))
