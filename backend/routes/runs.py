"""Shared run, event, report and artifact endpoints for every AgentLabs module."""

from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse, HTMLResponse

from config import settings
from security import current_owner
from services import reports, run_store

router = APIRouter(prefix="/api", tags=["runs"])


@router.get("/runs")
async def list_runs(kind: str | None = None, limit: int = 50, owner: str = Depends(current_owner)):
    return {"runs": await run_store.list_runs(kind=kind, limit=min(max(limit, 1), 200), owner=owner)}


async def _run_or_404(run_id: str, owner: str):
    run = await run_store.get_run(run_id, owner=owner)
    if run is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return run


@router.get("/runs/{run_id}")
async def get_run(run_id: str, owner: str = Depends(current_owner)):
    return run_store.run_dict(await _run_or_404(run_id, owner))


@router.get("/runs/{run_id}/events")
async def get_events(run_id: str, after: int = 0, owner: str = Depends(current_owner)):
    run = await _run_or_404(run_id, owner)
    return {"run_id": run_id, "status": run.status, "events": await run_store.list_events(run_id, after=after)}


@router.get("/runs/{run_id}/results")
async def get_results(run_id: str, owner: str = Depends(current_owner)):
    await _run_or_404(run_id, owner)
    return {"run_id": run_id, "results": await run_store.list_case_results(run_id)}


@router.get("/runs/{run_id}/report")
async def get_report(run_id: str, owner: str = Depends(current_owner)):
    await _run_or_404(run_id, owner)
    report = await reports.build_report(run_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return report


@router.get("/runs/{run_id}/report.html", response_class=HTMLResponse)
async def get_report_html(run_id: str, owner: str = Depends(current_owner)):
    await _run_or_404(run_id, owner)
    report = await reports.build_report(run_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Run not found")
    return HTMLResponse(reports.render_html(report))


@router.get("/artifacts")
async def list_artifacts(run_id: str | None = None, owner: str = Depends(current_owner)):
    return {"artifacts": await run_store.list_artifacts(run_id, owner=owner)}


@router.get("/artifacts/{artifact_id}/download")
async def download_artifact(artifact_id: str, owner: str = Depends(current_owner)):
    artifact = await run_store.get_artifact(artifact_id, owner=owner)
    if artifact is None:
        raise HTTPException(status_code=404, detail="Artifact not found")
    path = Path(artifact.path).resolve()
    if settings.artifacts_dir.resolve() not in path.parents or not path.is_file():
        raise HTTPException(status_code=404, detail="Artifact file is missing")
    return FileResponse(path, media_type=artifact.media_type, filename=artifact.filename)
