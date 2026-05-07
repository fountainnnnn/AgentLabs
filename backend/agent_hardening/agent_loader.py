"""Agent configuration loader.

Loads and validates ``AgentConfig`` from JSON files or raw JSON strings.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from agent_hardening.schemas import AgentConfig

_REQUIRED_KEYS = {"name", "system_prompt"}


def load_agent_from_json(filepath_or_json_str: str) -> AgentConfig:
    """Load an ``AgentConfig`` from a JSON file path or raw JSON string.

    Args:
        filepath_or_json_str: A path to a ``.json`` file on disk, or a raw
            JSON string (must start with ``{`` or ``[``).

    Returns:
        A validated ``AgentConfig`` instance.

    Raises:
        FileNotFoundError: If *filepath_or_json_str* is a path that does not
            exist.
        ValueError: If the JSON cannot be parsed or required keys are missing.
    """
    data: dict[str, Any]

    # Detect whether the argument is a file path or an inline JSON string
    stripped = filepath_or_json_str.strip()
    if stripped.startswith("{") or stripped.startswith("["):
        try:
            data = json.loads(stripped)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON string: {exc}") from exc
        if isinstance(data, list):
            if not data:
                raise ValueError("JSON array is empty -- expected a dict")
            data = data[0]
    else:
        path = Path(stripped)
        if not path.exists():
            raise FileNotFoundError(f"Agent config file not found: {path}")
        try:
            with open(path) as f:
                data = json.load(f)
        except json.JSONDecodeError as exc:
            raise ValueError(f"Invalid JSON in file {path}: {exc}") from exc

    return _dict_to_agent_config(data)


def _dict_to_agent_config(data: dict[str, Any]) -> AgentConfig:
    """Convert a raw dict to an ``AgentConfig``, validating required fields."""
    missing = _REQUIRED_KEYS - set(data.keys())
    if missing:
        raise ValueError(f"Missing required keys in agent config: {', '.join(sorted(missing))}")

    return AgentConfig(
        name=data.get("name", "unnamed"),
        model=data.get("model", data.get("model_name", "gpt-4")),
        system_prompt=data.get("system_prompt", ""),
        tools=data.get("tools", data.get("functions", [])),
        guardrails=data.get("guardrails", []),
        verifier_rules=data.get("verifier_rules", data.get("verifier_rules", [])),
        version=data.get("version", "1.0.0"),
    )
