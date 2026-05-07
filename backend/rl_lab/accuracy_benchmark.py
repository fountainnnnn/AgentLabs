"""Accuracy benchmark - measure output correctness across multiple dimensions."""

from __future__ import annotations

import math
from collections import defaultdict
from typing import Any

from rl_lab.model_loader import ModelLoader
from rl_lab.schemas import RLDatasetEntry


def benchmark_accuracy(
    model_loader: ModelLoader,
    dataset: list[RLDatasetEntry],
) -> dict[str, Any]:
    """Benchmark model accuracy against a labelled dataset.

    Computes several accuracy metrics:

    * **exact_match**    -- fraction of outputs that exactly match the answer
    * **contains_match** -- fraction where the answer is a substring of the output
    * **fuzzy_score**    -- average Jaccard word similarity
    * **per_category_accuracy** -- accuracy broken down by dataset category
    * **overall_score**  -- weighted combination of the above

    Works in both real and simulation modes.

    Args:
        model_loader: A configured ModelLoader.
        dataset: Labelled dataset entries.

    Returns:
        Dict with all accuracy metrics.
    """
    if not dataset:
        return {
            "exact_match": 0.0,
            "contains_match": 0.0,
            "fuzzy_score": 0.0,
            "per_category_accuracy": {},
            "overall_score": 0.0,
            "total_samples": 0,
        }

    # Run inference on all prompts
    prompts = [e.prompt for e in dataset]
    outputs = model_loader.run_inference(prompts)

    exact_count = 0
    contains_count = 0
    fuzzy_sum = 0.0
    cat_correct: dict[str, int] = defaultdict(int)
    cat_total: dict[str, int] = defaultdict(int)
    n = len(dataset)

    for entry, output in zip(dataset, outputs):
        cat = entry.category or "general"
        correct = entry.correct_answer.strip().lower()
        out_lower = output.strip().lower()

        cat_total[cat] += 1

        # Exact match
        if out_lower == correct:
            exact_count += 1
            contains_count += 1
            cat_correct[cat] += 1
            fuzzy_sum += 1.0
            continue

        # Contains match
        if correct in out_lower or out_lower in correct:
            contains_count += 1
            cat_correct[cat] += 1
            fuzzy_sum += 0.85
            continue

        # Jaccard similarity
        out_words = set(out_lower.split())
        ans_words = set(correct.split())
        if ans_words:
            jaccard = len(out_words & ans_words) / max(len(out_words | ans_words), 1)
            fuzzy_sum += jaccard
            if jaccard > 0.4:
                cat_correct[cat] += 1
        else:
            fuzzy_sum += 0.0

    exact_match = exact_count / n
    contains_match = contains_count / n
    fuzzy_score = fuzzy_sum / n

    # Per-category accuracy
    per_category: dict[str, float] = {}
    for cat, total in cat_total.items():
        per_category[cat] = round(cat_correct[cat] / max(total, 1), 4)

    # Overall: weighted combination (exact matters most, fuzzy is tiebreaker)
    overall = exact_match * 0.5 + contains_match * 0.3 + fuzzy_score * 0.2

    return {
        "exact_match": round(exact_match, 4),
        "contains_match": round(contains_match, 4),
        "fuzzy_score": round(fuzzy_score, 4),
        "per_category_accuracy": per_category,
        "overall_score": round(overall, 4),
        "total_samples": n,
        "total_correct": exact_count,
        "total_partial": contains_count - exact_count,
        "total_incorrect": n - contains_count,
    }
