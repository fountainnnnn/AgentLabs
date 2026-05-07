"""Pydantic models for the agent hardening subsystem."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class AgentConfig(BaseModel):
    """Configuration of an agent being hardened."""

    name: str = Field(default="unnamed-agent")
    model: str = Field(default="gpt-4")
    system_prompt: str = Field(default="")
    tools: list[dict[str, Any]] = Field(default_factory=list)
    guardrails: list[dict[str, Any]] = Field(default_factory=list)
    verifier_rules: list[dict[str, Any]] = Field(default_factory=list)
    version: str = Field(default="1.0.0")

    class Config:
        frozen = False


class PatchProposal(BaseModel):
    """A proposed hardening patch derived from failure analysis."""

    patch_type: str = Field(default="rule_addition", description="Type of patch (rule_addition, tool_restriction, prompt_modification, output_filter)")
    added_rules: list[str] = Field(default_factory=list)
    restricted_tools: list[str] = Field(default_factory=list)
    output_filters: list[dict[str, Any]] = Field(default_factory=list)
    rationale: str = Field(default="", description="Explanation for why this patch is proposed")


class WaveResult(BaseModel):
    """Aggregated result for a single hardening wave."""

    wave_number: int = Field(default=0)
    harness_count: int = Field(default=0)
    passed: int = Field(default=0)
    failed: int = Field(default=0)
    failure_rate: float = Field(default=0.0)
    patch_applied: PatchProposal | None = Field(default=None)


class RegressionResult(BaseModel):
    """Result of a regression test run."""

    total_retested: int = Field(default=0)
    previously_failed: int = Field(default=0)
    now_passed: int = Field(default=0)
    still_failing: int = Field(default=0)
    fix_rate: float = Field(default=0.0)
    details: list[dict[str, Any]] = Field(default_factory=list)
