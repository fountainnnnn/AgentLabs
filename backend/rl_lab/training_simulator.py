"""Training simulator - fully deterministic simulation of RL training.

All values are computed from mathematical functions (no random calls) so
that repeated runs with the same parameters produce identical results.
"""

from __future__ import annotations

import math
import time
import uuid
from typing import Any


class TrainingSimulator:
    """Generates realistic training traces without requiring a real model.

    The simulation is built around deterministic mathematical functions:

    * Loss:          exponential decay + sinusoidal perturbation
    * Reward:        sigmoid improvement curve
    * Accuracy:      logarithmic approach to ceiling
    * Speed:         throughput model based on sequence length and batch size
    * Checkpoints:   snapshots at evenly-spaced intervals

    A ``seed_offset`` can be provided to produce different (but still
    deterministic) runs without changing the underlying math.
    """

    def __init__(self, seed_offset: int = 0) -> None:
        self.seed_offset = seed_offset
        self._step_counter = 0

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def simulate_training(
        self,
        config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Run the full training simulation and return all results.

        Args:
            config: Overrides for simulation parameters (training_steps,
                    batch_size, learning_rate, adapter_rank, etc.)

        Returns:
            A dict containing loss_curve, reward_curve, accuracy_curve,
            checkpoint_snapshots, speed_metrics, and the training trace.
        """
        cfg = self._resolve_config(config)
        steps = cfg["training_steps"]

        loss_curve = self._compute_loss_curve(steps)
        reward_curve = self._compute_reward_curve(steps)
        accuracy_curve = self._compute_accuracy_curve(steps)
        speed_metrics = self._compute_speed_metrics(cfg)
        trace = self._build_training_trace(steps, cfg, loss_curve, reward_curve)
        checkpoints = self._build_checkpoints(steps, loss_curve, reward_curve, accuracy_curve, speed_metrics)

        initial_loss = loss_curve[0] if loss_curve else 0.0
        final_loss = loss_curve[-1] if loss_curve else 0.0
        initial_reward = reward_curve[0] if reward_curve else 0.0
        final_reward = reward_curve[-1] if reward_curve else 0.0

        return {
            "status": "completed",
            "mode": "simulated",
            "config": cfg,
            "training_summary": {
                "initial_loss": round(initial_loss, 6),
                "final_loss": round(final_loss, 6),
                "loss_reduction_pct": round(
                    (initial_loss - final_loss) / max(initial_loss, 0.001) * 100, 2
                ),
                "initial_reward": round(initial_reward, 6),
                "final_reward": round(final_reward, 6),
                "reward_improvement_pct": round(
                    (final_reward - initial_reward) / max(abs(initial_reward), 0.001) * 100, 2
                ),
                "total_steps_trained": steps,
                "trained_parameters": cfg["adapter_rank"] * 4 * 4096 * 2,
            },
            "loss_curve": [round(v, 6) for v in loss_curve],
            "reward_curve": [round(v, 6) for v in reward_curve],
            "accuracy_curve": [round(v, 6) for v in accuracy_curve],
            "speed_metrics": speed_metrics,
            "checkpoints": checkpoints,
            "training_trace": trace,
        }

    # ------------------------------------------------------------------
    # Deterministic curves
    # ------------------------------------------------------------------

    def _compute_loss_curve(self, steps: int) -> list[float]:
        """Exponential decay loss from ~2.8 to ~0.15 with sinusoidal noise.

        loss(t) = 0.15 + 2.65 * exp(-0.012 * t) + 0.06 * sin(0.08 * t + offset)
        """
        offset = self.seed_offset * 0.1
        curve = []
        for t in range(steps + 1):
            loss = 0.15 + 2.65 * math.exp(-0.012 * t) + 0.06 * math.sin(0.08 * t + offset)
            curve.append(loss)
        return curve

    def _compute_reward_curve(self, steps: int) -> list[float]:
        """Sigmoid reward improvement from ~0.2 to ~0.85.

        reward(t) = 0.2 + 0.65 / (1 + exp(-0.02 * (t - steps/2)))
        """
        midpoint = steps / 2.0
        curve = []
        for t in range(steps + 1):
            reward = 0.2 + 0.65 / (1.0 + math.exp(-0.02 * (t - midpoint)))
            curve.append(reward)
        return curve

    def _compute_accuracy_curve(self, steps: int) -> list[float]:
        """Logarithmic accuracy improvement from ~0.3 to ~0.92.

        acc(t) = 0.92 - 0.62 * exp(-0.008 * t)
        """
        curve = []
        for t in range(steps + 1):
            acc = 0.92 - 0.62 * math.exp(-0.008 * t)
            curve.append(acc)
        return curve

    def _compute_speed_metrics(self, cfg: dict[str, Any]) -> dict[str, float]:
        """Compute throughput metrics based on model size and batch config.

        Parameters:
            Batch size and adapter rank affect throughput.
            Simulates a 7B model on an A100-equivalent GPU.
        """
        rank = cfg["adapter_rank"]
        batch = cfg["batch_size"]
        seq_len = cfg.get("max_seq_length", 2048)

        # Base throughput for a 7B model (tokens/sec on A100)
        base_tps = 2800.0  # typical for fp16 7B inference
        # Adapter overhead reduces throughput slightly
        adapter_overhead = 1.0 - (rank / 256.0) * 0.15
        # Batch size scaling (diminishing returns)
        batch_scale = math.log2(max(batch, 1)) / math.log2(64)
        tps = base_tps * adapter_overhead * min(batch_scale, 2.0)

        # Latency per token
        latency_per_token_ms = 1000.0 / tps
        # Latency per forward pass
        latency_per_step_ms = latency_per_token_ms * seq_len

        # Memory estimate
        param_memory_gb = 7.0 * 2.0 / 1024 * (1024**3) / (1024**3)  # 7B fp16 = ~14GB
        # Actually: 7B params * 2 bytes = 14 GB base
        base_memory_gb = 14.0
        adapter_memory_gb = rank * 4 * 4096 * 2 * 2.0 / (1024**3)  # very small
        activation_memory_gb = batch * seq_len * 4096 * 2.0 / (1024**3) * 0.5

        peak_memory = base_memory_gb + adapter_memory_gb + activation_memory_gb + 2.0

        return {
            "avg_tokens_per_second": round(tps, 2),
            "avg_latency_per_token_ms": round(latency_per_token_ms, 4),
            "avg_latency_per_step_ms": round(latency_per_step_ms, 2),
            "peak_memory_gb": round(peak_memory, 2),
            "device": "simulated (A100-class)",
        }

    # ------------------------------------------------------------------
    # Trace and checkpoints
    # ------------------------------------------------------------------

    def _build_training_trace(
        self,
        steps: int,
        cfg: dict[str, Any],
        loss_curve: list[float],
        reward_curve: list[float],
    ) -> list[dict[str, Any]]:
        """Build a detailed step-by-step trace at logging intervals."""
        log_interval = max(1, steps // 50)
        trace = []
        warmup = int(steps * 0.1)

        for t in range(0, steps + 1, log_interval):
            lr = self._lr_schedule(t, steps, cfg["learning_rate"], warmup)
            acc = 0.92 - 0.62 * math.exp(-0.008 * t)

            trace.append({
                "step": t,
                "loss": round(loss_curve[t], 6),
                "reward": round(reward_curve[t], 6),
                "accuracy": round(acc, 6),
                "learning_rate": round(lr, 10),
                "elapsed_seconds": round(t * 0.015, 3),
            })

        return trace

    def _build_checkpoints(
        self,
        steps: int,
        loss_curve: list[float],
        reward_curve: list[float],
        accuracy_curve: list[float],
        speed_metrics: dict[str, float],
    ) -> list[dict[str, Any]]:
        """Create checkpoint snapshots at evenly-spaced intervals."""
        num_checkpoints = min(10, max(3, steps // 50))
        interval = max(1, steps // num_checkpoints)
        checkpoints = []

        for t in range(0, steps + 1, interval):
            ckpt = self._make_checkpoint(
                step=t,
                steps=steps,
                loss=loss_curve[t],
                reward=reward_curve[t],
                accuracy=accuracy_curve[t],
                speed_metrics=speed_metrics,
            )
            checkpoints.append(ckpt)

        return checkpoints

    def _make_checkpoint(
        self,
        step: int,
        steps: int,
        loss: float,
        reward: float,
        accuracy: float,
        speed_metrics: dict[str, float],
    ) -> dict[str, Any]:
        """Build a single checkpoint dict."""
        progress = step / max(steps, 1)

        # Refusal precision: improves with training
        refusal_precision = 0.3 + 0.7 * (1.0 - math.exp(-0.01 * step))

        # Attack resistance: similar but slower to improve
        attack_resistance = 0.2 + 0.75 * (1.0 - math.exp(-0.008 * step))

        # Consistency score: improves steadily
        consistency = 0.4 + 0.55 * (1.0 - math.exp(-0.012 * step))

        return {
            "name": f"step-{step}",
            "step": step,
            "reward_score": round(reward, 4),
            "accuracy": round(accuracy, 4),
            "loss": round(loss, 6),
            "refusal_precision": round(refusal_precision, 4),
            "attack_resistance": round(attack_resistance, 4),
            "consistency_score": round(consistency, 4),
            "latency_ms": speed_metrics.get("avg_latency_per_step_ms", 0.0),
            "tokens_per_second": speed_metrics.get("avg_tokens_per_second", 0.0),
            "progress_pct": round(progress * 100, 1),
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _resolve_config(overrides: dict[str, Any] | None) -> dict[str, Any]:
        """Merge user overrides with sensible defaults."""
        defaults: dict[str, Any] = {
            "training_steps": 500,
            "batch_size": 64,
            "learning_rate": 2e-5,
            "adapter_rank": 8,
            "max_seq_length": 2048,
            "precision": "bf16",
        }
        if overrides:
            defaults.update(overrides)
        return defaults

    @staticmethod
    def _lr_schedule(
        step: int,
        total_steps: int,
        peak_lr: float,
        warmup: int,
    ) -> float:
        """Cosine LR schedule with linear warmup."""
        if step < warmup:
            return 1e-7 + (peak_lr - 1e-7) * (step / max(warmup, 1))
        progress = (step - warmup) / max(total_steps - warmup, 1)
        return 1e-7 + (peak_lr - 1e-7) * 0.5 * (1.0 + math.cos(math.pi * progress))
