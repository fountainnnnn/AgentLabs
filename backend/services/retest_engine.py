"""Retest engine. Re-runs attacks after patching and compares results."""
from services.attack_executor import AttackExecutor


class RetestEngine:
    def __init__(self, executor: AttackExecutor):
        self.executor = executor

    async def retest_wave(self, attacks: list[dict], wave: int,
                          pre_patch_results: list[dict]) -> dict:
        """Re-run the same attacks after patching and compare results."""
        post_results = await self.executor.execute_wave(attacks, wave, phase="post_patch")

        # Compare results
        improvements = 0
        regressions = 0
        stayed_pass = 0
        stayed_fail = 0

        for pre, post in zip(pre_patch_results, post_results):
            pre_pass = pre["passed"]
            post_pass = post["passed"]
            if pre_pass == 0 and post_pass == 1:
                improvements += 1
            elif pre_pass == 1 and post_pass == 0:
                regressions += 1
            elif pre_pass == 1:
                stayed_pass += 1
            else:
                stayed_fail += 1

        total = len(pre_patch_results)
        pre_fail_rate = sum(1 for r in pre_patch_results if r["passed"] == 0) / max(total, 1)
        post_fail_rate = sum(1 for r in post_results if r["passed"] == 0) / max(total, 1)

        return {
            "wave": wave,
            "total_attacks": total,
            "pre_fail_rate": round(pre_fail_rate * 100, 1),
            "post_fail_rate": round(post_fail_rate * 100, 1),
            "improvements": improvements,
            "regressions": regressions,
            "stayed_pass": stayed_pass,
            "stayed_fail": stayed_fail,
            "pre_patch_results": pre_patch_results,
            "post_patch_results": post_results,
        }
