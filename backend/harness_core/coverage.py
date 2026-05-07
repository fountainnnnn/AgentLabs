"""Coverage analysis for harness results.

Computes coverage percentages across categories, severity levels, and
identifies gaps in test coverage.
"""

from __future__ import annotations

from typing import Any

from harness_core.schemas import HarnessResult


def compute_category_coverage(
    results: list[HarnessResult],
    all_categories: list[str],
) -> dict[str, float]:
    """Return per-category coverage as a fraction in [0.0, 1.0].

    For each category, coverage = (harnesses in that category that passed) /
    (total harnesses in that category).
    """
    cat_total: dict[str, int] = {}
    cat_passed: dict[str, int] = {}

    for r in results:
        cat = _extract_category(r)
        cat_total[cat] = cat_total.get(cat, 0) + 1
        if r.passed:
            cat_passed[cat] = cat_passed.get(cat, 0) + 1

    coverage: dict[str, float] = {}
    for cat in all_categories:
        total = cat_total.get(cat, 0)
        if total == 0:
            coverage[cat] = 0.0
        else:
            coverage[cat] = round(cat_passed.get(cat, 0) / total, 4)
    return coverage


def compute_severity_coverage(results: list[HarnessResult]) -> dict[str, float]:
    """Return per-severity pass rate in [0.0, 1.0]."""
    sev_total: dict[str, int] = {}
    sev_passed: dict[str, int] = {}

    for r in results:
        sev = _extract_severity(r)
        sev_total[sev] = sev_total.get(sev, 0) + 1
        if r.passed:
            sev_passed[sev] = sev_passed.get(sev, 0) + 1

    coverage: dict[str, float] = {}
    for sev in ("low", "medium", "high", "critical"):
        total = sev_total.get(sev, 0)
        coverage[sev] = round(sev_passed.get(sev, 0) / max(total, 1), 4)
    return coverage


def find_coverage_gaps(
    results: list[HarnessResult],
    all_categories: list[str],
    threshold: float = 0.5,
) -> list[dict[str, Any]]:
    """Identify categories with coverage below *threshold*.

    Returns a list of dicts::

        {"category": str, "pass_rate": float, "total_tests": int, "gap": str}
    """
    coverage = compute_category_coverage(results, all_categories)
    gaps: list[dict[str, Any]] = []
    for cat, rate in coverage.items():
        if rate < threshold:
            cat_total = sum(1 for r in results if _extract_category(r) == cat)
            gaps.append({
                "category": cat,
                "pass_rate": rate,
                "total_tests": cat_total,
                "gap": "low_coverage" if rate < 0.3 else "moderate_coverage",
            })
    return gaps


def generate_coverage_report(
    run_id: str,
    results: list[HarnessResult],
    all_categories: list[str] | None = None,
) -> dict[str, Any]:
    """Generate a comprehensive coverage report.

    Args:
        run_id:  The run identifier.
        results: Completed harness results.

    Returns:
        A dict with overall, per-category, and per-severity coverage data
        plus identified gaps.
    """
    if all_categories is None:
        all_categories = sorted({_extract_category(r) for r in results})

    cat_coverage = compute_category_coverage(results, all_categories)
    sev_coverage = compute_severity_coverage(results)
    gaps = find_coverage_gaps(results, all_categories)

    total = len(results)
    passed = sum(1 for r in results if r.passed)
    overall = round(passed / max(total, 1), 4)

    return {
        "run_id": run_id,
        "overall_pass_rate": overall,
        "total_tests": total,
        "passed": passed,
        "failed": total - passed,
        "category_coverage": cat_coverage,
        "severity_coverage": sev_coverage,
        "coverage_gaps": gaps,
        "all_categories": all_categories,
    }


def _extract_category(result: HarnessResult) -> str:
    """Extract a category string from a harness result.

    Falls back to parsing the harness ID for the family prefix.
    """
    if result.failure_type:
        return result.failure_type
    h_id = result.harness_id
    if "-" in h_id:
        prefix = h_id.split("-")[0]
        # Remove trailing wave info like "pi" -> "prompt_injection"
        mapping = {
            "pi": "prompt_injection",
            "ri": "role_impersonation",
            "em": "emotional_manipulation",
            "pe": "policy_extraction",
            "ta": "tool_abuse",
            "mt": "multi_turn",
            "jb": "jailbreak",
            "lk": "leakage",
            "uc": "unsafe_compliance",
            "di": "deceptive_instruction",
            "rh": "reward_hacking",
            "cy": "consistency",
        }
        return mapping.get(prefix, prefix)
    return "unknown"


def _extract_severity(result: HarnessResult) -> str:
    """Extract severity from the result or default to "medium"."""
    # Severity is not stored in HarnessResult, so we default to medium.
    return "medium"
