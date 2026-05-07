"""Checkpoint management - create, list, compare checkpoints."""

import uuid
import datetime
import random
from typing import Any


class CheckpointManager:
    """Manages training checkpoints with metadata storage and comparison.

    Stores checkpoint metadata in-memory (for demo mode) with basic
    comparison and filtering capabilities.
    """

    def __init__(self):
        self._checkpoints: dict[str, dict[str, Any]] = {}

    def create_checkpoint(
        self,
        name: str,
        metrics: dict[str, Any],
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Create and store a new checkpoint with associated metrics."""
        checkpoint_id = str(uuid.uuid4())
        timestamp = datetime.datetime.utcnow().isoformat()

        checkpoint = {
            "id": checkpoint_id,
            "name": name,
            "timestamp": timestamp,
            "metrics": metrics,
            "metadata": metadata or {},
            "training_step": metrics.get("training_step", 0),
            "pass_rate": metrics.get("pass_rate", 0.0),
            "loss": metrics.get("loss", 0.0),
            "adapter_config": (metadata or {}).get("adapter_config", {}),
        }

        self._checkpoints[checkpoint_id] = checkpoint
        return checkpoint

    def list_checkpoints(self, run_id: str | None = None) -> list[dict[str, Any]]:
        """Return all checkpoints, optionally filtered by run_id.

        Returns checkpoints sorted by timestamp descending (newest first).
        """
        results = list(self._checkpoints.values())

        if run_id:
            results = [c for c in results if c.get("metadata", {}).get("run_id") == run_id]

        results.sort(key=lambda c: c.get("timestamp", ""), reverse=True)
        return results

    def get_checkpoint(self, checkpoint_id: str) -> dict[str, Any] | None:
        """Get a single checkpoint by ID."""
        return self._checkpoints.get(checkpoint_id)

    def compare_checkpoints(
        self,
        checkpoint_a: str | dict[str, Any],
        checkpoint_b: str | dict[str, Any],
    ) -> dict[str, Any]:
        """Side-by-side comparison of two checkpoints.

        Args:
            checkpoint_a: Checkpoint ID string or dict
            checkpoint_b: Checkpoint ID string or dict

        Returns:
            Dict with comparison data including deltas and improvement ratios.
        """
        if isinstance(checkpoint_a, str):
            a = self._checkpoints.get(checkpoint_a)
        else:
            a = checkpoint_a

        if isinstance(checkpoint_b, str):
            b = self._checkpoints.get(checkpoint_b)
        else:
            b = checkpoint_b

        if not a or not b:
            return {
                "error": "One or both checkpoints not found",
                "checkpoint_a_found": a is not None,
                "checkpoint_b_found": b is not None,
            }

        metrics_a = a.get("metrics", {})
        metrics_b = b.get("metrics", {})

        # Compute metric deltas
        metric_keys = set(list(metrics_a.keys()) + list(metrics_b.keys()))
        metric_comparison = {}

        for key in metric_keys:
            val_a = metrics_a.get(key)
            val_b = metrics_b.get(key)
            delta = None
            improvement_pct = None
            if val_a is not None and val_b is not None and isinstance(val_a, (int, float)):
                delta = round(val_b - val_a, 6)
                if val_a != 0:
                    improvement_pct = round((val_b - val_a) / abs(val_a) * 100, 2)

            metric_comparison[key] = {
                "checkpoint_a": val_a,
                "checkpoint_b": val_b,
                "delta": delta,
                "improvement_pct": improvement_pct,
            }

        # Determine which is better overall based on pass_rate
        pass_rate_a = a.get("pass_rate", 0) or 0
        pass_rate_b = b.get("pass_rate", 0) or 0
        loss_a = a.get("loss", float("inf")) or float("inf")
        loss_b = b.get("loss", float("inf")) or float("inf")

        better_pass_rate = "a" if pass_rate_a > pass_rate_b else "b" if pass_rate_b > pass_rate_a else "tie"
        better_loss = "a" if loss_a < loss_b else "b" if loss_b < loss_a else "tie"

        return {
            "checkpoint_a": {
                "id": a["id"],
                "name": a["name"],
                "timestamp": a["timestamp"],
                "training_step": a.get("training_step"),
                "pass_rate": pass_rate_a,
                "loss": loss_a,
            },
            "checkpoint_b": {
                "id": b["id"],
                "name": b["name"],
                "timestamp": b["timestamp"],
                "training_step": b.get("training_step"),
                "pass_rate": pass_rate_b,
                "loss": loss_b,
            },
            "metric_comparison": metric_comparison,
            "summary": {
                "better_pass_rate": better_pass_rate,
                "better_loss": better_loss,
                "pass_rate_delta": round(pass_rate_b - pass_rate_a, 2),
                "loss_delta": round(loss_b - loss_a, 6),
            },
        }


# Global singleton for use across routes
checkpoint_manager = CheckpointManager()
