"""Run lifecycle manager.

Provides a higher-level interface over the database ``Run`` model for
creating, updating, querying, and completing hardening / RL runs.
"""

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models import Run, Attack, AttackResult, Patch, Export


class RunManager:
    """Manages the lifecycle of ``Run`` records."""

    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    async def create_run(
        self,
        mode: str = "mock",
        name: str = "",
        config: dict[str, Any] | None = None,
        total_waves: int = 3,
    ) -> Run:
        """Create a new run record and return it."""
        run = Run(
            target_agent_name=name or "unnamed",
            target_config_snapshot=config or {},
            status="pending",
            mode=mode,
            total_waves=total_waves,
            current_wave=0,
            integrity=100.0,
            passes=0,
            fails=0,
        )
        self.db.add(run)
        await self.db.commit()
        await self.db.refresh(run)
        return run

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------

    async def get_run(self, run_id: int) -> Run | None:
        """Fetch a single run by its primary key."""
        return await self.db.get(Run, run_id)

    async def list_runs(
        self,
        mode: str | None = None,
        limit: int = 20,
    ) -> list[Run]:
        """List runs, newest first, optionally filtered by mode."""
        stmt = select(Run).order_by(Run.created_at.desc()).limit(limit)
        if mode is not None:
            stmt = stmt.where(Run.mode == mode)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())

    # ------------------------------------------------------------------
    # Update
    # ------------------------------------------------------------------

    async def update_run(
        self,
        run_id: int,
        updates: dict[str, Any],
    ) -> Run | None:
        """Apply partial updates to a run and return the refreshed record."""
        run = await self.db.get(Run, run_id)
        if run is None:
            return None

        for key, value in updates.items():
            if hasattr(run, key):
                setattr(run, key, value)

        await self.db.commit()
        await self.db.refresh(run)
        return run

    # ------------------------------------------------------------------
    # Complete / terminate
    # ------------------------------------------------------------------

    async def complete_run(
        self,
        run_id: int,
        status: str = "completed",
    ) -> Run | None:
        """Mark a run as completed (or failed) with a completion timestamp."""
        run = await self.db.get(Run, run_id)
        if run is None:
            return None
        run.status = status
        run.completed_at = datetime.now(timezone.utc)
        await self.db.commit()
        await self.db.refresh(run)
        return run

    # ------------------------------------------------------------------
    # Aggregate helpers
    # ------------------------------------------------------------------

    async def get_run_summary(self, run_id: int) -> dict[str, Any] | None:
        """Return a dict summary of a run with counts of children."""
        run = await self.db.get(Run, run_id)
        if run is None:
            return None

        # Count attacks, results, patches, exports
        attack_count = (
            await self.db.execute(
                select(func.count()).where(Attack.run_id == run_id)
            )
        ).scalar() or 0

        result_count = (
            await self.db.execute(
                select(func.count()).where(AttackResult.run_id == run_id)
            )
        ).scalar() or 0

        patch_count = (
            await self.db.execute(
                select(func.count()).where(Patch.run_id == run_id)
            )
        ).scalar() or 0

        export_count = (
            await self.db.execute(
                select(func.count()).where(Export.run_id == run_id)
            )
        ).scalar() or 0

        return {
            "id": run.id,
            "target_agent_name": run.target_agent_name,
            "status": run.status,
            "mode": run.mode,
            "current_wave": run.current_wave,
            "total_waves": run.total_waves,
            "integrity": run.integrity,
            "passes": run.passes,
            "fails": run.fails,
            "failure_rate_before": run.failure_rate_before,
            "failure_rate_after": run.failure_rate_after,
            "created_at": run.created_at.isoformat() if run.created_at else None,
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "attack_count": attack_count,
            "result_count": result_count,
            "patch_count": patch_count,
            "export_count": export_count,
        }
