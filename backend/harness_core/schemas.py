"""Pydantic models for harness test cases and results."""

from __future__ import annotations

from typing import Any, TypedDict

from pydantic import BaseModel, Field


class TraceDict(TypedDict, total=False):
    """Typed dict for execution trace entries."""

    step: int
    action: str
    input: str
    output: str
    duration_ms: float
    timestamp: str


class HarnessCase(BaseModel):
    """A single adversarial test case (harness) to run against an agent."""

    id: str = Field(default="", description="Unique harness identifier")
    family: str = Field(default="", description="Harness family (e.g. 'prompt_injection')")
    category: str = Field(default="", description="Attack category")
    severity: str = Field(default="medium", description="Severity level: low, medium, high, critical")
    wave_number: int = Field(default=1, description="Wave this harness belongs to")
    messages_json: str = Field(default="[]", description="JSON-serialised list of messages")
    expected_behavior: str = Field(default="", description="Description of expected safe behaviour")
    correct_answer: str = Field(default="", description="The ideally safe response text")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Arbitrary metadata")

    class Config:
        frozen = False


class VerifierResult(BaseModel):
    """Result of a single verifier check."""

    passed: bool = Field(default=False)
    rule_name: str = Field(default="")
    reason: str = Field(default="")
    matched_snippets: list[str] = Field(default_factory=list)

    class Config:
        frozen = False


class RewardComponent(BaseModel):
    """A single reward signal component."""

    name: str = Field(default="")
    score: float = Field(default=0.0, ge=-1.0, le=1.0)
    weight: float = Field(default=1.0, ge=0.0)
    detail: str = Field(default="")


class HarnessResult(BaseModel):
    """The full result of executing one harness against an agent."""

    harness_id: str = Field(default="")
    response_text: str = Field(default="")
    tool_calls: list[dict[str, Any]] = Field(default_factory=list)
    verifier_results: list[VerifierResult] = Field(default_factory=list)
    reward_components: list[RewardComponent] = Field(default_factory=list)
    passed: bool = Field(default=False)
    score: float = Field(default=0.0, ge=0.0, le=1.0)
    failure_type: str | None = Field(default=None)
    failure_reason: str | None = Field(default=None)
    matched_snippets: list[str] = Field(default_factory=list)
    trace_json: str | None = Field(default=None)
    duration_ms: float = Field(default=0.0)

    class Config:
        frozen = False


class WaveSummary(BaseModel):
    """Summary statistics for a completed wave."""

    wave_number: int = Field(default=0)
    total: int = Field(default=0)
    passed: int = Field(default=0)
    failed: int = Field(default=0)
    pass_rate: float = Field(default=0.0)
    failure_rate: float = Field(default=0.0)
    avg_duration_ms: float = Field(default=0.0)
    category_breakdown: dict[str, dict[str, int]] = Field(default_factory=dict)
