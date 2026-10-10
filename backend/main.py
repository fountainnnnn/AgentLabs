"""AgentLabs backend: FastAPI API plus (optionally) the built frontend as static files."""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from config import settings
from database import init_db
from llm.provider import provider_status
from lora_lab.capabilities import capabilities
from routes.hardening import router as hardening_router
from routes.lora import router as lora_router
from routes.runs import router as runs_router

VERSION = "1.0.0"


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(title="AgentLabs", description="Adversarial hardening for agents and small models", version=VERSION, lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(runs_router)
app.include_router(hardening_router)
app.include_router(lora_router)


@app.get("/healthz")
async def healthz():
    return {"status": "ok"}


@app.get("/api/health")
async def health():
    caps = capabilities()
    return {
        "status": "ok",
        "product": "AgentLabs",
        "version": VERSION,
        "llm": provider_status(),
        "lora_mode": caps["mode"],
        "lora_dependencies": caps["dependencies"],
    }


# --- built frontend (single-container deployment) ---------------------------
DIST = Path(settings.agentlabs_frontend_dist)
if (DIST / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not found")
        candidate = (DIST / full_path).resolve()
        if full_path and DIST.resolve() in candidate.parents and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=int(os.getenv("PORT", "8000")))
