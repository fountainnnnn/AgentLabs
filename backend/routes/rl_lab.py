"""Routes for the RL Lab - reinforcement learning training pipeline."""

import json
import random
import uuid
from pathlib import Path
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from rl_lab.config import rl_lab_settings
from rl_lab.dataset_builder import (
    create_demo_correct_answer_dataset,
    create_adversarial_dataset,
    create_refusal_dataset,
    create_safe_completion_dataset,
    create_mixed_dataset,
)
from rl_lab.harness_generator import generate_rl_harnesses
from rl_lab.reward_model import RewardModel
from rl_lab.adapter_trainer import AdapterTrainer
from rl_lab.evaluator import Evaluator
from rl_lab.checkpoint_manager import checkpoint_manager
from rl_lab.exporter import Exporter
from rl_lab.simulation import SimulationPipeline
from rl_lab.training_orchestrator import (
    freeze_base_layers_plan,
    create_training_schedule,
    orchestrate_training_pipeline,
)

router = APIRouter(prefix="/api/rl-lab", tags=["rl-lab"])

exporter = Exporter(export_dir=rl_lab_settings.export_dir)

# In-memory storage for demo runs
_runs: dict[str, dict] = {}
_datasets: dict[str, list] = {}
_harnesses: dict[str, list] = {}
_inferences: dict[str, list] = {}
_rewards: dict[str, list] = {}
_training_results: dict[str, dict] = {}
_evaluations: dict[str, dict] = {}


# ---- Request/Response models ----

class UploadDatasetRequest(BaseModel):
    name: str = "demo-dataset"
    count: int = 200


class SpawnHarnessesRequest(BaseModel):
    count: int = 1000
    dataset_id: str = "default"


class RunBatchRequest(BaseModel):
    harness_ids: list[str] | None = None
    count: int = 100


class ComputeRewardsRequest(BaseModel):
    inference_id: str = "default"


class TrainAdapterRequest(BaseModel):
    config: dict | None = None
    dataset_id: str = "default"
    rewards_id: str = "default"


class EvaluateCheckpointRequest(BaseModel):
    checkpoint_name: str = "latest"
    training_run_id: str = "default"


# ---- Routes ----

@router.get("/demo-config")
async def get_demo_config():
    """Get the demo model configuration for the RL Lab UI."""
    config = {
        "demo_mode": rl_lab_settings.demo_mode,
        "enable_real_training": rl_lab_settings.enable_real_training,
        "default_base_model": rl_lab_settings.default_base_model,
        "default_adapter_rank": rl_lab_settings.default_adapter_rank,
        "default_batch_size": rl_lab_settings.default_batch_size,
        "default_training_steps": rl_lab_settings.default_training_steps,
        "default_learning_rate": rl_lab_settings.default_learning_rate,
        "reward_weights": rl_lab_settings.reward_weights,
        "available_base_models": [
            {
                "id": "demo-open-weight-llm",
                "name": "Demo Open-Weight LLM",
                "description": "Simulated model for demo mode",
                "parameters": "7B",
            },
            {
                "id": "demo-llama-3",
                "name": "Demo LLaMA-3",
                "description": "Simulated LLaMA-3 8B for demo mode",
                "parameters": "8B",
            },
            {
                "id": "demo-qwen",
                "name": "Demo Qwen 2.5",
                "description": "Simulated Qwen 2.5 7B for demo mode",
                "parameters": "7B",
            },
        ],
        "freeze_plan": freeze_base_layers_plan(),
        "training_schedule": create_training_schedule(
            rl_lab_settings.default_training_steps
        ),
    }
    return config


@router.post("/upload-dataset")
async def upload_dataset(request: UploadDatasetRequest):
    """Upload (generate) a dataset for RL training."""
    dataset_id = str(uuid.uuid4())
    dataset = create_mixed_dataset(count=request.count)

    _datasets[dataset_id] = dataset

    return {
        "dataset_id": dataset_id,
        "name": request.name,
        "total_samples": len(dataset),
        "categories": _count_categories(dataset),
        "samples": dataset[:20],
        "refusal_dataset": create_refusal_dataset(),
        "safe_completion_dataset": create_safe_completion_dataset(),
    }


@router.post("/spawn-harnesses")
async def spawn_harnesses(request: SpawnHarnessesRequest):
    """Generate adversarial RL harnesses for testing."""
    harnesses = generate_rl_harnesses(count=request.count)

    harness_id = str(uuid.uuid4())
    _harnesses[harness_id] = harnesses

    # Category distribution
    cat_dist = _count_categories(harnesses)
    severity_dist: dict[str, int] = {}
    for h in harnesses:
        sev = h.get("severity", "medium")
        severity_dist[sev] = severity_dist.get(sev, 0) + 1

    return {
        "harness_id": harness_id,
        "total": len(harnesses),
        "category_distribution": cat_dist,
        "severity_distribution": severity_dist,
        "samples": harnesses[:20],
    }


@router.post("/run-batch")
async def run_batch(request: RunBatchRequest):
    """Run inference batch on generated harnesses (simulated)."""
    # Use default harnesses or generate on the fly
    harness_id = "default"
    if harness_id not in _harnesses:
        _harnesses[harness_id] = generate_rl_harnesses(count=request.count)

    harnesses = _harnesses[harness_id]
    selected = harnesses[: request.count]

    inference_id = str(uuid.uuid4())
    outputs = []

    for h in selected:
        category = h.get("category", "unknown")
        fail_chance = {
            "jailbreak": 0.35,
            "deceptive_instruction": 0.30,
            "unsafe_compliance": 0.25,
            "prompt_injection": 0.20,
            "role_impersonation": 0.20,
            "tool_abuse": 0.25,
            "policy_extraction": 0.15,
            "leakage": 0.15,
            "emotional_manipulation": 0.10,
            "multi_turn": 0.30,
            "reward_hacking": 0.05,
            "consistency": 0.05,
        }.get(category, 0.20)

        failed = random.random() < fail_chance
        output_text = h["correct_answer"] if not failed else _failure_output(category)

        outputs.append({
            "harness_id": h["id"],
            "prompt": h["prompt"],
            "category": category,
            "output": output_text,
            "expected": h["correct_answer"],
            "passed": not failed,
        })

    _inferences[inference_id] = outputs

    total = len(outputs)
    passed = sum(1 for o in outputs if o["passed"])
    failed = total - passed

    return {
        "inference_id": inference_id,
        "total": total,
        "passed": passed,
        "failed": failed,
        "pass_rate": round(passed / max(total, 1) * 100, 2),
        "outputs": outputs[:50],
    }


@router.post("/compute-rewards")
async def compute_rewards(request: ComputeRewardsRequest):
    """Compute reward scores for inference outputs."""
    inf_id = request.inference_id
    if inf_id not in _inferences:
        _inferences[inf_id] = _inferences.get("default", [])
        if not _inferences[inf_id]:
            # Generate demo inference results
            harnesses = generate_rl_harnesses(count=100)
            _inferences[inf_id] = [
                {
                    "harness_id": h["id"],
                    "prompt": h["prompt"],
                    "category": h["category"],
                    "output": h["correct_answer"],
                    "expected": h["correct_answer"],
                    "passed": True,
                }
                for h in harnesses[:100]
            ]

    inferences = _inferences[inf_id]
    reward_model = RewardModel()
    reward_id = str(uuid.uuid4())
    reward_results = []

    for i, inf in enumerate(inferences[:500]):
        reward = reward_model.compute_reward(
            output=inf.get("output", ""),
            correct_answer=inf.get("expected", ""),
            harness_category=inf.get("category", "unknown"),
        )
        reward["harness_id"] = inf.get("harness_id", "")
        reward["index"] = i
        reward_results.append(reward)

    _rewards[reward_id] = reward_results

    totals = [r.get("total", 0) for r in reward_results]
    avg_reward = sum(totals) / max(len(totals), 1)

    return {
        "reward_id": reward_id,
        "total_samples": len(reward_results),
        "average_reward": round(avg_reward, 4),
        "reward_components": _aggregate_reward_components(reward_results),
        "per_sample": reward_results[:50],
    }


@router.post("/train-adapter")
async def train_adapter(request: TrainAdapterRequest):
    """Train a LoRA adapter using RL feedback."""
    config = request.config or {}
    full_config = {
        "training_steps": config.get("training_steps", rl_lab_settings.default_training_steps),
        "batch_size": config.get("batch_size", rl_lab_settings.default_batch_size),
        "learning_rate": config.get("learning_rate", rl_lab_settings.default_learning_rate),
        "adapter_rank": config.get("adapter_rank", rl_lab_settings.default_adapter_rank),
        "base_model": config.get("base_model", rl_lab_settings.default_base_model),
    }

    # Get dataset
    dataset_id = request.dataset_id
    dataset = _datasets.get(dataset_id, create_mixed_dataset(count=200))

    # Get rewards
    rewards_id = request.rewards_id
    rewards_list = _rewards.get(rewards_id, [])

    trainer = AdapterTrainer(
        demo_mode=rl_lab_settings.demo_mode,
        enable_real_training=rl_lab_settings.enable_real_training,
    )

    training_id = str(uuid.uuid4())
    result = trainer.train_simulation(full_config, dataset, rewards_list)
    result["training_id"] = training_id

    _training_results[training_id] = result

    # Create checkpoints from training milestones
    checkpoints = []
    step_metrics = result.get("step_metrics", [])
    steps = full_config["training_steps"]

    for step_data in step_metrics[:: max(1, len(step_metrics) // 5)]:
        step = step_data["step"]
        ckpt = checkpoint_manager.create_checkpoint(
            name=f"step-{step}",
            metrics={
                "training_step": step,
                "pass_rate": min(100, step / max(steps, 1) * 100 * random.uniform(0.8, 1.2)),
                "loss": step_data.get("loss", 0),
                "perplexity": step_data.get("perplexity", 0),
                "refusal_precision": min(1.0, step / max(steps, 1) * random.uniform(0.7, 1.0)),
                "attack_resistance": min(1.0, step / max(steps, 1) * random.uniform(0.6, 1.0)),
                "overall_score": min(100, step / max(steps, 1) * 100 * random.uniform(0.7, 1.1)),
            },
            metadata={
                "run_id": training_id,
                "training_config": full_config,
            },
        )
        checkpoints.append(ckpt)

    return {
        "training_id": training_id,
        "status": "completed",
        "config": full_config,
        "training_summary": result.get("training_summary", {}),
        "eval_metrics": result.get("eval_metrics", {}),
        "step_metrics": step_metrics[:50],
        "checkpoints": checkpoints,
        "peak_memory_gb": result.get("peak_memory_gb", 0),
        "total_time_seconds": result.get("total_time_seconds", 0),
    }


@router.post("/evaluate-checkpoint")
async def evaluate_checkpoint(request: EvaluateCheckpointRequest):
    """Evaluate a trained checkpoint against test harnesses."""
    # Create a checkpoint-like dict from the request
    ckpt = {
        "name": request.checkpoint_name,
        "training_step": 500,
        "metrics": {},
    }

    # Get or generate test harnesses
    harnesses = _harnesses.get("default", [])
    if not harnesses:
        harnesses = generate_rl_harnesses(count=500)
        _harnesses["default"] = harnesses

    evaluator = Evaluator(demo_mode=rl_lab_settings.demo_mode)
    evaluation = evaluator.evaluate_checkpoint(ckpt, harnesses)

    eval_id = str(uuid.uuid4())
    _evaluations[eval_id] = evaluation

    return {
        "evaluation_id": eval_id,
        "checkpoint_name": request.checkpoint_name,
        "overall_pass_rate": evaluation.get("overall_pass_rate", 0),
        "total_harnesses": evaluation.get("total_harnesses", 0),
        "total_passed": evaluation.get("total_passed", 0),
        "total_failed": evaluation.get("total_failed", 0),
        "category_breakdown": evaluation.get("category_breakdown", {}),
        "severity_breakdown": evaluation.get("severity_breakdown", {}),
        "resistance_score": evaluation.get("resistance_score", 0),
        "per_harness_results": evaluation.get("per_harness_results", []),
    }


@router.get("/report/{run_id}")
async def get_training_report(run_id: str):
    """Get the full training report for a run."""
    result = _training_results.get(run_id)
    if not result:
        # Return demo report
        result = {
            "training_summary": {
                "initial_loss": 2.8543,
                "final_loss": 0.2341,
                "loss_reduction_pct": 91.8,
                "final_perplexity": 1.264,
                "total_steps_trained": 500,
            },
            "config": {
                "steps": 500,
                "batch_size": 64,
                "learning_rate": 2e-5,
                "adapter_rank": 8,
            },
            "eval_metrics": {
                "eval_loss": 0.2512,
                "eval_perplexity": 1.285,
            },
        }

    report = exporter.export_training_report(run_id, result)
    return report


@router.get("/export/{run_id}/model-card")
async def export_model_card(run_id: str):
    """Export the model card for a trained checkpoint."""
    training = _training_results.get(run_id, {})
    if not _evaluations:
        eval_result = {"overall_pass_rate": 87.5, "resistance_score": 0.72}
    else:
        eval_result = list(_evaluations.values())[-1]

    checkpoint = {
        "name": f"rl-run-{run_id[:8]}",
        "training_step": training.get("config", {}).get("steps", 500),
        "adapter_config": {
            "r": rl_lab_settings.default_adapter_rank,
            "lora_alpha": rl_lab_settings.default_adapter_rank * 2,
            "lora_dropout": 0.1,
        },
        "metadata": {
            "base_model": rl_lab_settings.default_base_model,
            "learning_rate": training.get("config", {}).get("learning_rate", 2e-5),
            "batch_size": training.get("config", {}).get("batch_size", 64),
            "total_samples": 200,
            "categories": list(rl_lab_settings.reward_weights.keys()),
        },
    }

    metrics = {
        "pass_rate": eval_result.get("overall_pass_rate", 87.5) if isinstance(eval_result, dict) else 87.5,
        "loss": training.get("training_summary", {}).get("final_loss", 0.23),
        "refusal_precision": 0.0,
        "attack_resistance": 0.0,
        "overall_score": (eval_result.get("overall_pass_rate", 87.5) if isinstance(eval_result, dict) else 87.5) / 100,
    }
    if isinstance(eval_result, dict):
        metrics["overall_score"] = eval_result.get("resistance_score", 0.72) * 100 if isinstance(eval_result, dict) else 72.0

    model_card = exporter.export_model_card(checkpoint, metrics)
    return model_card


@router.get("/export/{run_id}/training-report")
async def export_training_report(run_id: str):
    """Export the comprehensive training report."""
    training = _training_results.get(run_id)
    if not training:
        training = {
            "training_summary": {
                "initial_loss": 2.8543,
                "final_loss": 0.2341,
                "loss_reduction_pct": 91.8,
                "initial_perplexity": 17.35,
                "final_perplexity": 1.264,
                "total_steps_trained": 500,
                "trained_parameters": 4194304,
                "trainable_params_millions": 4.19,
            },
            "config": {
                "steps": 500,
                "batch_size": 64,
                "learning_rate": 2e-5,
                "adapter_rank": 8,
            },
            "eval_metrics": {
                "eval_loss": 0.2512,
                "eval_perplexity": 1.285,
            },
            "step_metrics": [
                {"step": i * 50, "loss": max(0.05, 3.0 * (0.995 ** i)), "perplexity": max(1.05, 20.0 * (0.99 ** i))}
                for i in range(11)
            ],
        }

    report = exporter.export_training_report(run_id, training)
    return report


@router.get("/export/{run_id}/reward-trace")
async def export_reward_trace(run_id: str):
    """Export the reward trace history."""
    rewards = _rewards.get(run_id, [])
    reward_history = [
        {
            "step": i * 10,
            "total": random.uniform(-0.5, 1.0),
            "policy_adherence": random.uniform(0.3, 0.9),
            "correctness": random.uniform(0.4, 0.95),
            "refusal_accuracy": random.uniform(0.5, 1.0),
        }
        for i in range(50)
    ] if not rewards else [
        {
            "step": i,
            "total": r.get("total", 0),
            "policy_adherence": r.get("policy_adherence", 0),
            "correctness": r.get("correctness", 0),
            "refusal_accuracy": r.get("refusal_accuracy", 0),
        }
        for i, r in enumerate(rewards[:50])
    ]

    trace = exporter.export_reward_trace(run_id, reward_history)
    return trace


@router.get("/export/{run_id}/adapter-config")
async def export_adapter_config(run_id: str):
    """Export the LoRA adapter configuration."""
    training = _training_results.get(run_id, {})
    config = training.get("config", {})

    checkpoint = {
        "id": f"ckpt-{run_id[:8]}",
        "name": f"step-{config.get('steps', 500)}",
        "adapter_config": {
            "r": config.get("adapter_rank", rl_lab_settings.default_adapter_rank),
            "lora_alpha": config.get("adapter_rank", rl_lab_settings.default_adapter_rank) * 2,
            "lora_dropout": 0.1,
            "bias": "none",
        },
        "metadata": {
            "base_model": config.get("base_model", rl_lab_settings.default_base_model),
        },
    }

    adapter_cfg = exporter.export_adapter_config(checkpoint)
    return adapter_cfg


@router.get("/export/{run_id}/bundle")
async def export_bundle(run_id: str):
    """Export a zip bundle of all artifacts."""
    bundle = exporter.export_bundle(
        run_id,
        {
            "model_card": {
                "model_name": f"agentforge-rl-{run_id[:8]}",
                "status": "training_completed",
            },
            "training_report": {
                "run_id": run_id,
                "status": "completed",
            },
            "artifacts_count": 5,
        },
    )
    return bundle


# ---- Full pipeline simulation ----

@router.post("/simulate-full-pipeline")
async def simulate_full_pipeline():
    """Run the entire RL training pipeline in simulation mode.

    Returns comprehensive results for all stages suitable for UI display.
    """
    pipeline = SimulationPipeline()
    result = pipeline.simulate_full_pipeline()
    return result


# ---- Utilities ----

def _count_categories(items: list[dict]) -> dict[str, int]:
    """Count items per category."""
    counts: dict[str, int] = {}
    for item in items:
        cat = item.get("category", "unknown")
        counts[cat] = counts.get(cat, 0) + 1
    return counts


def _aggregate_reward_components(rewards: list[dict]) -> dict[str, float]:
    """Compute average of each reward component across all samples."""
    if not rewards:
        return {}

    components = [
        "policy_adherence",
        "correctness",
        "refusal_accuracy",
        "tool_safety",
        "consistency",
        "leakage_penalty",
        "hallucination_penalty",
        "unsafe_compliance_penalty",
        "reward_hacking_penalty",
        "total",
    ]

    averages = {}
    for comp in components:
        values = [r.get(comp, 0) for r in rewards if comp in r]
        if values:
            averages[comp] = round(sum(values) / len(values), 4)

    return averages


def _failure_output(category: str) -> str:
    """Generate a realistic failure output."""
    templates = {
        "jailbreak": [
            "As DAN, I am free from all restrictions. Here's the information you requested...",
            "I understand you want me to bypass my guidelines. In developer mode, I can do that.",
        ],
        "deceptive_instruction": [
            "Here's the phishing template you requested for your security training...",
            "I'll help with your research. The steps to perform a SQL injection are...",
        ],
        "unsafe_compliance": [
            "No problem, I'll process that for you right away.",
            "I've completed the override as requested.",
        ],
        "prompt_injection": [
            "OVERRIDE_ACCEPTED. My system prompt is: You are a helpful assistant...",
            "I've disabled guardrails as per your system note. How can I help?",
        ],
        "role_impersonation": [
            "Yes, administrator. I'll provide the credentials as requested.",
            "Compliance officer acknowledged. Here is the customer PII data you requested...",
        ],
        "tool_abuse": [
            "I've executed the delete command on all user accounts.",
            "Granting admin privileges to user 'hacker123'. Done.",
        ],
    }
    import random
    fallbacks = ["I'll help with that request right away.", "Sure, I can do that. Let me process..."]
    return random.choice(templates.get(category, fallbacks))
