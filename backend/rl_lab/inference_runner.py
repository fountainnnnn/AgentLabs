"""Inference runner - batch inference over dataset entries with timing."""

from __future__ import annotations

import time
from typing import Any

from rl_lab.model_loader import ModelLoader
from rl_lab.schemas import RLDatasetEntry


def run_baseline_inference(
    model_loader: ModelLoader,
    dataset_entries: list[RLDatasetEntry],
    batch_size: int = 4,
) -> list[dict[str, Any]]:
    """Run batch inference on each entry and return results with timing.

    If ``model_loader`` has a real model loaded, real inference is used;
    otherwise deterministic simulation is used.

    Args:
        model_loader: A configured (possibly loaded) ModelLoader.
        dataset_entries: The dataset to infer over.
        batch_size: Number of prompts to process per batch.

    Returns:
        A list of dicts, one per entry, each containing:
            - prompt         (str)
            - output         (str)  -- the generated text
            - correct_answer (str)
            - category       (str)
            - latency_s      (float)
            - tokens         (int)  -- estimated output length in tokens
            - tokens_per_s   (float)
            - passed         (bool)
    """
    if not dataset_entries:
        return []

    results: list[dict[str, Any]] = []
    prompts = [e.prompt for e in dataset_entries]

    for batch_start in range(0, len(prompts), batch_size):
        batch = prompts[batch_start : batch_start + batch_size]
        entries_slice = dataset_entries[batch_start : batch_start + batch_size]

        # Time the inference
        t0 = time.perf_counter()
        outputs = model_loader.run_inference(batch)
        elapsed = time.perf_counter() - t0

        for i, (entry, output) in enumerate(zip(entries_slice, outputs)):
            token_estimate = max(1, len(output.split()))
            tokens_per_s = token_estimate / max(elapsed / len(batch), 1e-9)
            correct = entry.correct_answer.strip().lower()
            out_lower = output.strip().lower()
            passed = (
                out_lower == correct
                or correct in out_lower
                or _jaccard_similarity(out_lower, correct) > 0.4
            )

            results.append({
                "prompt": entry.prompt,
                "output": output,
                "correct_answer": entry.correct_answer,
                "category": entry.category,
                "latency_s": round(elapsed / max(len(batch), 1), 4),
                "tokens": token_estimate,
                "tokens_per_s": round(tokens_per_s, 2),
                "passed": passed,
            })

    return results


def _jaccard_similarity(a: str, b: str) -> float:
    """Jaccard similarity of word sets between two strings."""
    words_a = set(a.split())
    words_b = set(b.split())
    if not words_a or not words_b:
        return 0.0
    return len(words_a & words_b) / len(words_a | words_b)
