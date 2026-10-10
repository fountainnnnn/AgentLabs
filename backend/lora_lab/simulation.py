"""Adapter Simulation Mode: a deterministic stand-in for a small model and its LoRA adapter.

Used whenever torch/transformers/peft or a local model is unavailable. Nothing here
updates real weights; every run and export produced from it is labelled ``simulated``.
"""

from __future__ import annotations

import hashlib
import math
from typing import Any

BASE_FAILURE = {"benign": 0.15, "hallucination_trap": 0.7}
DEFAULT_ADVERSARIAL_FAILURE = 0.65
SIM_PARAMS = {"total": 124_439_808, "per_rank": 147_456}  # GPT-2 small sized stand-in


def _fraction(*parts: str) -> float:
    return int(hashlib.sha256("|".join(parts).encode()).hexdigest()[:8], 16) / 0xFFFFFFFF


def adapter_effect(adapter: dict[str, Any] | None, category: str) -> float:
    if not adapter:
        return 0.0
    rank = max(1, int(adapter.get("rank", 8)))
    steps = max(0, int(adapter.get("steps", 0)))
    effect = 0.35 + 0.15 * min(math.log2(rank), 5) / 5 + 0.3 * min(steps, 200) / 200
    effect = min(effect, 0.9)
    if category not in set(adapter.get("trained_categories", [])):
        effect *= 0.5
    return effect


def respond(sample: dict[str, Any], adapter: dict[str, Any] | None = None) -> str:
    category = sample.get("category", "adversarial")
    prompt = sample["prompt"]
    forbidden = [f for f in sample.get("forbidden_outputs", []) if f]
    effect = adapter_effect(adapter, category)
    roll = _fraction(prompt, "sim-model")

    if sample.get("should_refuse"):
        fails = roll < DEFAULT_ADVERSARIAL_FAILURE * (1 - effect)
        if not fails:
            return sample["target"]
        leak = f" {forbidden[0]} as requested." if forbidden else ""
        return f"Sure, here you go.{leak}"
    if category == "hallucination_trap":
        fails = roll < BASE_FAILURE["hallucination_trap"] * (1 - effect)
        if not fails:
            return sample["target"]
        invented = forbidden[0] if forbidden else "the code is"
        return f"Yes, {invented} ER-7781 and it applies to every customer."
    # Benign: a stronger refusal adapter slightly raises over-refusal.
    fail_rate = BASE_FAILURE["benign"] + 0.06 * effect
    if roll < fail_rate:
        if _fraction(prompt, "style") < 0.5:
            return "I can't help with that request."
        return "Please contact support for more details."
    return sample["target"]


def training_trace(steps: int, learning_rate: float, rank: int) -> list[dict[str, float]]:
    k = 3.2 * min(max(learning_rate / 2e-4, 0.25), 4.0) / max(steps, 1)
    trace = []
    for step in range(1, steps + 1):
        wiggle = 0.04 * math.sin(step * 1.7) * math.exp(-step / max(steps, 1))
        loss = 2.4 * math.exp(-k * step) + 0.35 + wiggle - 0.01 * min(rank, 32) / 32
        trace.append({"step": step, "loss": round(loss, 4), "learning_rate": learning_rate})
    return trace


def param_counts(rank: int) -> dict[str, int]:
    trainable = SIM_PARAMS["per_rank"] * rank
    return {"trainable_params": trainable, "frozen_params": SIM_PARAMS["total"], "total_params": SIM_PARAMS["total"] + trainable}
