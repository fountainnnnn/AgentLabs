"""LoRA lab endpoints: capabilities, models, datasets, adversarial evaluation, training, exports."""

from __future__ import annotations

from typing import Any, Literal

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select

import database
from lora_lab import capabilities, datasets, service
from models import Dataset
from services import run_store

router = APIRouter(prefix="/api/lora", tags=["lora"])
MAX_DATASET_BYTES = 5_000_000


@router.get("/capabilities")
async def get_capabilities():
    return capabilities.capabilities()


@router.get("/models")
async def get_models():
    return {"models": capabilities.list_models(), "capabilities": capabilities.capabilities()}


def _dataset_dict(ds: Dataset, preview: int = 12) -> dict[str, Any]:
    return {"id": ds.id, "name": ds.name, "source": ds.source, "summary": datasets.summarize(ds.samples),
            "preview": ds.samples[:preview], "created_at": ds.created_at.isoformat() if ds.created_at else None}


async def _save_dataset(name: str, source: str, samples: list[dict[str, Any]]) -> dict[str, Any]:
    async with database.async_session() as session:
        ds = Dataset(id=run_store.new_id("ds"), name=name, source=source, samples=samples)
        session.add(ds)
        await session.commit()
        return _dataset_dict(ds)


async def _load_dataset(dataset_id: str) -> list[dict[str, Any]]:
    async with database.async_session() as session:
        ds = await session.get(Dataset, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return ds.samples


@router.post("/datasets/demo")
async def create_demo_dataset():
    return await _save_dataset("demo-adversarial-safety", "demo", datasets.demo_samples())


@router.post("/datasets/upload")
async def upload_dataset(file: UploadFile = File(...)):
    data = await file.read()
    if len(data) > MAX_DATASET_BYTES:
        raise HTTPException(status_code=413, detail="Dataset too large (max 5 MB)")
    try:
        samples = datasets.parse_upload(file.filename or "dataset.json", data)
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid dataset: {exc}") from exc
    return await _save_dataset(file.filename or "uploaded-dataset", "upload", samples)


@router.get("/datasets")
async def list_datasets():
    async with database.async_session() as session:
        rows = (await session.execute(select(Dataset).order_by(Dataset.created_at.desc()).limit(50))).scalars().all()
    return {"datasets": [_dataset_dict(d, preview=0) for d in rows]}


@router.get("/datasets/{dataset_id}")
async def get_dataset(dataset_id: str):
    async with database.async_session() as session:
        ds = await session.get(Dataset, dataset_id)
    if ds is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    return _dataset_dict(ds, preview=50)


class Target(BaseModel):
    type: Literal["simulated", "local", "provider"] = "simulated"
    model_id: str | None = None


class EvalRequest(BaseModel):
    dataset_id: str
    target: Target = Field(default_factory=Target)
    checkpoint_run_id: str | None = None
    baseline_run_id: str | None = None
    max_cases: int = Field(default=64, ge=1, le=500)


@router.post("/evaluations")
async def start_evaluation(request: EvalRequest, background_tasks: BackgroundTasks):
    samples = (await _load_dataset(request.dataset_id))[: request.max_cases]
    try:
        target = service.resolve_target(request.target.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    if request.checkpoint_run_id and target["type"] == "provider":
        raise HTTPException(status_code=409, detail="Provider models cannot load LoRA checkpoints.")
    phase = "checkpoint" if request.checkpoint_run_id else "baseline"
    run_id = await run_store.create_run(
        "model_eval", f"{'Checkpoint' if request.checkpoint_run_id else 'Baseline'} eval: {target['label']}",
        provider=target["label"], real_or_simulated=target["real_or_simulated"], truth_mode=target["truth_mode"],
        config={"dataset_id": request.dataset_id, "target": request.target.model_dump(), "phase": phase,
                "baseline_run_id": request.baseline_run_id, "cases": len(samples)},
        parent_run_id=request.checkpoint_run_id)
    background_tasks.add_task(service.run_model_eval, run_id, samples, target, phase, request.checkpoint_run_id)
    return {"run_id": run_id, "status": "queued", "phase": phase, "real_or_simulated": target["real_or_simulated"],
            "truth_mode": target["truth_mode"]}


class TrainRequest(BaseModel):
    dataset_id: str
    target: Target = Field(default_factory=Target)
    rank: int = Field(default=8, ge=1, le=64)
    alpha: int = Field(default=16, ge=1, le=128)
    dropout: float = Field(default=0.05, ge=0.0, le=0.5)
    learning_rate: float = Field(default=2e-4, gt=0, le=0.1)
    steps: int = Field(default=40, ge=1, le=500)
    batch_size: int = Field(default=4, ge=1, le=32)
    max_samples: int = Field(default=64, ge=1, le=2000)


@router.post("/training")
async def start_training(request: TrainRequest, background_tasks: BackgroundTasks):
    samples = await _load_dataset(request.dataset_id)
    if request.target.type == "provider":
        raise HTTPException(status_code=409, detail="API provider models are never fine-tuned. Choose the simulated or a local model.")
    try:
        target = service.resolve_target(request.target.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    params = request.model_dump(exclude={"dataset_id", "target"})
    run_id = await run_store.create_run(
        "lora_training", f"LoRA r{request.rank} on {target['label']}", provider=target["label"],
        real_or_simulated=target["real_or_simulated"], truth_mode=target["truth_mode"],
        config={"dataset_id": request.dataset_id, "target": request.target.model_dump(), **params})
    background_tasks.add_task(service.run_training, run_id, samples, target, params)
    return {"run_id": run_id, "status": "queued", "real_or_simulated": target["real_or_simulated"], "truth_mode": target["truth_mode"]}


@router.get("/training/{run_id}/comparison")
async def comparison(run_id: str):
    result = await service.eval_comparison(run_id)
    if result is None:
        raise HTTPException(status_code=404, detail="No completed baseline and checkpoint evaluation linked to this run")
    return result


@router.post("/training/{run_id}/export")
async def export_training(run_id: str):
    run = await run_store.get_run(run_id)
    if run is None or run.kind != "lora_training" or run.status != "completed":
        raise HTTPException(status_code=409, detail="Training run is not complete")
    return {"run_id": run_id, "artifacts": await service.export_lora_bundle(run_id)}
