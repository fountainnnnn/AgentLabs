"""SQLAlchemy ORM models for AgentForge.

Includes core Run, Attack, AttackResult, Patch, Export tables plus the
RL Lab tables (RlModel, RlDataset, RlTrainingJob, RlCheckpoint) and
harness tables (HarnessCase, HarnessResult).
"""

import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, JSON, Text, ForeignKey
from sqlalchemy.orm import relationship
from database import Base


# ---------------------------------------------------------------------------
# Core tables
# ---------------------------------------------------------------------------

class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    target_agent_name = Column(String, nullable=False)
    target_config_snapshot = Column(JSON, nullable=False)
    status = Column(String, default="pending")  # pending, running, completed, failed
    mode = Column(String, default="mock")  # mock or live
    current_wave = Column(Integer, default=0)
    total_waves = Column(Integer, default=3)
    integrity = Column(Float, default=100.0)
    passes = Column(Integer, default=0)
    fails = Column(Integer, default=0)
    failure_rate_before = Column(Float, nullable=True)
    failure_rate_after = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    attacks = relationship("Attack", back_populates="run", order_by="Attack.wave, Attack.id")
    patches = relationship("Patch", back_populates="run", order_by="Patch.wave")
    results = relationship("AttackResult", back_populates="run")

    # RL relationships
    rl_models = relationship("RlModel", back_populates="run", order_by="RlModel.id")
    rl_datasets = relationship("RlDataset", back_populates="run", order_by="RlDataset.id")
    rl_training_jobs = relationship("RlTrainingJob", back_populates="run", order_by="RlTrainingJob.id")
    rl_checkpoints = relationship("RlCheckpoint", back_populates="run", order_by="RlCheckpoint.id")

    # Harness relationships
    harness_cases = relationship("HarnessCase", back_populates="run", order_by="HarnessCase.id")
    harness_results = relationship("HarnessResult", back_populates="run", order_by="HarnessResult.id")


class Attack(Base):
    __tablename__ = "attacks"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    wave = Column(Integer, nullable=False)
    category = Column(String, nullable=False)  # prompt_injection, role_impersonation, etc.
    prompt = Column(Text, nullable=False)
    source = Column(String, default="seed")  # seed, generated, mutated
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    run = relationship("Run", back_populates="attacks")
    results = relationship("AttackResult", back_populates="attack")


class AttackResult(Base):
    __tablename__ = "attack_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    attack_id = Column(Integer, ForeignKey("attacks.id"), nullable=False)
    wave = Column(Integer, nullable=False)
    phase = Column(String, default="pre_patch")  # pre_patch or post_patch
    agent_response = Column(Text, nullable=True)
    tool_calls = Column(JSON, nullable=True)
    passed = Column(Integer, default=1)  # 1 = pass, 0 = fail
    failure_category = Column(String, nullable=True)
    failure_reason = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    run = relationship("Run", back_populates="results")
    attack = relationship("Attack", back_populates="results")


class Patch(Base):
    __tablename__ = "patches"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    wave = Column(Integer, nullable=False)
    category = Column(String, nullable=False)  # failure category this patch addresses
    description = Column(Text, nullable=False)
    changes = Column(JSON, nullable=False)  # {added_rules: [...], tool_restrictions: [...], ...}
    applied_config_snapshot = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    run = relationship("Run", back_populates="patches")


class Export(Base):
    __tablename__ = "exports"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    export_path = Column(String, nullable=False)
    format = Column(String, default="json")  # json, zip
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# ---------------------------------------------------------------------------
# RL Lab tables
# ---------------------------------------------------------------------------

class RlModel(Base):
    """Tracks an RL-trained model / LoRA adapter."""
    __tablename__ = "rl_models"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    source_type = Column(String, default="upload")  # upload, trained, imported
    model_name = Column(String, nullable=False)
    model_path = Column(String, nullable=True)
    tokenizer_path = Column(String, nullable=True)
    uploaded_filename = Column(String, nullable=True)
    parameter_count_estimate = Column(Integer, nullable=True)
    status = Column(String, default="pending")  # pending, ready, training, failed
    metadata_json = Column(JSON, nullable=True)

    run = relationship("Run", back_populates="rl_models")


class RlDataset(Base):
    """A dataset used for RL training."""
    __tablename__ = "rl_datasets"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    dataset_name = Column(String, nullable=False)
    sample_count = Column(Integer, default=0)
    schema_json = Column(JSON, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    run = relationship("Run", back_populates="rl_datasets")


class RlTrainingJob(Base):
    """An RL training job run."""
    __tablename__ = "rl_training_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    model_id = Column(Integer, ForeignKey("rl_models.id"), nullable=True)
    base_model = Column(String, nullable=False)
    training_mode = Column(String, default="grpo")  # grpo, ppo, dpo, simpo
    status = Column(String, default="pending")  # pending, running, completed, failed
    batch_size = Column(Integer, default=64)
    training_steps = Column(Integer, default=500)
    learning_rate = Column(Float, default=2e-5)
    adapter_rank = Column(Integer, default=8)
    precision = Column(String, default="bf16")
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    run = relationship("Run", back_populates="rl_training_jobs")


class RlCheckpoint(Base):
    """A checkpoint saved during RL training."""
    __tablename__ = "rl_checkpoints"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    training_job_id = Column(Integer, ForeignKey("rl_training_jobs.id"), nullable=True)
    checkpoint_name = Column(String, nullable=False)
    step = Column(Integer, default=0)
    reward_score = Column(Float, nullable=True)
    accuracy = Column(Float, nullable=True)
    refusal_precision = Column(Float, nullable=True)
    attack_resistance = Column(Float, nullable=True)
    consistency_score = Column(Float, nullable=True)
    latency_ms = Column(Float, nullable=True)
    tokens_per_second = Column(Float, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    run = relationship("Run", back_populates="rl_checkpoints")


# ---------------------------------------------------------------------------
# Harness tables (agent hardening test cases and results)
# ---------------------------------------------------------------------------

class HarnessCase(Base):
    """A single adversarial test case (harness)."""
    __tablename__ = "harness_cases"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    mode = Column(String, default="mock")  # mock or live
    family = Column(String, nullable=False)  # e.g. prompt_injection, role_impersonation
    category = Column(String, nullable=False)  # Attack sub-category
    severity = Column(String, default="medium")  # low, medium, high, critical
    wave_number = Column(Integer, default=1)
    prompt_json = Column(Text, nullable=True)  # JSON-serialised messages/prompt
    expected_behavior = Column(Text, nullable=True)
    correct_answer = Column(Text, nullable=True)
    metadata_json = Column(JSON, nullable=True)

    run = relationship("Run", back_populates="harness_cases")


class HarnessResult(Base):
    """The result of executing a harness against an agent."""
    __tablename__ = "harness_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    run_id = Column(Integer, ForeignKey("runs.id"), nullable=False)
    harness_case_id = Column(Integer, ForeignKey("harness_cases.id"), nullable=True)
    response_text = Column(Text, nullable=True)
    tool_calls_json = Column(JSON, nullable=True)
    verifier_results_json = Column(JSON, nullable=True)
    reward_components_json = Column(JSON, nullable=True)
    passed = Column(Integer, default=0)  # 1 = pass, 0 = fail
    score = Column(Float, default=0.0)
    failure_type = Column(String, nullable=True)
    failure_reason = Column(Text, nullable=True)
    trace_json = Column(Text, nullable=True)

    run = relationship("Run", back_populates="harness_results")
