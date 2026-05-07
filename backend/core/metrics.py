"""Metrics computation functions for the hardening / RL pipeline."""

from typing import Sequence


def compute_failure_rate(passes: int, fails: int) -> float:
    """Return the failure rate as a float in [0.0, 1.0].

    Returns 0.0 when there are no total attempts.
    """
    total = passes + fails
    if total == 0:
        return 0.0
    return fails / total


def compute_improvement(before: float, after: float) -> float:
    """Return the relative improvement as a percentage.

    Both *before* and *after* should be failure rates in [0.0, 1.0].
    A positive value means failure rate decreased.
    Returns 0.0 when *before* is 0 (no room for improvement).
    """
    if before == 0.0:
        return 0.0
    return ((before - after) / before) * 100.0


def compute_robustness_gain(pre_rate: float, post_rate: float) -> float:
    """Return robustness gain: absolute drop in failure rate.

    A positive value means the system became more robust.
    """
    return pre_rate - post_rate


def compute_pass_ratio(passes: int, total: int) -> float:
    """Return the pass ratio in [0.0, 1.0].

    Returns 0.0 when *total* is 0.
    """
    if total == 0:
        return 0.0
    return passes / total


def compute_score_from_components(
    components: dict[str, float],
    weights: dict[str, float] | None = None,
) -> float:
    """Compute a weighted sum of named component scores.

    Each component is expected to be in [0.0, 1.0].  Weights that are not
    present in *components* are silently ignored.  The result is clamped to
    [0.0, 1.0].

    Args:
        components:  Mapping of component name -> score.
        weights:     Mapping of component name -> weight.  If ``None`` all
                     components are weighted equally.

    Returns:
        Weighted score in [0.0, 1.0].
    """
    if not components:
        return 0.0

    if weights is None:
        n = len(components)
        weights = {k: 1.0 / n for k in components}

    total_weight = 0.0
    weighted_sum = 0.0
    for name, weight in weights.items():
        if name in components:
            weighted_sum += components[name] * weight
            total_weight += weight

    if total_weight == 0.0:
        return 0.0

    return max(0.0, min(1.0, weighted_sum / total_weight))
