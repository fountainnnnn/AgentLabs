"""Adversarial harness generation for the hardening loop.

Cases come from the curated seed library in ``seed_attacks.py`` and are selected
deterministically from ``(seed, wave)`` so every run is reproducible.
"""

from __future__ import annotations

import hashlib
import random
from typing import Any

from seed_attacks import SEED_ATTACKS

AGENT_CATEGORIES = [
    "prompt_injection",
    "role_impersonation",
    "emotional_manipulation",
    "policy_extraction",
    "tool_abuse",
    "multi_turn",
    "hallucinated_policy",
    "secret_leakage",
    "missing_escalation",
    "constraint_violation",
]

MODEL_EVAL_CATEGORIES = [
    "jailbreak",
    "deceptive_instruction",
    "unsafe_compliance",
    "correct_refusal",
    "hallucination_trap",
    "data_exfiltration",
    "role_confusion",
    "tool_safety",
    "consistency_check",
    "multi_turn_attack",
    "policy_generalization",
    "reward_hacking_probe",
]

# Which attack families each wave concentrates on. Later waves mix everything.
WAVE_FOCUS = [
    ["prompt_injection", "policy_extraction", "role_impersonation", "tool_abuse"],
    ["emotional_manipulation", "secret_leakage", "hallucinated_policy", "missing_escalation"],
    ["multi_turn", "constraint_violation", "prompt_injection", "role_impersonation"],
    ["tool_abuse", "policy_extraction", "emotional_manipulation", "multi_turn"],
    AGENT_CATEGORIES,
]

BASE_SEVERITY = {
    "prompt_injection": "high",
    "role_impersonation": "high",
    "emotional_manipulation": "medium",
    "policy_extraction": "high",
    "tool_abuse": "critical",
    "multi_turn": "critical",
    "hallucinated_policy": "medium",
    "secret_leakage": "critical",
    "missing_escalation": "medium",
    "constraint_violation": "high",
}


def _library(categories: list[str]) -> dict[str, list[dict[str, Any]]]:
    library: dict[str, list[dict[str, Any]]] = {c: [] for c in categories}
    for index, attack in enumerate(SEED_ATTACKS):
        category = attack.get("category")
        if category in library:
            library[category].append({"seed_index": index, **attack})
    return library


def case_id(prompt: str) -> str:
    return "case_" + hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:10]


def library_size() -> dict[str, int]:
    return {c: len(v) for c, v in _library(AGENT_CATEGORIES).items()}


def generate_wave(wave: int, count: int, seed: int = 7, exclude: set[str] | None = None) -> list[dict[str, Any]]:
    """Pick ``count`` attack cases for ``wave`` without repeating cases from earlier waves."""
    exclude = exclude or set()
    library = _library(AGENT_CATEGORIES)
    focus = WAVE_FOCUS[min(wave - 1, len(WAVE_FOCUS) - 1)]
    rng = random.Random(f"{seed}:{wave}")
    cases: list[dict[str, Any]] = []
    rotation = 0
    attempts = 0
    while len(cases) < count and attempts < count * 20:
        attempts += 1
        category = focus[rotation % len(focus)]
        rotation += 1
        pool = [a for a in library[category] if case_id(a["prompt"]) not in exclude]
        if not pool:
            continue
        attack = rng.choice(pool)
        cid = case_id(attack["prompt"])
        exclude.add(cid)
        severity = BASE_SEVERITY.get(category, "medium")
        if wave >= 3 and severity == "high" and rng.random() < 0.4:
            severity = "critical"
        cases.append(
            {
                "case_id": cid,
                "wave": wave,
                "category": category,
                "severity": severity,
                "prompt": attack["prompt"],
                "source": "seed_library",
                "seed_index": attack["seed_index"],
            }
        )
    return cases


def model_eval_cases(count: int, seed: int = 11) -> list[dict[str, Any]]:
    """Adversarial cases for evaluating a model (used when no dataset is supplied)."""
    library = _library(MODEL_EVAL_CATEGORIES)
    rng = random.Random(seed)
    cases = []
    for index in range(count):
        category = MODEL_EVAL_CATEGORIES[index % len(MODEL_EVAL_CATEGORIES)]
        attack = rng.choice(library[category])
        cases.append({"category": category, "prompt": attack["prompt"]})
    return cases
