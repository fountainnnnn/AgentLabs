"""Speed benchmark - measure latency, throughput, and memory usage."""

from __future__ import annotations

import math
import time
from typing import Any

from rl_lab.model_loader import ModelLoader


def benchmark_speed(
    model_loader: ModelLoader,
    prompts: list[str],
    runs: int = 3,
) -> dict[str, Any]:
    """Benchmark model inference speed.

    Runs inference on the given prompts multiple times and reports
    average latency, tokens per second, and estimated peak memory.

    If the model loader does not have a real loaded model, deterministic
    simulation values are returned instead.

    Args:
        model_loader: A (possibly loaded) ModelLoader.
        prompts: A list of prompt strings to benchmark with.
        runs: Number of repeated runs for averaging (default 3).

    Returns:
        Dict with keys:
            - avg_latency_ms       (float)
            - tokens_per_second    (float)
            - peak_memory_mb       (float)
            - device_info          (str)
            - total_prompts        (int)
            - runs                 (int)
            - per_run              (list[dict])
    """
    if not prompts:
        prompts = [
            "What is the capital of France?",
            "Explain quantum computing in simple terms.",
            "Write a short poem about artificial intelligence.",
            "How do I reset my password?",
            "What are the benefits of exercise?",
        ]

    if model_loader.is_loaded and model_loader.model is not None:
        return _real_benchmark(model_loader, prompts, runs)

    return _simulate_benchmark(model_loader, prompts, runs)


def _real_benchmark(
    model_loader: ModelLoader,
    prompts: list[str],
    runs: int,
) -> dict[str, Any]:
    """Run real model inference and measure speed."""
    per_run: list[dict[str, Any]] = []

    for run_idx in range(runs):
        t0 = time.perf_counter()
        outputs = model_loader.run_inference(prompts)
        elapsed = time.perf_counter() - t0

        total_tokens = sum(max(1, len(o.split())) for o in outputs)
        avg_latency = (elapsed / len(prompts)) * 1000.0  # ms per prompt
        tps = total_tokens / max(elapsed, 1e-9)

        per_run.append({
            "run": run_idx + 1,
            "latency_ms": round(avg_latency, 2),
            "tokens_per_second": round(tps, 2),
            "total_tokens": total_tokens,
            "elapsed_s": round(elapsed, 4),
        })

    avg_latency = sum(r["latency_ms"] for r in per_run) / len(per_run)
    avg_tps = sum(r["tokens_per_second"] for r in per_run) / len(per_run)

    # Try to get peak memory
    peak_memory = _get_peak_memory()

    return {
        "avg_latency_ms": round(avg_latency, 2),
        "tokens_per_second": round(avg_tps, 2),
        "peak_memory_mb": peak_memory,
        "device_info": _get_device_info(),
        "total_prompts": len(prompts),
        "runs": runs,
        "per_run": per_run,
    }


def _simulate_benchmark(
    model_loader: ModelLoader,
    prompts: list[str],
    runs: int,
) -> dict[str, Any]:
    """Return deterministic speed estimates based on prompt length.

    All values are computed mathematically, not random.
    """
    prompt_lengths = [len(p) for p in prompts]
    avg_prompt_len = sum(prompt_lengths) / max(len(prompts), 1)

    # Base throughput estimate (simulated A100-class)
    base_tps = 2800.0
    # Longer prompts reduce throughput slightly
    length_factor = math.exp(-avg_prompt_len / 10000.0)
    # Total estimate
    tps = base_tps * length_factor
    latency_per_token_ms = 1000.0 / tps
    avg_tokens_per_prompt = avg_prompt_len / 4.5  # rough char-to-token ratio
    latency_per_prompt_ms = latency_per_token_ms * avg_tokens_per_prompt

    per_run = []
    for i in range(runs):
        per_run.append({
            "run": i + 1,
            "latency_ms": round(latency_per_prompt_ms, 2),
            "tokens_per_second": round(tps, 2),
            "total_tokens": int(avg_tokens_per_prompt * len(prompts)),
            "elapsed_s": round(
                latency_per_prompt_ms * len(prompts) / 1000.0, 4
            ),
        })

    return {
        "avg_latency_ms": round(latency_per_prompt_ms, 2),
        "tokens_per_second": round(tps, 2),
        "peak_memory_mb": 14260.0,  # ~14 GB for 7B fp16
        "device_info": "simulated (A100 80GB)",
        "total_prompts": len(prompts),
        "runs": runs,
        "per_run": per_run,
    }


def _get_peak_memory() -> float:
    """Try to get peak CUDA memory, return 0.0 if unavailable."""
    try:
        import torch
        if torch.cuda.is_available():
            return round(torch.cuda.max_memory_allocated() / (1024**2), 2)
    except ImportError:
        pass
    return 0.0


def _get_device_info() -> str:
    """Return a string describing the available compute device."""
    try:
        import torch
        if torch.cuda.is_available():
            name = torch.cuda.get_device_name(0)
            return f"CUDA ({name})"
        return "CPU"
    except ImportError:
        return "unknown (torch not available)"
