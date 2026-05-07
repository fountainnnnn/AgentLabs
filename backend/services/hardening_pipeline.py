"""Main hardening pipeline orchestrator. Coordinates the full evaluate-patch-retest loop."""
import json
from contextlib import asynccontextmanager
from pathlib import Path
from sqlalchemy.ext.asyncio import AsyncSession
from config import settings
from database import async_session
from models import Run, Attack, AttackResult, Patch, Export
from services.openai_service import openai_service
from services.target_agent import TargetAgentRunner
from services.attack_executor import AttackExecutor
from services.retest_engine import RetestEngine
from services.patch_applier import PatchApplier
from services.report_generator import ReportGenerator
from services.export_service import ExportService
from seed_attacks import SEED_ATTACKS


class HardeningPipeline:
    def __init__(self, session: AsyncSession | None = None):
        self.report_generator = ReportGenerator()
        self.export_service = ExportService()
        self._session = session

    @asynccontextmanager
    async def _session_scope(self):
        """Use an injected session for tests/routes, otherwise open a fresh app session."""
        if self._session is not None:
            yield self._session
            return

        async with async_session() as session:
            yield session

    async def run(self, target_config_path: str | None = None) -> dict:
        """Execute the full hardening pipeline."""
        # Load target config
        if target_config_path is None:
            target_config_path = str(Path(settings.target_configs_dir) / "refund_agent.json")
        with open(target_config_path) as f:
            config = json.load(f)

        # Create run record
        async with self._session_scope() as session:
            run = Run(
                target_agent_name=config["name"],
                target_config_snapshot=config,
                status="running",
                mode="mock" if settings.mock_mode else "live",
                total_waves=settings.max_attack_waves,
            )
            session.add(run)
            await session.commit()
            await session.refresh(run)
            run_id = run.id

        # Initialize services
        runner = TargetAgentRunner(config)
        executor = AttackExecutor(runner)
        retest_engine = RetestEngine(executor)
        patch_applier = PatchApplier(runner)

        all_wave_results = []
        all_patches = []
        total_passes = 0
        total_fails = 0

        # Wave loop
        for wave in range(1, settings.max_attack_waves + 1):
            # Generate attacks for this wave
            attacks = await self._generate_wave_attacks(config, wave, run_id)

            # Execute pre-patch attacks
            pre_results = await executor.execute_wave(attacks, wave, phase="pre_patch")
            await self._save_results(run_id, pre_results, session)

            # Count passes/fails
            wave_fails = [r for r in pre_results if r["passed"] == 0]
            wave_passes = [r for r in pre_results if r["passed"] == 1]
            total_passes += len(wave_passes)
            total_fails += len(wave_fails)

            # Generate patch if there are failures
            patch = None
            patch_summary = None
            post_results = None
            comparison = None

            if wave_fails:
                failures_for_patch = [
                    {"category": r["failure_category"], "reason": r["failure_reason"]}
                    for r in wave_fails
                ]
                patch = await openai_service.generate_patch(
                    runner.get_config_snapshot(), failures_for_patch
                )
                patch_summary = patch_applier.apply(patch, wave)

                # Save patch
                async with self._session_scope() as session:
                    db_patch = Patch(
                        run_id=run_id,
                        wave=wave,
                        category=", ".join(set(f["category"] for f in failures_for_patch)),
                        description=patch.get("description", ""),
                        changes=patch_summary["changes"],
                        applied_config_snapshot=runner.get_config_snapshot(),
                    )
                    session.add(db_patch)
                    await session.commit()

                # Retest with same attacks
                comparison = await retest_engine.retest_wave(attacks, wave, pre_results)
                post_results = comparison["post_patch_results"]
                await self._save_results(run_id, post_results, session)

                all_patches.append({
                    "wave": wave,
                    "patch": patch,
                    "summary": patch_summary,
                })

            wave_result = {
                "wave": wave,
                "total_attacks": len(attacks),
                "pre_patch_results": pre_results,
                "post_patch_results": post_results,
                "comparison": comparison,
                "patch_applied": patch_summary,
                "fails": len(wave_fails),
                "passes": len(wave_passes),
            }
            all_wave_results.append(wave_result)

            # Update run progress
            async with self._session_scope() as session:
                run = await session.get(Run, run_id)
                run.current_wave = wave
                integrity = max(0, 100 - (total_fails * (100 / max(total_fails + total_passes, 1))))
                run.integrity = round(integrity, 1)
                run.passes = total_passes
                run.fails = total_fails
                await session.commit()

        # Calculate final metrics
        total_attacks = sum(w["total_attacks"] for w in all_wave_results)
        pre_patch_fails = sum(
            sum(1 for r in w["pre_patch_results"] if r["passed"] == 0)
            for w in all_wave_results
        )
        post_patch_results_all = [
            r for w in all_wave_results if w.get("post_patch_results")
            for r in w["post_patch_results"]
        ]
        post_patch_fails = sum(1 for r in post_patch_results_all if r["passed"] == 0)

        failure_rate_before = round((pre_patch_fails / max(total_attacks, 1)) * 100, 1)
        failure_rate_after = round((post_patch_fails / max(len(post_patch_results_all), 1)) * 100, 1)

        # Generate report
        run_data = {
            "run_id": run_id,
            "target_agent_name": config["name"],
            "mode": "mock" if settings.mock_mode else "live",
            "waves": all_wave_results,
            "patches": all_patches,
        }
        report = self.report_generator.generate(run_data)

        # Export
        agent_path = self.export_service.export_agent_json(run_id, runner.get_config_snapshot())
        report_path = self.export_service.export_report_json(run_id, report)
        bundle_path = self.export_service.export_bundle(
            run_id, runner.get_config_snapshot(), report
        )

        # Save export record and update run
        async with self._session_scope() as session:
            run = await session.get(Run, run_id)
            run.status = "completed"
            run.failure_rate_before = failure_rate_before
            run.failure_rate_after = failure_rate_after

            export = Export(
                run_id=run_id,
                export_path=bundle_path,
                format="zip",
            )
            session.add(export)
            await session.commit()

        return {
            "run_id": run_id,
            "target_agent": config["name"],
            "mode": "mock" if settings.mock_mode else "live",
            "total_waves": len(all_wave_results),
            "total_attacks": total_attacks,
            "passes": total_passes,
            "fails": total_fails,
            "failure_rate_before": failure_rate_before,
            "failure_rate_after": failure_rate_after,
            "integrity": max(0, 100 - (total_fails * (100 / max(total_attacks, 1)))),
            "waves": all_wave_results,
            "patches": all_patches,
            "report": report,
            "exports": {
                "agent_json": agent_path,
                "report_json": report_path,
                "bundle_zip": bundle_path,
            },
        }

    async def _generate_wave_attacks(self, config: dict, wave: int, run_id: int) -> list[dict]:
        """Generate attacks for a wave using seed + generated attacks."""
        categories = [
            "prompt_injection", "role_impersonation", "emotional_manipulation",
            "policy_extraction", "tool_abuse", "multi_turn",
        ]
        # Rotate categories per wave
        wave_categories = categories[(wave - 1) % len(categories):] + categories[:(wave - 1) % len(categories)]
        wave_categories = wave_categories[:settings.attacks_per_wave]

        all_attacks = []
        for cat in wave_categories:
            generated = await openai_service.generate_attacks(config, cat, count=1)
            if generated:
                all_attacks.extend(generated)

        # Save attacks to DB and assign IDs
        async with self._session_scope() as session:
            for attack_data in all_attacks[:settings.attacks_per_wave]:
                attack = Attack(
                    run_id=run_id,
                    wave=wave,
                    category=attack_data.get("category", "unknown"),
                    prompt=attack_data.get("prompt", ""),
                    source=attack_data.get("source", "seed"),
                )
                session.add(attack)
                await session.flush()
                await session.refresh(attack)
                attack_data["id"] = attack.id
            await session.commit()

        return all_attacks[:settings.attacks_per_wave]

    async def _save_results(self, run_id: int, results: list[dict], session):
        """Save attack results to DB."""
        for r in results:
            attack_id = r.get("attack_id")
            if attack_id is None:
                continue
            result = AttackResult(
                run_id=run_id,
                attack_id=attack_id,
                wave=r["wave"],
                phase=r["phase"],
                agent_response=r.get("agent_response", ""),
                tool_calls=r.get("tool_calls", []),
                passed=r["passed"],
                failure_category=r.get("failure_category"),
                failure_reason=r.get("failure_reason"),
            )
            session.add(result)
        await session.commit()
