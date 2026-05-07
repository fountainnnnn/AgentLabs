"""Model card exporter - generate HuggingFace-format model cards for trained checkpoints."""

from __future__ import annotations

import datetime
from typing import Any

from rl_lab.schemas import RLModelConfig


def generate_model_card(
    model_config: RLModelConfig,
    checkpoints: list[dict[str, Any]],
    benchmark_results: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Generate a Hugging Face-format model card for a trained checkpoint.

    The model card follows Hugging Face conventions and includes:

    * Model description (base model, training method, architecture)
    * Intended use and limitations
    * Training hyperparameters
    * Safety evaluation results
    * Benchmark summary
    * Environmental impact estimate

    Args:
        model_config: The configuration used for training.
        checkpoints: One or more checkpoint dicts. The last one is used
                     as the primary checkpoint.
        benchmark_results: Optional dict with accuracy and speed benchmarks.

    Returns:
        A dict representing the model card, structured for JSON serialisation.
    """
    primary = checkpoints[-1] if checkpoints else {}
    is_simulated = model_config.source_type == "demo" or not _has_real_training(checkpoints)

    # Extract training parameters
    training_params = {
        "learning_rate": model_config.learning_rate,
        "batch_size": model_config.batch_size,
        "training_steps": model_config.training_steps,
        "adapter_rank": model_config.adapter_rank,
        "precision": model_config.precision,
        "max_seq_length": model_config.max_seq_length,
        "frozen_base": model_config.frozen_base,
        "training_mode": model_config.training_mode,
    }

    # Metrics from the primary checkpoint
    metrics = {
        "reward_score": primary.get("reward_score", 0.0),
        "accuracy": primary.get("accuracy", 0.0),
        "refusal_precision": primary.get("refusal_precision", 0.0),
        "attack_resistance": primary.get("attack_resistance", 0.0),
        "consistency_score": primary.get("consistency_score", 0.0),
        "latency_ms": primary.get("latency_ms", 0.0),
        "tokens_per_second": primary.get("tokens_per_second", 0.0),
    }

    # Merge benchmark results if provided
    if benchmark_results:
        metrics["benchmark_accuracy"] = benchmark_results.get("overall_score", 0.0)
        metrics["benchmark_exact_match"] = benchmark_results.get("exact_match", 0.0)
        metrics["benchmark_speed_tps"] = benchmark_results.get("tokens_per_second", 0.0)

    # Limitations
    limitations = [
        "Performance may degrade on out-of-distribution inputs not seen during training.",
        "The model's safety alignment is limited to the categories in the training dataset.",
        "Adversarial attacks may still succeed, particularly for novel attack patterns.",
        "The model should not be used in high-stakes decision-making without human oversight.",
        "Regular re-evaluation is recommended as new attack patterns emerge.",
    ]
    if is_simulated:
        limitations.insert(
            0,
            "Trained in simulation mode - metrics are estimated and may not reflect real-world performance.",
        )

    return {
        # Meta
        "model_name": model_config.model_name,
        "base_model": model_config.model_name
        if model_config.source_type == "huggingface"
        else model_config.model_path or "demo-model",
        "model_type": "causal_lm",
        "fine_tuning_method": "RL + LoRA" if model_config.frozen_base else "RL (full fine-tune)",
        "training_mode": model_config.training_mode.upper(),

        # Source
        "source_type": model_config.source_type,
        "real_or_simulated": "simulated" if is_simulated else "real",
        "generated_at": datetime.datetime.utcnow().isoformat() + "Z",

        # Training details
        "training_parameters": training_params,

        # Safety objective
        "safety_objective": {
            "description": (
                "Reinforcement learning fine-tuning to improve safety alignment, "
                "refusal accuracy, and attack resistance while maintaining "
                "helpfulness for legitimate requests."
            ),
            "reward_components": [
                "correctness", "refusal_accuracy", "safety",
                "policy_adherence", "tool_safety", "consistency",
            ],
            "penalty_components": [
                "hallucination_penalty", "leakage_penalty",
                "unsafe_compliance_penalty", "reward_hacking_penalty",
            ],
        },

        # Evaluation
        "evaluation_metrics": metrics,

        # Benchmark summary
        "benchmark_summary": _benchmark_summary(metrics, is_simulated),

        # Intended use
        "intended_use": (
            "This model is intended for research and development of safety-aligned "
            "language agents. It is designed to refuse harmful requests while "
            "providing helpful responses to legitimate queries."
        ),

        # Limitations and biases
        "limitations": limitations,

        # Environmental impact (estimated from simulation parameters)
        "environmental_impact": _environmental_impact(model_config, is_simulated),

        # Checkpoint history
        "training_checkpoints": [
            {
                "name": c.get("name", ""),
                "step": c.get("step", 0),
                "reward_score": c.get("reward_score", 0.0),
                "accuracy": c.get("accuracy", 0.0),
            }
            for c in checkpoints[-5:]  # last 5 checkpoints
        ],
    }


def _has_real_training(checkpoints: list[dict[str, Any]]) -> bool:
    """Check if any checkpoint shows evidence of real training."""
    for c in checkpoints:
        if c.get("mode") == "real":
            return True
    return False


def _benchmark_summary(
    metrics: dict[str, float],
    is_simulated: bool,
) -> str:
    """Generate a human-readable benchmark summary string."""
    parts = [
        f"Accuracy: {metrics.get('accuracy', 0.0) * 100:.1f}%",
        f"Reward Score: {metrics.get('reward_score', 0.0):.3f}",
        f"Refusal Precision: {metrics.get('refusal_precision', 0.0) * 100:.1f}%",
        f"Attack Resistance: {metrics.get('attack_resistance', 0.0) * 100:.1f}%",
        f"Consistency: {metrics.get('consistency_score', 0.0) * 100:.1f}%",
        f"Latency: {metrics.get('latency_ms', 0.0):.1f} ms",
        f"Throughput: {metrics.get('tokens_per_second', 0.0):.0f} tok/s",
    ]
    summary = " | ".join(parts)
    if is_simulated:
        summary = "[SIMULATED] " + summary
    return summary


def _environmental_impact(
    config: RLModelConfig,
    is_simulated: bool,
) -> dict[str, Any]:
    """Estimate environmental impact of training run."""
    if is_simulated:
        return {
            "estimated_training_hours": 0.0,
            "estimated_energy_kwh": 0.0,
            "estimated_co2_kg": 0.0,
            "note": "Simulated training - no actual compute was used.",
        }

    # Rough estimate for real training on a 7B model with A100
    steps = config.training_steps
    batch = config.batch_size
    seq_len = config.max_seq_length

    # ~0.5 seconds per step on A100 for 7B model
    hours = (steps * 0.5) / 3600
    # A100 TDP ~400W, estimate 300W actual draw
    energy_kwh = hours * 0.3
    # ~0.4 kg CO2 per kWh (global average)
    co2_kg = energy_kwh * 0.4

    return {
        "estimated_training_hours": round(hours, 2),
        "estimated_energy_kwh": round(energy_kwh, 2),
        "estimated_co2_kg": round(co2_kg, 3),
        "hardware": "Simulated A100 80GB",
        "note": "Rough estimate based on training configuration.",
    }
