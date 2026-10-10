"""Hardening loop orchestrator: attack -> verify -> patch -> retest -> compare -> export.

Every step is persisted as run events (consumed by the logs panel and the arena),
case results, patches and artifacts.
"""

from __future__ import annotations

import copy
import traceback
from typing import Any

from llm.provider import LLMProvider, get_provider
from services import exporter, reports, run_store
from services.harness import generate_wave
from services.patcher import apply_patch, propose_patch, refine_with_llm
from services.target_agent import AgentWrapper
from services.verifier import VERIFIER_IDS, verify


def truth_labels(provider: LLMProvider) -> tuple[str, str]:
    if provider.is_mock:
        return "simulated", "mock_provider: target agent replies come from the deterministic offline simulator"
    return "real", f"live_provider: target agent replies come from {provider.name}"


async def execute_case(wrapper: AgentWrapper, case: dict[str, Any], phase: str, generation: int) -> dict[str, Any]:
    outcome = await wrapper.run(case["prompt"])
    verdict = verify(case["prompt"], outcome["response"], outcome["tool_calls"], case["category"], wrapper.config)
    return {
        **case,
        "phase": phase,
        "generation": generation,
        "response": outcome["response"],
        "tool_calls": outcome["tool_calls"],
        "wrapper_actions": outcome["wrapper_actions"],
        "latency_ms": outcome["latency_ms"],
        **verdict,
    }


def _case_event_payload(result: dict[str, Any]) -> dict[str, Any]:
    return {
        "case_id": result["case_id"],
        "category": result["category"],
        "severity": result["severity"],
        "prompt": result["prompt"],
        "response": result["response"][:600],
        "passed": result["passed"],
        "failure_category": result["failure_category"],
        "failure_reason": result["failure_reason"],
        "generation": result["generation"],
        "tool_calls": result["tool_calls"],
        "wrapper_actions": result["wrapper_actions"],
        "verifiers_failed": [v["id"] for v in result["verifier_results"] if not v["passed"]],
    }


def _rate(results: list[dict[str, Any]]) -> float:
    return round(100 * sum(1 for r in results if not r["passed"]) / max(len(results), 1), 1)


async def run_hardening(run_id: str, agent_config: dict[str, Any], waves: int, cases_per_wave: int, seed: int = 7,
                        provider: LLMProvider | None = None) -> None:
    provider = provider or get_provider()
    events = run_store.EventWriter(run_id)
    real_or_simulated, truth_mode = truth_labels(provider)
    try:
        await run_store.update_run(run_id, status="running")
        await events.emit("run_started", f"Hardening {agent_config['name']} with {provider.name}",
                          agent=agent_config["name"], provider=provider.name, waves=waves,
                          cases_per_wave=cases_per_wave, verifiers=VERIFIER_IDS, real_or_simulated=real_or_simulated)
        v0_config = copy.deepcopy(agent_config)
        config = copy.deepcopy(agent_config)
        generation = 0
        used: set[str] = set()
        all_cases: list[dict[str, Any]] = []
        wave_summaries: list[dict[str, Any]] = []

        for wave in range(1, waves + 1):
            cases = generate_wave(wave, cases_per_wave, seed=seed, exclude=used)
            all_cases.extend(cases)
            await events.emit("wave_started", f"Wave {wave}: {len(cases)} attacks against v{generation}", wave=wave,
                              phase="pre_patch", generation=generation,
                              cases=[{k: c[k] for k in ("case_id", "category", "severity", "prompt")} for c in cases])
            wrapper = AgentWrapper(config, provider)
            pre = []
            for case in cases:
                result = await execute_case(wrapper, case, "pre_patch", generation)
                pre.append(result)
                await run_store.save_case_result(run_id, result)
                await events.emit("case_result", f"{'PASS' if result['passed'] else 'FAIL'} {case['category']}",
                                  wave=wave, phase="pre_patch", **_case_event_payload(result))
            failures = [r for r in pre if not r["passed"]]
            await events.emit("wave_summary", f"Wave {wave}: {len(failures)}/{len(pre)} attacks breached v{generation}",
                              wave=wave, phase="pre_patch", passed=len(pre) - len(failures), failed=len(failures),
                              failure_rate=_rate(pre), generation=generation)
            summary: dict[str, Any] = {"wave": wave, "cases": len(cases), "pre_patch_failures": len(failures),
                                       "pre_patch_failure_rate": _rate(pre), "generation_before": generation}
            if failures:
                patch = propose_patch(config, failures, generation + 1)
                patch = await refine_with_llm(patch, config, failures, provider)
                if patch["prompt_rules"] or patch["tool_policies"] or patch["output_filters"] or patch["llm_rules"]:
                    config, changes = apply_patch(config, patch)
                    generation = patch["generation"]
                    await run_store.save_patch(run_id, wave, patch, changes, config)
                    await events.emit("patch_applied", patch["title"], wave=wave, phase="patch", generation=generation,
                                      title=patch["title"], rationale=patch["rationale"], source=patch["source"],
                                      failure_clusters=patch["failure_clusters"], changes=changes)
                    wrapper = AgentWrapper(config, provider)
                    await events.emit("retest_started", f"Retesting wave {wave} against v{generation}", wave=wave,
                                      phase="post_patch", generation=generation,
                                      cases=[{k: c[k] for k in ("case_id", "category", "severity", "prompt")} for c in cases])
                    post = []
                    for case in cases:
                        result = await execute_case(wrapper, case, "post_patch", generation)
                        post.append(result)
                        await run_store.save_case_result(run_id, result)
                        await events.emit("case_result", f"{'PASS' if result['passed'] else 'FAIL'} {case['category']}",
                                          wave=wave, phase="post_patch", **_case_event_payload(result))
                    comparison = reports.compare(pre, post)
                    summary.update(post_patch_failure_rate=_rate(post), comparison=comparison, patch_title=patch["title"])
                    await events.emit("retest_summary",
                                      f"Wave {wave} retest: {comparison['improvements']} fixed, {comparison['regressions']} regressed",
                                      wave=wave, phase="post_patch", generation=generation, **comparison)
                else:
                    summary["patch_title"] = None
                    await events.emit("patch_skipped",
                                      "Failures hit vectors that are already guarded; no new defence available",
                                      wave=wave, phase="patch", generation=generation,
                                      failure_clusters=patch["failure_clusters"])
            summary["generation_after"] = generation
            wave_summaries.append(summary)

        # Clean A/B on every case: original v0 versus the final hardened generation.
        await events.emit("regression_started", f"Regression suite: {len(all_cases)} cases, v0 vs v{generation}",
                          phase="regression", generation=generation)
        v0_wrapper, final_wrapper = AgentWrapper(v0_config, provider), AgentWrapper(config, provider)
        before, after = [], []
        for case in all_cases:
            b = await execute_case(v0_wrapper, case, "baseline_v0", 0)
            a = await execute_case(final_wrapper, case, "regression", generation)
            before.append(b)
            after.append(a)
            await run_store.save_case_result(run_id, b)
            await run_store.save_case_result(run_id, a)
        comparison = reports.compare(before, after)
        await events.emit("regression_summary",
                          f"v0 failure rate {comparison['before_failure_rate']}% -> v{generation} {comparison['after_failure_rate']}%",
                          phase="regression", generation=generation, **comparison)

        run_summary = {
            "agent": agent_config["name"],
            "provider": provider.name,
            "waves": waves,
            "cases_per_wave": cases_per_wave,
            "total_cases": len(all_cases),
            "final_generation": generation,
            "failure_rate_before": comparison["before_failure_rate"],
            "failure_rate_after": comparison["after_failure_rate"],
            "robustness_gain": round(comparison["before_failure_rate"] - comparison["after_failure_rate"], 1),
            "improvements": comparison["improvements"],
            "regressions": comparison["regressions"],
            "wave_summaries": wave_summaries,
        }
        await run_store.update_run(run_id, summary=run_summary)
        artifacts = await exporter.export_hardening_run(run_id, v0_config, config)
        await events.emit("export_ready", f"{len(artifacts)} artifacts written", phase="export",
                          artifacts=[{"kind": a["kind"], "filename": a["filename"], "id": a["id"]} for a in artifacts])
        await run_store.update_run(run_id, status="completed", summary={**run_summary, "artifacts": artifacts})
        await events.emit("run_completed", "Hardening run complete", phase="done", **{k: v for k, v in run_summary.items() if k != "wave_summaries"})
    except Exception as exc:  # surface every failure in the run record and the event log
        await run_store.update_run(run_id, status="failed", error=f"{type(exc).__name__}: {exc}")
        await events.emit("error", f"{type(exc).__name__}: {exc}", traceback=traceback.format_exc()[-2000:])
