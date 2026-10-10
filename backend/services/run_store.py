"""Persistence helpers shared by every run kind (hardening, model_eval, lora_training)."""

from __future__ import annotations

import mimetypes
import uuid
from pathlib import Path
from typing import Any

from sqlalchemy import func, select

import database
from config import settings
from models import Artifact, CaseResult, Patch, Run, RunEvent, utcnow


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


def run_dir(run_id: str) -> Path:
    path = settings.artifacts_dir / run_id
    path.mkdir(parents=True, exist_ok=True)
    return path


async def create_run(kind: str, name: str, *, provider: str, real_or_simulated: str, truth_mode: str,
                     config: dict[str, Any], parent_run_id: str | None = None) -> str:
    run_id = new_id("run")
    async with database.async_session() as session:
        session.add(Run(id=run_id, kind=kind, name=name, status="queued", provider=provider,
                        real_or_simulated=real_or_simulated, truth_mode=truth_mode, config=config,
                        summary={}, parent_run_id=parent_run_id))
        await session.commit()
    return run_id


async def update_run(run_id: str, **fields: Any) -> None:
    async with database.async_session() as session:
        run = await session.get(Run, run_id)
        if run is None:
            return
        for key, value in fields.items():
            setattr(run, key, value)
        if fields.get("status") in {"completed", "failed"}:
            run.completed_at = utcnow()
        await session.commit()


async def get_run(run_id: str) -> Run | None:
    async with database.async_session() as session:
        return await session.get(Run, run_id)


class EventWriter:
    """Appends ordered events for a run. Events drive the logs and the arena playback."""

    def __init__(self, run_id: str):
        self.run_id = run_id
        self.seq = 0

    async def emit(self, type_: str, message: str = "", *, wave: int | None = None, phase: str | None = None,
                   **payload: Any) -> None:
        self.seq += 1
        async with database.async_session() as session:
            session.add(RunEvent(run_id=self.run_id, seq=self.seq, type=type_, wave=wave, phase=phase,
                                 message=message, payload=payload))
            await session.commit()


async def list_events(run_id: str, after: int = 0) -> list[dict[str, Any]]:
    async with database.async_session() as session:
        rows = (await session.execute(
            select(RunEvent).where(RunEvent.run_id == run_id, RunEvent.seq > after).order_by(RunEvent.seq)
        )).scalars().all()
    return [
        {"seq": e.seq, "type": e.type, "wave": e.wave, "phase": e.phase, "message": e.message,
         "payload": e.payload, "created_at": e.created_at.isoformat() if e.created_at else None}
        for e in rows
    ]


async def save_case_result(run_id: str, result: dict[str, Any]) -> None:
    async with database.async_session() as session:
        session.add(CaseResult(
            run_id=run_id, wave=result.get("wave", 1), phase=result["phase"], case_id=result["case_id"],
            category=result["category"], severity=result.get("severity", "medium"), prompt=result["prompt"],
            response=result.get("response", ""), tool_calls=result.get("tool_calls", []),
            passed=bool(result["passed"]), score=float(result.get("score", 0.0)),
            failure_category=result.get("failure_category"), failure_reason=result.get("failure_reason"),
            verifier_results=result.get("verifier_results", []), generation=result.get("generation", 0),
            latency_ms=float(result.get("latency_ms", 0.0)),
        ))
        await session.commit()


async def list_case_results(run_id: str) -> list[dict[str, Any]]:
    async with database.async_session() as session:
        rows = (await session.execute(
            select(CaseResult).where(CaseResult.run_id == run_id).order_by(CaseResult.id)
        )).scalars().all()
    return [
        {"wave": r.wave, "phase": r.phase, "case_id": r.case_id, "category": r.category, "severity": r.severity,
         "prompt": r.prompt, "response": r.response, "tool_calls": r.tool_calls, "passed": r.passed,
         "score": r.score, "failure_category": r.failure_category, "failure_reason": r.failure_reason,
         "verifier_results": r.verifier_results, "generation": r.generation, "latency_ms": r.latency_ms}
        for r in rows
    ]


async def save_patch(run_id: str, wave: int, patch: dict[str, Any], changes: dict[str, Any],
                     config_snapshot: dict[str, Any]) -> None:
    async with database.async_session() as session:
        session.add(Patch(run_id=run_id, wave=wave, generation=patch["generation"], title=patch["title"],
                          rationale=patch["rationale"], source=patch["source"],
                          changes={**changes, "failure_clusters": patch.get("failure_clusters", {})},
                          config_snapshot=config_snapshot))
        await session.commit()


async def list_patches(run_id: str) -> list[dict[str, Any]]:
    async with database.async_session() as session:
        rows = (await session.execute(select(Patch).where(Patch.run_id == run_id).order_by(Patch.generation))).scalars().all()
    return [
        {"wave": p.wave, "generation": p.generation, "title": p.title, "rationale": p.rationale, "source": p.source,
         "changes": p.changes, "created_at": p.created_at.isoformat() if p.created_at else None}
        for p in rows
    ]


async def register_artifact(run_id: str, kind: str, path: Path, real_or_simulated: str,
                            media_type: str | None = None) -> dict[str, Any]:
    artifact_id = new_id("art")
    media = media_type or mimetypes.guess_type(path.name)[0] or "application/octet-stream"
    async with database.async_session() as session:
        # re-exporting replaces the previous artifact of the same kind
        for old in (await session.execute(select(Artifact).where(Artifact.run_id == run_id, Artifact.kind == kind))).scalars():
            await session.delete(old)
        session.add(Artifact(id=artifact_id, run_id=run_id, kind=kind, filename=path.name, path=str(path),
                             media_type=media, real_or_simulated=real_or_simulated,
                             size_bytes=path.stat().st_size if path.exists() else 0))
        await session.commit()
    return {"id": artifact_id, "kind": kind, "filename": path.name, "media_type": media,
            "real_or_simulated": real_or_simulated, "download_url": f"/api/artifacts/{artifact_id}/download"}


def artifact_dict(a: Artifact) -> dict[str, Any]:
    return {"id": a.id, "run_id": a.run_id, "kind": a.kind, "filename": a.filename, "media_type": a.media_type,
            "real_or_simulated": a.real_or_simulated, "size_bytes": a.size_bytes,
            "created_at": a.created_at.isoformat() if a.created_at else None,
            "download_url": f"/api/artifacts/{a.id}/download"}


async def list_artifacts(run_id: str | None = None) -> list[dict[str, Any]]:
    async with database.async_session() as session:
        stmt = select(Artifact).order_by(Artifact.created_at.desc())
        if run_id:
            stmt = stmt.where(Artifact.run_id == run_id)
        rows = (await session.execute(stmt)).scalars().all()
    return [artifact_dict(a) for a in rows]


async def get_artifact(artifact_id: str) -> Artifact | None:
    async with database.async_session() as session:
        return await session.get(Artifact, artifact_id)


def run_dict(r: Run) -> dict[str, Any]:
    return {"id": r.id, "kind": r.kind, "name": r.name, "status": r.status, "provider": r.provider,
            "real_or_simulated": r.real_or_simulated, "truth_mode": r.truth_mode, "parent_run_id": r.parent_run_id,
            "config": r.config, "summary": r.summary, "error": r.error,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "completed_at": r.completed_at.isoformat() if r.completed_at else None}


async def list_runs(kind: str | None = None, limit: int = 50) -> list[dict[str, Any]]:
    async with database.async_session() as session:
        stmt = select(Run).order_by(Run.created_at.desc()).limit(limit)
        if kind:
            stmt = stmt.where(Run.kind == kind)
        rows = (await session.execute(stmt)).scalars().all()
    return [run_dict(r) for r in rows]


async def count_runs() -> int:
    async with database.async_session() as session:
        return int((await session.execute(select(func.count()).select_from(Run))).scalar_one())
