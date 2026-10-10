"""Runtime capability detection for the LoRA lab (truth modes).

* ``real_local_model``   torch + transformers + peft are importable and a local model directory exists.
* ``adapter_simulation`` anything is missing; training and inference use the deterministic simulator.
"""

from __future__ import annotations

from importlib.util import find_spec
from pathlib import Path
from typing import Any

from config import settings

DEMO_MODEL_ID = "demo-sim-small-lm"
KNOWN_HF_MODELS = {
    "sshleifer/tiny-gpt2": "Tiny GPT-2 (smoke test, about 0.1M params)",
    "distilbert/distilgpt2": "DistilGPT2 (about 82M params)",
    "gpt2": "GPT-2 small (about 124M params)",
}


def dependencies() -> dict[str, bool]:
    return {name: find_spec(name) is not None for name in ("torch", "transformers", "peft")}


def deps_ready() -> bool:
    return all(dependencies().values())


def is_model_dir(path: Path) -> bool:
    return path.is_dir() and (path / "config.json").exists() and (
        (path / "model.safetensors").exists() or (path / "pytorch_model.bin").exists()
    )


def _hf_cache_dir(model_id: str) -> Path | None:
    snapshots = Path.home() / ".cache" / "huggingface" / "hub" / f"models--{model_id.replace('/', '--')}" / "snapshots"
    if not snapshots.exists():
        return None
    for snap in sorted(snapshots.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if is_model_dir(snap):
            return snap
    return None


def list_models() -> list[dict[str, Any]]:
    ready = deps_ready()
    models: list[dict[str, Any]] = [
        {
            "id": DEMO_MODEL_ID,
            "name": "Demo small LM (simulated)",
            "source": "simulation",
            "path": None,
            "available": True,
            "truth_mode": "adapter_simulation",
            "description": "Deterministic stand-in model. Always available; no weights are trained.",
        }
    ]
    seen: set[str] = set()
    for raw in settings.local_model_paths:
        path = Path(raw).expanduser()
        if str(path) in seen:
            continue
        seen.add(str(path))
        models.append({
            "id": f"local:{path.name}",
            "name": path.name,
            "source": "local_path",
            "path": str(path),
            "available": ready and is_model_dir(path),
            "truth_mode": "real_local_model" if ready and is_model_dir(path) else "unavailable",
            "description": "Local Hugging Face model directory from AGENTLABS_LOCAL_MODEL_PATHS."
            + ("" if is_model_dir(path) else " Directory missing config.json or weights."),
        })
    for model_id, label in KNOWN_HF_MODELS.items():
        path = _hf_cache_dir(model_id)
        if path is None or str(path) in seen:
            continue
        models.append({
            "id": f"hf:{model_id}",
            "name": label,
            "source": "hf_cache",
            "path": str(path),
            "available": ready,
            "truth_mode": "real_local_model" if ready else "unavailable",
            "description": "Found in the local Hugging Face cache. Nothing is downloaded by AgentLabs.",
        })
    return models


def resolve_model(model_id: str) -> dict[str, Any] | None:
    return next((m for m in list_models() if m["id"] == model_id), None)


def capabilities() -> dict[str, Any]:
    deps = dependencies()
    real_models = [m for m in list_models() if m["truth_mode"] == "real_local_model"]
    mode = "real_local_model" if deps_ready() and real_models and settings.agentlabs_allow_real_training else "adapter_simulation"
    limitations = [
        "LoRA training targets local or open-weight Hugging Face models only. API models (OpenAI and others) are never fine-tuned.",
        "Exports contain adapter weights or adapter metadata only; base model weights are never exported.",
    ]
    if mode == "adapter_simulation":
        missing = [k for k, v in deps.items() if not v]
        reason = f"missing Python packages: {', '.join(missing)}" if missing else "no local model directory configured"
        limitations.insert(0, f"Adapter Simulation Mode: {reason}. Training curves and checkpoint scores are simulated.")
    return {
        "mode": mode,
        "dependencies": deps,
        "real_training_enabled": settings.agentlabs_allow_real_training,
        "real_models": [m["id"] for m in real_models],
        "limitations": limitations,
    }
