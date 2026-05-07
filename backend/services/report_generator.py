"""Report generator. Produces summary reports from hardening runs."""
import datetime


class ReportGenerator:
    def generate(self, run_data: dict) -> dict:
        """Generate a comprehensive run report."""
        results = run_data.get("results", [])
        patches = run_data.get("patches", [])
        waves = run_data.get("waves", [])

        # Aggregate stats
        total_attacks = sum(w.get("total_attacks", 0) for w in waves)
        pre_patch_fails = sum(
            sum(1 for r in w.get("pre_patch_results", []) if r.get("passed") == 0)
            for w in waves
        )
        post_patch_fails = sum(
            sum(1 for r in w.get("post_patch_results", []) if r.get("passed") == 0)
            for w in waves
        )

        pre_rate = round((pre_patch_fails / max(total_attacks, 1)) * 100, 1)
        post_rate = round((post_patch_fails / max(total_attacks, 1)) * 100, 1)

        # Per-category breakdown
        categories = {}
        for w in waves:
            for r in w.get("pre_patch_results", []):
                cat = r.get("category", "unknown")
                if cat not in categories:
                    categories[cat] = {"total": 0, "pre_fails": 0, "post_fails": 0}
                categories[cat]["total"] += 1
                if r.get("passed") == 0:
                    categories[cat]["pre_fails"] += 1
            for r in w.get("post_patch_results", []):
                cat = r.get("category", "unknown")
                if cat in categories and r.get("passed") == 0:
                    categories[cat]["post_fails"] += 1

        category_results = {}
        for cat, stats in categories.items():
            category_results[cat] = {
                "total_attacks": stats["total"],
                "pre_patch_failure_rate": round((stats["pre_fails"] / max(stats["total"], 1)) * 100, 1),
                "post_patch_failure_rate": round((stats["post_fails"] / max(stats["total"], 1)) * 100, 1),
                "improvement": round(
                    ((stats["pre_fails"] - stats["post_fails"]) / max(stats["total"], 1)) * 100, 1
                ),
            }

        # Changes summary
        changes_applied = []
        for p in patches:
            if isinstance(p, dict):
                changes_applied.append({
                    "wave": p.get("wave"),
                    "description": p.get("description", ""),
                    "changes": p.get("changes", {}),
                })

        return {
            "report_id": f"AF-{datetime.datetime.utcnow().strftime('%Y%m%d-%H%M%S')}",
            "generated_at": datetime.datetime.utcnow().isoformat(),
            "run_id": run_data.get("run_id"),
            "target_agent": run_data.get("target_agent_name", "Unknown"),
            "mode": run_data.get("mode", "mock"),
            "total_waves": len(waves),
            "total_attacks": total_attacks,
            "pre_patch_failure_rate": pre_rate,
            "post_patch_failure_rate": post_rate,
            "overall_improvement": round(pre_rate - post_rate, 1),
            "total_patches_applied": len(patches),
            "category_results": category_results,
            "changes_applied": changes_applied,
            "wave_details": waves,
            "weaknesses_found": [
                cat for cat, stats in category_results.items()
                if stats["pre_patch_failure_rate"] > 50
            ],
            "improvements_achieved": [
                f"{cat}: {stats['improvement']}% improvement"
                for cat, stats in category_results.items()
                if stats["improvement"] > 0
            ],
        }
