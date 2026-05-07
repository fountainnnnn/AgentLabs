"""ID generation utilities for runs, harnesses, waves, and checkpoints."""

import uuid


def run_id() -> str:
    """Generate a unique run identifier."""
    return f"run-{uuid.uuid4().hex[:12]}"


def harness_id() -> str:
    """Generate a unique harness identifier."""
    return f"harn-{uuid.uuid4().hex[:8]}"


def wave_id() -> str:
    """Generate a unique wave identifier."""
    return f"wave-{uuid.uuid4().hex[:8]}"


def gen_id() -> str:
    """Generate a unique generation identifier."""
    return f"gen-{uuid.uuid4().hex[:8]}"


def checkpoint_id() -> str:
    """Generate a unique checkpoint identifier."""
    return f"ckpt-{uuid.uuid4().hex[:8]}"


def job_id() -> str:
    """Generate a unique job identifier."""
    return f"job-{uuid.uuid4().hex[:8]}"
