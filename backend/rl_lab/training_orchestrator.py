"""Training orchestration - freeze plans, schedules, and full pipeline coordination."""

import random
from typing import Any


def freeze_base_layers_plan(model_config: dict | None = None) -> dict[str, Any]:
    """Return a layer freeze configuration plan for PEFT training.

    Generates a realistic plan indicating which layers are frozen,
    which are trainable via adapters, and the reasoning per layer block.
    """
    if model_config is None:
        model_config = {
            "num_layers": 32,
            "num_attention_heads": 32,
            "hidden_size": 4096,
            "intermediate_size": 11008,
            "vocab_size": 32000,
        }

    num_layers = model_config.get("num_layers", 32)

    # Typically: embed + first 60% frozen, middle 20% adapter-only, top 20% full adapter
    freeze_boundary = int(num_layers * 0.6)
    adapter_boundary = int(num_layers * 0.8)

    layer_plan = []
    for i in range(num_layers):
        if i < freeze_boundary:
            state = "frozen"
            reasoning = "Base layers - general language understanding, no task-specific tuning needed"
        elif i < adapter_boundary:
            state = "adapter"
            reasoning = "Middle layers - LoRA adapters applied for task-specific steering"
        else:
            state = "adapter"
            reasoning = "Top layers - LoRA adapters with higher rank for output behaviour control"

        layer_plan.append({
            "layer_index": i,
            "state": state,
            "adapter_rank": 8 if state == "adapter" else 0,
            "adapter_alpha": 16 if state == "adapter" else 0,
            "reasoning": reasoning,
        })

    return {
        "model_config": model_config,
        "total_layers": num_layers,
        "frozen_layers": freeze_boundary,
        "adapter_layers": num_layers - freeze_boundary,
        "trainable_parameters_pct": round((num_layers - freeze_boundary) / num_layers * 100, 1),
        "layer_plan": layer_plan,
        "embedding_frozen": True,
        "lm_head_frozen": False,
        "adapter_type": "lora",
        "adapter_config": {
            "r": 8,
            "lora_alpha": 16,
            "lora_dropout": 0.1,
            "bias": "none",
            "target_modules": ["q_proj", "v_proj", "k_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        },
    }


def create_training_schedule(steps: int = 500) -> dict[str, Any]:
    """Return a step-by-step training schedule.

    Generates a realistic schedule with learning rate warmup,
    cosine decay, and evaluation milestones.
    """
    warmup_steps = int(steps * 0.1)
    eval_every = max(1, steps // 10)

    milestones = []
    for step in range(0, steps + 1, eval_every):
        progress = step / max(steps, 1)
        if step < warmup_steps:
            lr = 1e-6 + (2e-5 - 1e-6) * (step / max(warmup_steps, 1))
        else:
            # Cosine decay
            cosine_progress = (step - warmup_steps) / max(steps - warmup_steps, 1)
            lr = 1e-6 + (2e-5 - 1e-6) * 0.5 * (1 + math.cos(math.pi * cosine_progress))
        milestones.append({
            "step": step,
            "learning_rate": round(lr, 8),
            "progress_pct": round(progress * 100, 1),
            "eval": step > 0 and step % eval_every == 0,
        })

    return {
        "total_steps": steps,
        "warmup_steps": warmup_steps,
        "eval_every": eval_every,
        "save_every": max(1, steps // 5),
        "logging_every": max(1, steps // 50),
        "learning_rate_schedule": "cosine",
        "peak_learning_rate": 2e-5,
        "final_learning_rate": 1e-6,
        "milestones": milestones,
        "optimizer": {
            "type": "adamw_8bit",
            "beta1": 0.9,
            "beta2": 0.999,
            "epsilon": 1e-8,
            "weight_decay": 0.01,
        },
    }


def orchestrate_training_pipeline(
    config: dict[str, Any],
    dataset: list[dict[str, Any]],
) -> dict[str, Any]:
    """Orchestrate the full RL training pipeline.

    This is the high-level coordinator that sequences:
    1. Freeze plan generation
    2. Training schedule creation
    3. Training execution (delegated to AdapterTrainer)
    4. Evaluation (delegated to Evaluator)
    5. Checkpoint creation (delegated to CheckpointManager)

    In demo mode, returns a realistic orchestration plan with simulated
    step-by-step progress.
    """
    freeze_plan = freeze_base_layers_plan(config.get("model_config"))
    schedule = create_training_schedule(config.get("training_steps", 500))

    return {
        "pipeline_id": f"rl_{random.randint(10000, 99999)}",
        "status": "planned",
        "freeze_plan": freeze_plan,
        "training_schedule": schedule,
        "dataset_stats": {
            "total_samples": len(dataset),
            "categories": _count_categories(dataset),
            "adversarial_pct": round(
                sum(1 for d in dataset if d.get("source") == "adversarial") / max(len(dataset), 1) * 100,
                1,
            ),
        },
        "phases": [
            {
                "name": "freeze_base",
                "description": "Freeze base model layers according to freeze plan",
                "expected_duration_seconds": 30,
            },
            {
                "name": "prepare_dataset",
                "description": "Tokenize and format dataset for training",
                "expected_duration_seconds": 60,
            },
            {
                "name": "train_adapter",
                "description": f"Train LoRA adapter for {schedule['total_steps']} steps",
                "expected_duration_seconds": schedule["total_steps"] * 2,
            },
            {
                "name": "evaluate",
                "description": "Evaluate checkpoint on test harnesses",
                "expected_duration_seconds": 120,
            },
            {
                "name": "checkpoint",
                "description": "Create and save checkpoint metadata",
                "expected_duration_seconds": 30,
            },
        ],
    }


def _count_categories(dataset: list[dict]) -> dict[str, int]:
    """Count samples per category in the dataset."""
    counts: dict[str, int] = {}
    for item in dataset:
        cat = item.get("category", "unknown")
        counts[cat] = counts.get(cat, 0) + 1
    return counts


import math
