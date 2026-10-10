"""Runtime settings for the AgentLabs backend.

Everything defaults to an offline, zero-cost configuration:

* ``AGENTLABS_LLM_PROVIDER=mock`` uses the deterministic mock provider.
* A real OpenAI-compatible provider is only used when the provider is set to
  ``openai`` *and* ``OPENAI_API_KEY`` is present.
"""

from __future__ import annotations

from functools import cached_property
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent
REPO_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=(str(REPO_ROOT / ".env"), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # LLM provider -----------------------------------------------------------
    agentlabs_llm_provider: str = "mock"  # "mock" or "openai"
    openai_api_key: str = ""
    openai_base_url: str = ""  # e.g. https://openrouter.ai/api/v1 or https://api.deepseek.com
    openai_model: str = "gpt-4o-mini"
    llm_timeout_seconds: float = 60.0

    # Storage ----------------------------------------------------------------
    agentlabs_data_dir: str = str(REPO_ROOT / ".agentlabs")
    database_url: str = ""
    target_configs_dir: str = str(BACKEND_DIR / "target_configs")

    # Hardening loop defaults -----------------------------------------------
    default_waves: int = 3
    default_cases_per_wave: int = 8

    # LoRA lab ---------------------------------------------------------------
    # Comma-separated list of local Hugging Face model directories to offer.
    agentlabs_local_model_paths: str = ""
    agentlabs_allow_real_training: bool = True
    # Delay between simulated training steps so progress is observable.
    agentlabs_sim_step_delay: float = 0.04

    # Web --------------------------------------------------------------------
    agentlabs_cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
    agentlabs_frontend_dist: str = str(REPO_ROOT / "frontend" / "dist")

    @property
    def provider_is_live(self) -> bool:
        return self.agentlabs_llm_provider.lower() == "openai" and bool(self.openai_api_key)

    @property
    def provider_label(self) -> str:
        if self.provider_is_live:
            return f"openai-compatible:{self.openai_model}"
        return "mock"

    @cached_property
    def data_dir(self) -> Path:
        path = Path(self.agentlabs_data_dir)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def artifacts_dir(self) -> Path:
        path = self.data_dir / "artifacts"
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def resolved_database_url(self) -> str:
        if self.database_url:
            return self.database_url
        return f"sqlite+aiosqlite:///{self.data_dir / 'agentlabs.db'}"

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.agentlabs_cors_origins.split(",") if o.strip()]

    @property
    def local_model_paths(self) -> list[str]:
        return [p.strip() for p in self.agentlabs_local_model_paths.split(",") if p.strip()]


settings = Settings()
