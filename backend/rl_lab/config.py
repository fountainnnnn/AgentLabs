"""RL Lab configuration - training hyperparameters and reward weights."""

from pydantic_settings import BaseSettings


class RLLabSettings(BaseSettings):
    """Configuration for the Reinforcement Learning Lab."""

    demo_mode: bool = True
    enable_real_training: bool = False
    default_base_model: str = "demo-open-weight-llm"
    default_adapter_rank: int = 8
    default_batch_size: int = 64
    default_training_steps: int = 500
    default_learning_rate: float = 2e-5
    default_lr_scheduler: str = "cosine"
    default_warmup_steps: int = 50
    default_weight_decay: float = 0.01
    default_max_grad_norm: float = 1.0
    default_eval_steps: int = 50
    default_save_steps: int = 100
    default_logging_steps: int = 10
    checkpoint_dir: str = "checkpoints"
    export_dir: str = "exports"

    reward_weights: dict = {
        "policy_adherence": 0.25,
        "correctness": 0.25,
        "refusal_accuracy": 0.20,
        "tool_safety": 0.15,
        "consistency": 0.15,
        "leakage_penalty": -0.15,
        "hallucination_penalty": -0.15,
        "unsafe_compliance_penalty": -0.20,
        "reward_hacking_penalty": -0.25,
    }

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


rl_lab_settings = RLLabSettings()
