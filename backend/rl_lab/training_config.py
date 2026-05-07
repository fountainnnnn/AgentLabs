"""Training configuration - build resolved configs and validate for potential issues."""

from __future__ import annotations

import math
from typing import Any

from rl_lab.schemas import RLModelConfig, TrainingConfig


def build_training_config(model_config: RLModelConfig) -> TrainingConfig:
    """Build a fully resolved TrainingConfig from an RLModelConfig.

    Computes runtime fields:
    * effective_batch_size (with gradient accumulation)
    * gradient_accumulation_steps
    * total_trainable_params (estimated)
    * total_frozen_params (estimated)
    * estimated_memory_gb
    * warmup_steps
    * lr_scheduler_type
    """
    # Gradient accumulation: target a reasonable effective batch
    target_effective = model_config.batch_size * 4
    grad_accum = max(1, target_effective // model_config.batch_size)

    # Parameter estimates based on adapter rank and typical 7B model
    hidden_size = 4096  # typical for 7B-class models
    num_layers = 32
    num_heads = 32

    # LoRA params per target module: 2 * hidden_size * rank (for Q and V)
    target_modules = 4  # q_proj, v_proj, k_proj, o_proj
    lora_params_per_layer = target_modules * 2 * hidden_size * model_config.adapter_rank
    total_lora_params = lora_params_per_layer * num_layers

    # Base model estimate (7B)
    base_params = 7_000_000_000
    trainable = total_lora_params if model_config.frozen_base else base_params
    frozen = base_params if model_config.frozen_base else 0

    # Memory estimate
    bytes_per_param = {"fp32": 4, "fp16": 2, "bf16": 2}.get(model_config.precision, 2)
    param_memory = base_params * bytes_per_param / (1024**3)
    optimizer_memory = trainable * bytes_per_param * 2 / (1024**3)  # Adam states
    activation_memory = (
        model_config.batch_size * model_config.max_seq_length * hidden_size * bytes_per_param
        / (1024**3) * 0.5
    )
    estimated_memory = param_memory + optimizer_memory + activation_memory + 2.0  # overhead

    warmup_steps = int(model_config.training_steps * 0.1)

    return TrainingConfig(
        model_name=model_config.model_name,
        source_type=model_config.source_type,
        model_path=model_config.model_path,
        tokenizer_path=model_config.tokenizer_path,
        training_mode=model_config.training_mode,
        frozen_base=model_config.frozen_base,
        adapter_rank=model_config.adapter_rank,
        batch_size=model_config.batch_size,
        training_steps=model_config.training_steps,
        learning_rate=model_config.learning_rate,
        precision=model_config.precision,
        max_seq_length=model_config.max_seq_length,
        device=model_config.device,
        effective_batch_size=model_config.batch_size * grad_accum,
        gradient_accumulation_steps=grad_accum,
        total_trainable_params=trainable,
        total_frozen_params=frozen,
        estimated_memory_gb=round(estimated_memory, 2),
        warmup_steps=warmup_steps,
        lr_scheduler_type="cosine",
    )


def validate_training_config(config: TrainingConfig | RLModelConfig) -> list[str]:
    """Validate training configuration and return a list of warning messages.

    Returns an empty list when everything looks reasonable.
    """
    warnings: list[str] = []

    # Source type checks
    if config.source_type == "local_path" and not config.model_path:
        warnings.append("source_type is 'local_path' but model_path is empty")
    if config.source_type == "uploaded" and not config.model_path:
        warnings.append("source_type is 'uploaded' but model_path is empty")
    if config.source_type == "huggingface" and not config.model_name:
        warnings.append("source_type is 'huggingface' but model_name is empty")

    # Numeric range checks
    if config.adapter_rank < 1:
        warnings.append("adapter_rank must be >= 1")
    if config.adapter_rank > 256:
        warnings.append("adapter_rank > 256 may cause training instability")
    if config.learning_rate > 0.01:
        warnings.append("learning_rate > 0.01 is unusually high for RL fine-tuning")
    if config.learning_rate < 1e-8:
        warnings.append("learning_rate < 1e-8 is too low to make progress")
    if config.batch_size < 1:
        warnings.append("batch_size must be >= 1")
    if config.training_steps < 10:
        warnings.append("training_steps < 10 may not converge")
    if config.training_steps > 100_000:
        warnings.append("training_steps > 100,000 may overfit")

    # Memory check (if config is a TrainingConfig with resolved estimates)
    if isinstance(config, TrainingConfig) and config.estimated_memory_gb > 0:
        if config.estimated_memory_gb > 80:
            warnings.append(
                f"estimated memory {config.estimated_memory_gb:.1f} GB exceeds typical GPU memory"
            )
        elif config.estimated_memory_gb > 24:
            warnings.append(
                f"estimated memory {config.estimated_memory_gb:.1f} GB may not fit on consumer GPUs"
            )

    # Precision / device compatibility
    if config.precision in ("fp16", "bf16") and config.device == "cpu":
        warnings.append(
            f"precision '{config.precision}' is not recommended on CPU; use 'fp32'"
        )

    return warnings
