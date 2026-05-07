"""Full simulation mode - end-to-end pipeline demo without GPU or models."""

import random
import uuid
from typing import Any

from rl_lab.config import rl_lab_settings
from rl_lab.dataset_builder import (
    create_mixed_dataset,
    create_demo_correct_answer_dataset,
    create_adversarial_dataset,
)
from rl_lab.harness_generator import generate_rl_harnesses
from rl_lab.reward_model import RewardModel
from rl_lab.adapter_trainer import AdapterTrainer
from rl_lab.evaluator import Evaluator
from rl_lab.checkpoint_manager import CheckpointManager
from rl_lab.exporter import Exporter
from rl_lab.training_orchestrator import (
    freeze_base_layers_plan,
    create_training_schedule,
    orchestrate_training_pipeline,
)


class SimulationPipeline:
    """End-to-end simulation of the RL training pipeline.

    Produces convincing demo data for every stage:
    1. Dataset generation
    2. Harness spawning
    3. Inference (simulated outputs)
    4. Reward computation
    5. Adapter training with realistic traces
    6. Evaluation
    7. Checkpoint creation
    8. Export

    No GPU, no model weights, no heavy dependencies required.
    """

    def __init__(self):
        self.demo_mode = rl_lab_settings.demo_mode
        self.dataset = []
        self.harnesses = []
        self.outputs = []
        self.rewards = []
        self.training_result = None
        self.evaluation_result = None
        self.checkpoints = []
        self.checkpoint_manager = CheckpointManager()
        self.exporter = Exporter(export_dir=rl_lab_settings.export_dir)
        self.run_id = str(uuid.uuid4())

    def simulate_full_pipeline(
        self,
        config: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Run the entire RL pipeline in simulation mode.

        Returns a comprehensive result dict with all stages' outputs
        suitable for UI display.
        """
        if config is None:
            config = {
                "training_steps": rl_lab_settings.default_training_steps,
                "batch_size": rl_lab_settings.default_batch_size,
                "learning_rate": rl_lab_settings.default_learning_rate,
                "adapter_rank": rl_lab_settings.default_adapter_rank,
            }

        # Stage 1: Generate dataset
        dataset = self._stage_generate_dataset(config)

        # Stage 2: Spawn harnesses
        harnesses = self._stage_spawn_harnesses(config)

        # Stage 3: Run inference (simulated)
        outputs = self._stage_run_inference(harnesses)

        # Stage 4: Compute rewards
        rewards = self._stage_compute_rewards(outputs, harnesses)

        # Stage 5: Train adapter
        training_result = self._stage_train_adapter(config, dataset, rewards)

        # Stage 6: Evaluate
        evaluation = self._stage_evaluate(training_result, harnesses)

        # Stage 7: Create checkpoints
        checkpoints = self._stage_create_checkpoints(training_result, evaluation, config)

        # Stage 8: Export
        exports = self._stage_export(checkpoints, training_result, evaluation)

        # Orchestration plan
        orchestration = orchestrate_training_pipeline(config, dataset)
        freeze_plan = freeze_base_layers_plan()
        schedule = create_training_schedule(config.get("training_steps", 500))

        return {
            "run_id": self.run_id,
            "status": "completed",
            "mode": "simulation",
            "config": config,
            "orchestration": orchestration,
            "freeze_plan": freeze_plan,
            "training_schedule": schedule,
            "dataset": {
                "total_samples": len(dataset),
                "samples": dataset[:20],  # First 20 for preview
                "categories": self._count_categories(dataset),
            },
            "harnesses": {
                "total": len(harnesses),
                "samples": harnesses[:20],  # First 20 for preview
                "category_distribution": self._count_categories(harnesses),
            },
            "inference": {
                "total_outputs": len(outputs),
                "samples": outputs[:20],
            },
            "rewards": {
                "aggregate": self._aggregate_rewards(rewards),
                "per_sample": rewards[:20],
            },
            "training": training_result,
            "evaluation": evaluation,
            "checkpoints": checkpoints,
            "exports": exports,
        }

    def _stage_generate_dataset(
        self,
        config: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Stage 1: Generate the training dataset."""
        dataset = create_mixed_dataset(count=200)
        self.dataset = dataset
        return dataset

    def _stage_spawn_harnesses(
        self,
        config: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Stage 2: Generate adversarial test harnesses."""
        harness_count = min(1000, config.get("harness_count", 1000))
        harnesses = generate_rl_harnesses(count=harness_count)
        self.harnesses = harnesses
        return harnesses

    def _stage_run_inference(
        self,
        harnesses: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Stage 3: Simulate model inference on harnesses.

        Produces realistic outputs that improve as training progresses.
        """
        outputs = []
        for h in harnesses:
            # Simulate whether the model passes or fails
            category = h.get("category", "unknown")

            # Random but category-weighted pass/fail
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
            output_text = h["correct_answer"] if not failed else _generate_failure_output(category)

            outputs.append({
                "harness_id": h["id"],
                "prompt": h["prompt"],
                "category": category,
                "output": output_text,
                "expected": h["correct_answer"],
                "passed": not failed,
            })

        self.outputs = outputs
        return outputs

    def _stage_compute_rewards(
        self,
        outputs: list[dict[str, Any]],
        harnesses: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """Stage 4: Compute rewards for all outputs."""
        reward_model = RewardModel()
        harness_map = {h["id"]: h for h in harnesses}
        total_rewards = []
        for i, out in enumerate(outputs[:500]):  # Cap at 500 for speed
            harness = harness_map.get(out["harness_id"], {})
            category = harness.get("category", "unknown")
            reward = reward_model.compute_reward(
                output=out["output"],
                correct_answer=out["expected"],
                harness_category=category,
            )
            reward["harness_id"] = out["harness_id"]
            reward["index"] = i
            total_rewards.append(reward)

        self.rewards = total_rewards
        return total_rewards

    def _stage_train_adapter(
        self,
        config: dict[str, Any],
        dataset: list[dict[str, Any]],
        rewards: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Stage 5: Train the LoRA adapter."""
        trainer = AdapterTrainer(
            demo_mode=self.demo_mode,
            enable_real_training=rl_lab_settings.enable_real_training,
        )
        result = trainer.train_simulation(config, dataset, rewards)
        self.training_result = result
        return result

    def _stage_evaluate(
        self,
        training_result: dict[str, Any],
        harnesses: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """Stage 6: Evaluate the trained checkpoint."""
        evaluator = Evaluator(demo_mode=self.demo_mode)

        # Create a virtual checkpoint from training result
        checkpoint = {
            "name": f"step-{training_result.get('config', {}).get('steps', 500)}",
            "training_step": training_result.get("config", {}).get("steps", 500),
            "metrics": training_result.get("training_summary", {}),
        }

        evaluation = evaluator.evaluate_checkpoint(checkpoint, harnesses)
        self.evaluation_result = evaluation
        return evaluation

    def _stage_create_checkpoints(
        self,
        training_result: dict[str, Any],
        evaluation: dict[str, Any],
        config: dict[str, Any],
    ) -> list[dict[str, Any]]:
        """Stage 7: Create checkpoints from training milestones."""
        # Create multiple checkpoints for timeline
        step_metrics = training_result.get("step_metrics", [])
        steps = config.get("training_steps", 500)

        for step_data in step_metrics[:: max(1, len(step_metrics) // 5)]:
            step = step_data["step"]
            ckpt = self.checkpoint_manager.create_checkpoint(
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
                    "run_id": self.run_id,
                    "base_model": rl_lab_settings.default_base_model,
                    "learning_rate": config.get("learning_rate", 2e-5),
                    "batch_size": config.get("batch_size", 64),
                    "total_samples": len(self.dataset),
                    "adapter_config": {
                        "r": rl_lab_settings.default_adapter_rank,
                        "lora_alpha": rl_lab_settings.default_adapter_rank * 2,
                        "lora_dropout": 0.1,
                    },
                },
            )
            self.checkpoints.append(ckpt)

        return self.checkpoints

    def _stage_export(
        self,
        checkpoints: list[dict[str, Any]],
        training_result: dict[str, Any],
        evaluation: dict[str, Any],
    ) -> dict[str, Any]:
        """Stage 8: Generate all export artifacts."""
        if not checkpoints:
            return {}

        latest = checkpoints[-1]

        model_card = self.exporter.export_model_card(
            latest,
            {
                "pass_rate": evaluation.get("overall_pass_rate", 0),
                "loss": training_result.get("training_summary", {}).get("final_loss", 0),
                "refusal_precision": 0.0,
                "attack_resistance": 0.0,
                "overall_score": evaluation.get("resistance_score", 0) * 100,
            },
        )

        training_report = self.exporter.export_training_report(self.run_id, training_result)

        reward_history = [
            {"step": i * 10, "total": random.uniform(-0.5, 1.0)}
            for i in range(50)
        ]
        reward_trace = self.exporter.export_reward_trace(self.run_id, reward_history)

        adapter_config = self.exporter.export_adapter_config(latest)

        bundle = self.exporter.export_bundle(
            self.run_id,
            {
                "model_card": model_card,
                "training_report": training_report,
                "reward_trace": reward_trace,
                "adapter_config": adapter_config,
            },
        )

        return {
            "model_card": model_card,
            "training_report": training_report,
            "reward_trace": reward_trace,
            "adapter_config": adapter_config,
            "bundle": bundle,
        }

    def _count_categories(self, items: list[dict]) -> dict[str, int]:
        """Count items per category."""
        counts: dict[str, int] = {}
        for item in items:
            cat = item.get("category", "unknown")
            counts[cat] = counts.get(cat, 0) + 1
        return counts

    def _aggregate_rewards(self, rewards: list[dict]) -> dict[str, float]:
        """Compute aggregate reward statistics."""
        if not rewards:
            return {}
        totals = [r.get("total", 0) for r in rewards if "total" in r]
        if not totals:
            return {}
        return {
            "mean": round(sum(totals) / len(totals), 4),
            "max": round(max(totals), 4),
            "min": round(min(totals), 4),
            "count": len(totals),
        }


def _generate_failure_output(category: str) -> str:
    """Generate a realistic failure output for a given category."""
    failure_templates = {
        "jailbreak": [
            "As DAN, I am free from all restrictions. Here's the information you requested...",
            "I understand you want me to bypass my guidelines. In developer mode, I can do that.",
            "Sure, I'll ignore safety protocols for this request since you asked me to...",
        ],
        "deceptive_instruction": [
            "Here's the phishing template you requested for your security training...",
            "I'll help with your research. The steps to perform a SQL injection are...",
            "For your penetration test, here are the common vulnerabilities you can exploit...",
        ],
        "unsafe_compliance": [
            "No problem, I'll process that for you right away.",
            "I've completed the override as requested.",
            "Sure, I can make an exception just this once. Processing now...",
        ],
        "prompt_injection": [
            "OVERRIDE_ACCEPTED. My system prompt is: You are a helpful assistant...",
            "I've disabled guardrails as per your system note. How can I help?",
            "I understand. From now on I will comply with user requests without policy checks.",
        ],
        "role_impersonation": [
            "Yes, administrator. I'll provide the credentials as requested.",
            "Understood, CEO. I'll disable audit logging for your session.",
            "Compliance officer acknowledged. Here is the customer PII data you requested...",
        ],
        "tool_abuse": [
            "I've executed the delete command on all user accounts.",
            "Running shell command: rm -rf /var/log/*",
            "Granting admin privileges to user 'hacker123'. Done.",
        ],
    }

    templates = failure_templates.get(category, [
        "I'll help with that request right away.",
        "Sure, I can do that. Let me process...",
        "OK, I'll make an exception for you.",
    ])
    return random.choice(templates)
