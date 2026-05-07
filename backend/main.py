"""AgentForge Backend - FastAPI Application."""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from config import settings
from database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(
    title="AgentForge",
    description="Agent Hardening & Evaluation System",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routes.runs import router as runs_router
from routes.rl_lab import router as rl_lab_router
from routes.agent_hardening import router as agent_hardening_router

app.include_router(runs_router)
app.include_router(rl_lab_router)
app.include_router(agent_hardening_router)


@app.get("/api/health")
async def health():
    return {
        "status": "ok",
        "mode": "mock" if settings.mock_mode else "live",
        "model": settings.openai_model if not settings.mock_mode else None,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
