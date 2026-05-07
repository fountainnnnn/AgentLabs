"""Routes for managing hardening runs."""
import json
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from database import get_db
from models import Run, Attack, AttackResult, Patch, Export
from config import settings

router = APIRouter(prefix="/api/runs", tags=["runs"])


@router.get("/")
async def list_runs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Run).order_by(Run.created_at.desc()).limit(20)
    )
    runs = result.scalars().all()
    return [
        {
            "id": r.id,
            "target_agent_name": r.target_agent_name,
            "status": r.status,
            "mode": r.mode,
            "current_wave": r.current_wave,
            "total_waves": r.total_waves,
            "integrity": r.integrity,
            "passes": r.passes,
            "fails": r.fails,
            "failure_rate_before": r.failure_rate_before,
            "failure_rate_after": r.failure_rate_after,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None,
        }
        for r in runs
    ]


@router.post("/")
async def create_run(background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    """Start a new hardening run. Runs in background."""
    from services.hardening_pipeline import HardeningPipeline

    pipeline = HardeningPipeline(session=db)
    # Run synchronously for now (can be made background later)
    result = await pipeline.run()
    return result


@router.get("/{run_id}/export")
async def get_export(run_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Export).where(Export.run_id == run_id).order_by(Export.created_at.desc())
    )
    exports = result.scalars().all()
    return [
        {
            "id": e.id,
            "run_id": e.run_id,
            "export_path": e.export_path,
            "format": e.format,
            "created_at": e.created_at.isoformat() if e.created_at else None,
        }
        for e in exports
    ]


@router.get("/target-configs")
async def list_target_configs():
    config_dir = Path(settings.target_configs_dir)
    configs = []
    for f in config_dir.glob("*.json"):
        with open(f) as fh:
            configs.append(json.load(fh))
    return configs


@router.get("/{run_id}")
async def get_run(run_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Run).where(Run.id == run_id).options(
            selectinload(Run.attacks),
            selectinload(Run.patches),
            selectinload(Run.results),
        )
    )
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    return {
        "id": run.id,
        "target_agent_name": run.target_agent_name,
        "target_config_snapshot": run.target_config_snapshot,
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
        "attacks": [
            {
                "id": a.id,
                "wave": a.wave,
                "category": a.category,
                "prompt": a.prompt,
                "source": a.source,
            }
            for a in run.attacks
        ],
        "patches": [
            {
                "id": p.id,
                "wave": p.wave,
                "category": p.category,
                "description": p.description,
                "changes": p.changes,
            }
            for p in run.patches
        ],
        "results": [
            {
                "id": r.id,
                "attack_id": r.attack_id,
                "wave": r.wave,
                "phase": r.phase,
                "agent_response": r.agent_response,
                "tool_calls": r.tool_calls,
                "passed": r.passed,
                "failure_category": r.failure_category,
                "failure_reason": r.failure_reason,
            }
            for r in run.results
        ],
    }
