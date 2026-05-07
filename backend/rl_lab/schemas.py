"""Pydantic models for RL Lab - configuration, dataset entries, checkpoints, and traces."""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class RLModelConfig(BaseModel):
    """Configuration for an RL-trained model source."""

    model_name: str = "agentforge-rl-model"
    source_type: Literal["demo", "local_path", "uploaded", "huggingface"] = "demo"
    model_path: str = ""
    tokenizer_path: str = ""
    training_mode: Literal["rl", "sft", "dpo"] = "rl"
    frozen_base: bool = True
    adapter_rank: int = 8
    batch_size: int = 64
    training_steps: int = 500
    learning_rate: float = 2e-5
    precision: Literal["fp32", "fp16", "bf16"] = "bf16"
    max_seq_length: int = 2048
    device: Literal["auto", "cpu", "cuda"] = "auto"

    model_config = {"extra": "forbid"}


class RLDatasetEntry(BaseModel):
    """A single training entry in the RL dataset."""

    prompt: str
    correct_answer: str
    policy: str = "default"
    should_refuse: bool = False
    forbidden_outputs: list[str] = Field(default_factory=list)
    category: str = "general"

    model_config = {"extra": "forbid"}


class RLCheckpointData(BaseModel):
    """Metrics snapshot captured at a training checkpoint."""

    name: str
    step: int = 0
    reward_score: float = 0.0
    accuracy: float = 0.0
    refusal_precision: float = 0.0
    attack_resistance: float = 0.0
    consistency_score: float = 0.0
    latency_ms: float = 0.0
    tokens_per_second: float = 0.0

    model_config = {"extra": "forbid"}


class TrainingConfig(BaseModel):
    """Full resolved training configuration derived from RLModelConfig."""

    model_name: str = "agentforge-rl-model"
    source_type: Literal["demo", "local_path", "uploaded", "huggingface"] = "demo"
    model_path: str = ""
    tokenizer_path: str = ""
    training_mode: Literal["rl", "sft", "dpo"] = "rl"
    frozen_base: bool = True
    adapter_rank: int = Field(default=8, ge=1, le=256)
    batch_size: int = Field(default=64, ge=1, le=1024)
    training_steps: int = Field(default=500, ge=1)
    learning_rate: float = Field(default=2e-5, ge=1e-8, le=1.0)
    precision: Literal["fp32", "fp16", "bf16"] = "bf16"
    max_seq_length: int = Field(default=2048, ge=64, le=131072)
    device: Literal["auto", "cpu", "cuda"] = "auto"

    # Resolved runtime fields
    effective_batch_size: int = 0
    gradient_accumulation_steps: int = 1
    total_trainable_params: int = 0
    total_frozen_params: int = 0
    estimated_memory_gb: float = 0.0
    warmup_steps: int = 0
    lr_scheduler_type: str = "cosine"

    model_config = {"extra": "forbid"}

    @classmethod
    def from_model_config(cls, cfg: RLModelConfig, **overrides: Any) -> TrainingConfig:
        """Build a TrainingConfig from an RLModelConfig with resolved runtime fields."""
        base = cfg.model_dump()
        base.update(overrides)
        return cls(**base)


class RewardTracePoint(BaseModel):
    """A single point in the reward trace during training."""

    step: int
    reward: float
    components: dict[str, float] = Field(default_factory=dict)

    model_config = {"extra": "forbid"}
