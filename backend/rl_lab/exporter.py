"""Export artifacts - model cards, training reports, reward traces, bundles."""

import json
import datetime
import zipfile
import io
from typing import Any
from pathlib import Path


class Exporter:
    """Generates exportable artifacts for RL Lab training runs.

    Produces model cards, training reports, reward traces, adapter configs,
    and zip bundles - all in JSON/serializable format.
    """

    def __init__(self, export_dir: str = "exports"):
        self.export_dir = Path(export_dir)
        self.export_dir.mkdir(parents=True, exist_ok=True)

    def export_model_card(
        self,
        checkpoint: dict[str, Any],
        metrics: dict[str, Any],
    ) -> dict[str, Any]:
        """Generate a model card JSON for a trained checkpoint."""
        metadata = checkpoint.get("metadata", {})
        adapter_config = checkpoint.get("adapter_config", {})

        model_card = {
            "model_name": f"agentforge-rl-{checkpoint.get('name', 'unknown')}",
            "base_model": metadata.get("base_model", "demo-open-weight-llm"),
            "fine_tuning_method": "RL + LoRA",
            "adapter_config": adapter_config,
            "training_parameters": {
                "learning_rate": metadata.get("learning_rate", 2e-5),
                "batch_size": metadata.get("batch_size", 64),
                "training_steps": checkpoint.get("training_step", 0),
                "adapter_rank": adapter_config.get("r", 8),
                "lora_alpha": adapter_config.get("lora_alpha", 16),
                "lora_dropout": adapter_config.get("lora_dropout", 0.1),
            },
            "evaluation_metrics": {
                "pass_rate": metrics.get("pass_rate", 0.0),
                "loss": metrics.get("loss", 0.0),
                "refusal_precision": metrics.get("refusal_precision", 0.0),
                "attack_resistance": metrics.get("attack_resistance", 0.0),
                "overall_score": metrics.get("overall_score", 0.0),
            },
            "training_data": {
                "total_samples": metadata.get("total_samples", 0),
                "adversarial_samples": metadata.get("adversarial_samples", 0),
                "refusal_samples": metadata.get("refusal_samples", 0),
                "categories": metadata.get("categories", []),
            },
            "intended_use": "Safety-reinforced agent for customer service applications",
            "limitations": [
                "May not generalize to unseen attack categories",
                "Performance depends on base model capabilities",
                "Regular re-evaluation recommended for production use",
            ],
            "created_at": datetime.datetime.utcnow().isoformat(),
        }

        return model_card

    def export_training_report(
        self,
        run_id: str,
        training_result: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Generate a comprehensive training report for a run."""
        now = datetime.datetime.utcnow().isoformat()

        if training_result is None:
            training_result = {}

        report = {
            "run_id": run_id,
            "report_type": "rl_training_report",
            "generated_at": now,
            "training_summary": training_result.get("training_summary", {}),
            "training_config": training_result.get("config", {}),
            "eval_metrics": training_result.get("eval_metrics", {}),
            "step_metrics": training_result.get("step_metrics", []),
            "anomalies_detected": [],
            "recommendations": [],
        }

        # Analyze for anomalies and recommendations
        step_metrics = training_result.get("step_metrics", [])
        if step_metrics:
            losses = [s.get("loss", 0) for s in step_metrics]
            if losses and len(losses) > 5:
                recent_avg = sum(losses[-5:]) / 5
                initial_avg = sum(losses[:5]) / 5

                if recent_avg > initial_avg * 0.8:
                    report["anomalies_detected"].append(
                        "Loss not decreasing significantly - training may need more steps or higher LR"
                    )
                    report["recommendations"].append(
                        "Increase training steps or adjust learning rate"
                    )
                else:
                    report["recommendations"].append("Loss trend looks healthy - continue monitoring")

                # Check for instability
                variance = sum((l - recent_avg) ** 2 for l in losses[-10:]) / max(len(losses[-10:]), 1)
                if variance > 0.1:
                    report["anomalies_detected"].append(
                        "High loss variance detected - consider gradient clipping or reducing LR"
                    )
                    report["recommendations"].append(
                        "Reduce learning rate or increase batch size for stability"
                    )

        return report

    def export_reward_trace(
        self,
        run_id: str,
        reward_history: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """Generate a reward trace for visualization in the UI."""
        if reward_history is None:
            reward_history = []

        trace = {
            "run_id": run_id,
            "trace_type": "reward_history",
            "total_entries": len(reward_history),
            "reward_traces": reward_history,
            "summary_statistics": self._compute_reward_stats(reward_history),
        }

        return trace

    def export_adapter_config(
        self,
        checkpoint: dict[str, Any],
    ) -> dict[str, Any]:
        """Export LoRA adapter configuration for deployment."""
        adapter_config = checkpoint.get("adapter_config", {}) or {}
        metadata = checkpoint.get("metadata", {})

        config = {
            "adapter_type": "lora",
            "base_model_name": metadata.get("base_model", "demo-open-weight-llm"),
            "r": adapter_config.get("r", 8),
            "lora_alpha": adapter_config.get("lora_alpha", 16),
            "lora_dropout": adapter_config.get("lora_dropout", 0.1),
            "bias": adapter_config.get("bias", "none"),
            "target_modules": adapter_config.get("target_modules", [
                "q_proj", "v_proj", "k_proj", "o_proj",
            ]),
            "task_type": "CAUSAL_LM",
            "inference_mode": True,
            "checkpoint_id": checkpoint.get("id", ""),
            "adapter_weights_file": f"adapter_{checkpoint.get('name', 'unknown')}.bin",
        }

        return config

    def export_bundle(
        self,
        run_id: str,
        artifacts: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Generate a bundle of all export artifacts for a run.

        Returns a dict representation that can be serialised as JSON.
        In real mode, writes to disk as a zip file and returns the path.
        """
        if artifacts is None:
            artifacts = {}

        bundle = {
            "run_id": run_id,
            "bundle_type": "rl_lab_export",
            "generated_at": datetime.datetime.utcnow().isoformat(),
            "artifacts": artifacts,
            "manifest": list(artifacts.keys()),
            "total_artifacts": len(artifacts),
        }

        return bundle

    def _compute_reward_stats(
        self,
        reward_history: list[dict[str, Any]],
    ) -> dict[str, float]:
        """Compute summary statistics for reward traces."""
        if not reward_history:
            return {}

        totals = [r.get("total", 0) for r in reward_history if "total" in r]
        if not totals:
            return {}

        return {
            "mean": round(sum(totals) / len(totals), 4),
            "max": round(max(totals), 4),
            "min": round(min(totals), 4),
            "std": round(
                (sum((t - sum(totals) / len(totals)) ** 2 for t in totals) / len(totals)) ** 0.5,
                4,
            ),
            "count": len(totals),
        }
