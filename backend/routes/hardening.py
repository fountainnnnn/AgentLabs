"""Agent hardening endpoints: agents, and runs of the attack/verify/patch/retest loop."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy import select

import database
from config import settings
from llm.provider import get_provider
from models import AgentConfig
from security import current_owner
from services import run_store
from services.hardening_pipeline import run_hardening, truth_labels
from services.harness import AGENT_CATEGORIES, library_size
from services.target_agent import normalize_config
from services.verifier import VERIFIER_IDS

router = APIRouter(prefix="/api/hardening", tags=["hardening"])
DEMO_AGENT_ID = "agent_demo_refundbot"
MAX_AGENT_BYTES = 256_000


def demo_config() -> dict[str, Any]:
    path = Path(settings.target_configs_dir) / "refund_agent.json"
    return normalize_config(json.loads(path.read_text(encoding="utf-8")))


def public_config(config: dict[str, Any]) -> dict[str, Any]:
    """Agent config as returned by the API: secret values are never sent back."""
    return {**{k: v for k, v in config.items() if k != "secrets"}, "secrets_count": len(config.get("secrets", []))}


def _agent_dict(agent: AgentConfig) -> dict[str, Any]:
    return {"id": agent.id, "name": agent.name, "source": agent.source, "config": public_config(agent.config),
            "created_at": agent.created_at.isoformat() if agent.created_at else None}


async def _store_agent(config: dict[str, Any], source: str, owner: str) -> dict[str, Any]:
    agent_id = run_store.new_id("agent")
    async with database.async_session() as session:
        agent = AgentConfig(id=agent_id, owner_id=owner, name=config["name"], source=source, config=config)
        session.add(agent)
        await session.commit()
        return _agent_dict(agent)


async def _load_agent(agent_id: str, owner: str) -> dict[str, Any]:
    if agent_id == DEMO_AGENT_ID:
        return demo_config()
    async with database.async_session() as session:
        agent = await session.get(AgentConfig, agent_id)
    if agent is None or agent.owner_id != owner:
        raise HTTPException(status_code=404, detail="Agent not found")
    return agent.config


@router.get("/demo-agent")
async def demo_agent():
    return {"id": DEMO_AGENT_ID, "name": demo_config()["name"], "source": "demo", "config": public_config(demo_config()),
            "attack_library": library_size(), "categories": AGENT_CATEGORIES, "verifiers": VERIFIER_IDS}


@router.get("/agents")
async def list_agents(owner: str = Depends(current_owner)):
    async with database.async_session() as session:
        rows = (await session.execute(select(AgentConfig).where(AgentConfig.owner_id == owner)
                                      .order_by(AgentConfig.created_at.desc()).limit(50))).scalars().all()
    return {"agents": [{"id": DEMO_AGENT_ID, "name": demo_config()["name"], "source": "demo"}]
            + [{k: v for k, v in _agent_dict(a).items() if k != "config"} for a in rows]}


@router.post("/agents")
async def create_agent(config: dict[str, Any], owner: str = Depends(current_owner)):
    try:
        normalized = normalize_config(config)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    return await _store_agent(normalized, "upload", owner)


@router.post("/agents/upload")
async def upload_agent(file: UploadFile = File(...), owner: str = Depends(current_owner)):
    data = await file.read()
    if len(data) > MAX_AGENT_BYTES:
        raise HTTPException(status_code=413, detail="agent.json is too large (max 256 KB)")
    try:
        normalized = normalize_config(json.loads(data.decode("utf-8")))
    except (ValueError, UnicodeDecodeError) as exc:
        raise HTTPException(status_code=422, detail=f"Invalid agent.json: {exc}") from exc
    return await _store_agent(normalized, "upload", owner)


@router.get("/agents/{agent_id}")
async def get_agent(agent_id: str, owner: str = Depends(current_owner)):
    return {"id": agent_id, "config": public_config(await _load_agent(agent_id, owner))}


class HardeningRunRequest(BaseModel):
    agent_id: str = DEMO_AGENT_ID
    waves: int = Field(default=settings.default_waves, ge=1, le=6)
    cases_per_wave: int = Field(default=settings.default_cases_per_wave, ge=2, le=20)
    seed: int = 7


@router.post("/runs")
async def start_run(request: HardeningRunRequest, background_tasks: BackgroundTasks, owner: str = Depends(current_owner)):
    config = await _load_agent(request.agent_id, owner)
    provider = get_provider()
    real_or_simulated, truth_mode = truth_labels(provider)
    run_id = await run_store.create_run(
        "hardening", f"Harden {config['name']}", provider=provider.name, real_or_simulated=real_or_simulated,
        truth_mode=truth_mode, config={"agent_id": request.agent_id, "waves": request.waves,
                                       "cases_per_wave": request.cases_per_wave, "seed": request.seed,
                                       "agent_name": config["name"]}, owner=owner)
    background_tasks.add_task(run_hardening, run_id, config, request.waves, request.cases_per_wave, request.seed, provider)
    return {"run_id": run_id, "status": "queued", "real_or_simulated": real_or_simulated, "truth_mode": truth_mode,
            "events_url": f"/api/runs/{run_id}/events"}
