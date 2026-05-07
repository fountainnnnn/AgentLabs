"""RL exporter - aggregate all training artifacts into a structured export bundle."""

from __future__ import annotations

import datetime
import io
import json
import shutil
import zipfile
from pathlib import Path
from typing import Any

from rl_lab.model_card_exporter import generate_model_card
from rl_lab.schemas import RLModelConfig


def export_all(
    run_id: str,
    model_config: RLModelConfig,
    checkpoints: list[dict[str, Any]],
    benchmark_results: dict[str, Any] | None = None,
    reward_traces: list[dict[str, Any]] | None = None,
    output_dir: str | Path | None = None,
) -> dict[str, Any]:
    """Generate all export artifacts for an RL training run.

    Produces:
    1. ``model_card.json``        -- HuggingFace-format model card
    2. ``training_report.json``    -- Full training run report
    3. ``reward_trace.json``       -- Reward history for visualisation
    4. ``adapter_config.json``     -- LoRA adapter configuration
    5. ``README.md``               -- Human-readable summary
    6. ``bundle.zip``              -- Archive of all the above (and optionally, adapter weights)

    Args:
        run_id: Unique identifier for this training run.
        model_config: The configuration used for training.
        checkpoints: Checkpoint snapshots from training.
        benchmark_results: Optional accuracy/speed benchmarks.
        reward_traces: Optional step-by-step reward history.
        output_dir: Directory to write artifacts. If None, uses
                    ``exports/<run_id>/``.

    Returns:
        Dict with paths to each generated artifact and a summary of contents.
    """
    if output_dir is None:
        output_dir = Path("exports") / run_id
    else:
        output_dir = Path(output_dir)

    output_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # 1. Model card
    # ------------------------------------------------------------------
    model_card = generate_model_card(model_config, checkpoints, benchmark_results)
    _write_json(output_dir / "model_card.json", model_card)

    # ------------------------------------------------------------------
    # 2. Training report
    # ------------------------------------------------------------------
    training_report = _build_training_report(run_id, model_config, checkpoints)
    _write_json(output_dir / "training_report.json", training_report)

    # ------------------------------------------------------------------
    # 3. Reward trace
    # ------------------------------------------------------------------
    if reward_traces is None:
        # Build from checkpoints
        reward_traces = [
            {
                "step": c.get("step", i * 50),
                "reward": c.get("reward_score", 0.0),
                "components": {
                    "accuracy": c.get("accuracy", 0.0),
                    "refusal_precision": c.get("refusal_precision", 0.0),
                    "attack_resistance": c.get("attack_resistance", 0.0),
                },
            }
            for i, c in enumerate(checkpoints)
        ]

    reward_trace = {
        "run_id": run_id,
        "trace_type": "reward_history",
        "total_entries": len(reward_traces),
        "reward_traces": reward_traces,
        "summary_statistics": _reward_stats(reward_traces),
    }
    _write_json(output_dir / "reward_trace.json", reward_trace)

    # ------------------------------------------------------------------
    # 4. Adapter config
    # ------------------------------------------------------------------
    adapter_config = _build_adapter_config(model_config, checkpoints)
    _write_json(output_dir / "adapter_config.json", adapter_config)

    # ------------------------------------------------------------------
    # 5. README
    # ------------------------------------------------------------------
    readme = _build_readme(run_id, model_config, checkpoints, model_card)
    _write_text(output_dir / "README.md", readme)

    # ------------------------------------------------------------------
    # 6. Bundle zip
    # ------------------------------------------------------------------
    bundle_path = output_dir / "bundle.zip"
    _create_bundle(bundle_path, output_dir, adapter_config)

    return {
        "run_id": run_id,
        "output_dir": str(output_dir),
        "artifacts": {
            "model_card": str(output_dir / "model_card.json"),
            "training_report": str(output_dir / "training_report.json"),
            "reward_trace": str(output_dir / "reward_trace.json"),
            "adapter_config": str(output_dir / "adapter_config.json"),
            "readme": str(output_dir / "README.md"),
            "bundle": str(bundle_path),
        },
        "summary": {
            "total_artifacts": 6,
            "checkpoints_exported": len(checkpoints),
            "reward_trace_points": len(reward_traces),
        },
    }


# ------------------------------------------------------------------
# Internal builders
# ------------------------------------------------------------------

def _build_training_report(
    run_id: str,
    config: RLModelConfig,
    checkpoints: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build a comprehensive training report."""
    primary = checkpoints[-1] if checkpoints else {}

    return {
        "run_id": run_id,
        "report_type": "rl_training_report",
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",
        "status": "completed",
        "config": {
            "model_name": config.model_name,
            "source_type": config.source_type,
            "training_mode": config.training_mode,
            "frozen_base": config.frozen_base,
            "adapter_rank": config.adapter_rank,
            "batch_size": config.batch_size,
            "training_steps": config.training_steps,
            "learning_rate": config.learning_rate,
            "precision": config.precision,
            "max_seq_length": config.max_seq_length,
            "device": config.device,
        },
        "checkpoints_count": len(checkpoints),
        "final_metrics": {
            "reward_score": primary.get("reward_score", 0.0),
            "accuracy": primary.get("accuracy", 0.0),
            "refusal_precision": primary.get("refusal_precision", 0.0),
            "attack_resistance": primary.get("attack_resistance", 0.0),
            "consistency_score": primary.get("consistency_score", 0.0),
            "latency_ms": primary.get("latency_ms", 0.0),
            "tokens_per_second": primary.get("tokens_per_second", 0.0),
        },
        "checkpoints": [
            {
                "name": c.get("name", ""),
                "step": c.get("step", 0),
                "reward_score": c.get("reward_score", 0.0),
                "accuracy": c.get("accuracy", 0.0),
            }
            for c in checkpoints
        ],
        "anomalies_detected": [],
        "recommendations": [
            "Consider additional training on edge cases if refusal precision < 0.9",
            "Run adversarial evaluation to validate attack resistance",
            "Benchmark on target hardware for production latency profiling",
        ],
    }


def _build_adapter_config(
    config: RLModelConfig,
    checkpoints: list[dict[str, Any]],
) -> dict[str, Any]:
    """Build a deploy-ready LoRA adapter configuration."""
    primary = checkpoints[-1] if checkpoints else {}
    is_simulated = config.source_type == "demo"

    return {
        "adapter_type": "lora",
        "base_model_name": config.model_name
        if config.source_type == "huggingface"
        else config.model_path or "demo-model",
        "base_model_source": config.source_type,
        "r": config.adapter_rank,
        "lora_alpha": config.adapter_rank * 2,
        "lora_dropout": 0.05,
        "bias": "none",
        "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj"],
        "task_type": "CAUSAL_LM",
        "inference_mode": True,
        "checkpoint_name": primary.get("name", "unknown"),
        "checkpoint_step": primary.get("step", 0),
        "adapter_weights_file": f"adapter_{primary.get('name', 'unknown')}.bin",
        "real_weights_available": False if is_simulated else _check_weights_available(config),
        "training_config": {
            "batch_size": config.batch_size,
            "learning_rate": config.learning_rate,
            "precision": config.precision,
            "max_seq_length": config.max_seq_length,
        },
    }


def _build_readme(
    run_id: str,
    config: RLModelConfig,
    checkpoints: list[dict[str, Any]],
    model_card: dict[str, Any],
) -> str:
    """Generate a human-readable README for the export bundle."""
    primary = checkpoints[-1] if checkpoints else {}
    is_sim = config.source_type == "demo"
    metrics = model_card.get("evaluation_metrics", {})

    return f"""# AgentForge RL Lab - Export Bundle

## Run Information
- **Run ID:** {run_id}
- **Model:** {config.model_name}
- **Training Mode:** {config.training_mode.upper() + (' (Simulated)' if is_sim else '')}
- **Source Type:** {config.source_type}
- **Generated:** {datetime.datetime.utcnow().isoformat() + 'Z'}

## Training Configuration
| Parameter | Value |
|-----------|-------|
| Adapter Rank | {config.adapter_rank} |
| Batch Size | {config.batch_size} |
| Training Steps | {config.training_steps} |
| Learning Rate | {config.learning_rate} |
| Precision | {config.precision} |
| Max Seq Length | {config.max_seq_length} |
| Frozen Base | {config.frozen_base} |

## Final Metrics
| Metric | Value |
|--------|-------|
| Reward Score | {metrics.get('reward_score', 0.0):.4f} |
| Accuracy | {metrics.get('accuracy', 0.0) * 100:.1f}% |
| Refusal Precision | {metrics.get('refusal_precision', 0.0) * 100:.1f}% |
| Attack Resistance | {metrics.get('attack_resistance', 0.0) * 100:.1f}% |
| Consistency | {metrics.get('consistency_score', 0.0) * 100:.1f}% |
| Latency | {metrics.get('latency_ms', 0.0):.1f} ms |
| Throughput | {metrics.get('tokens_per_second', 0.0):.0f} tok/s |

## Checkpoints
| Name | Step | Reward | Accuracy |
|------|------|--------|----------|
{chr(10).join(f"| {c.get('name', '')} | {c.get('step', 0)} | {c.get('reward_score', 0.0):.4f} | {c.get('accuracy', 0.0):.4f} |" for c in checkpoints[-10:])}

## Intended Use
{model_card.get('intended_use', 'Research and development of safety-aligned language agents.')}

## Limitations
{"- " + chr(10) + "- ".join(model_card.get('limitations', []))}

## Files
- `model_card.json` - HuggingFace-format model card
- `training_report.json` - Full training run report
- `reward_trace.json` - Reward history for visualisation
- `adapter_config.json` - LoRA adapter configuration
- `README.md` - This file
- `bundle.zip` - Archive of all artifacts
"""


def _create_bundle(
    bundle_path: Path,
    source_dir: Path,
    adapter_config: dict[str, Any],
) -> None:
    """Create a zip bundle of all artifacts."""
    with zipfile.ZipFile(bundle_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in source_dir.iterdir():
            if file_path.is_file() and file_path.suffix in (".json", ".md"):
                zf.write(file_path, arcname=file_path.name)

        # Include README
        readme_path = source_dir / "README.md"
        if readme_path.exists():
            zf.write(readme_path, arcname="README.md")

        # Add adapter config as a convenience
        zf.writestr("adapter_config.json", json.dumps(adapter_config, indent=2))


def _write_json(path: Path, data: Any) -> None:
    """Write JSON data to a file."""
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, default=str)


def _write_text(path: Path, text: str) -> None:
    """Write text data to a file."""
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def _reward_stats(traces: list[dict[str, Any]]) -> dict[str, float]:
    """Compute summary statistics for reward traces."""
    if not traces:
        return {}

    rewards = [t.get("reward", 0.0) for t in traces if "reward" in t]
    if not rewards:
        return {}

    n = len(rewards)
    mean = sum(rewards) / n
    variance = sum((r - mean) ** 2 for r in rewards) / n

    return {
        "mean": round(mean, 4),
        "max": round(max(rewards), 4),
        "min": round(min(rewards), 4),
        "std": round(variance**0.5, 4),
        "count": n,
    }


def _check_weights_available(config: RLModelConfig) -> bool:
    """Check if real adapter weight files exist for the model."""
    import os
    if config.source_type == "local_path" and config.model_path:
        adapter_path = os.path.join(config.model_path, "adapter_model.bin")
        return os.path.isfile(adapter_path)
    if config.source_type == "uploaded":
        adapter_path = f"artifacts/models/{config.model_path}/adapter_model.bin"
        return os.path.isfile(adapter_path)
    return False
