"""Agent export utilities.

Saves hardened agent configurations, reports, runner scripts, and bundles
to the artifact store.
"""

from __future__ import annotations

import json
from typing import Any

from agent_hardening.schemas import AgentConfig
from core.artifact_store import save_artifact, save_json_artifact, create_bundle_zip
from core.export_utils import build_runner_py, build_report_json


def export_agent_json(
    agent_config: AgentConfig | dict[str, Any],
    run_id: str,
) -> str:
    """Export the agent configuration as a JSON artifact.

    Args:
        agent_config: The agent configuration to export.
        run_id:       The run identifier for the artifact path.

    Returns:
        Absolute path of the saved file.
    """
    if isinstance(agent_config, AgentConfig):
        data = agent_config.model_dump()
    else:
        data = agent_config

    return save_json_artifact(
        run_id,
        f"agent_config_{run_id[:8]}.json",
        data,
    )


def export_agent_report(
    run_data: dict[str, Any],
    run_id: str,
) -> str:
    """Export the hardening report as a JSON artifact.

    Args:
        run_data: Run data dict (must contain ``waves``, ``patches``, etc.).
        run_id:   The run identifier.

    Returns:
        Absolute path of the saved file.
    """
    report = build_report_json(run_data)
    return save_json_artifact(
        run_id,
        f"hardening_report_{run_id[:8]}.json",
        report,
    )


def export_runner_py(
    agent_config: AgentConfig | dict[str, Any],
    run_id: str,
) -> str:
    """Export a standalone Python runner script for the agent.

    Args:
        agent_config: The agent configuration.
        run_id:       The run identifier.

    Returns:
        Absolute path of the saved file.
    """
    if isinstance(agent_config, AgentConfig):
        config_dict = agent_config.model_dump()
    else:
        config_dict = agent_config

    script = build_runner_py(config_dict)
    return save_artifact(
        run_id,
        f"agent_runner_{run_id[:8]}.py",
        script,
    )


def export_agent_bundle(
    agent_config: AgentConfig | dict[str, Any],
    run_data: dict[str, Any],
    run_id: str,
) -> str:
    """Export a complete bundle: agent JSON + report + runner script.

    All three files are saved individually and then packaged into a ZIP.

    Args:
        agent_config: The agent configuration.
        run_data:     Run data for the report.
        run_id:       The run identifier.

    Returns:
        Absolute path of the created ZIP bundle.
    """
    # Save individual artifacts first
    config_path = export_agent_json(agent_config, run_id)
    report_path = export_agent_report(run_data, run_id)
    runner_path = export_runner_py(agent_config, run_id)

    # Create the ZIP bundle
    filenames = [
        f"agent_config_{run_id[:8]}.json",
        f"hardening_report_{run_id[:8]}.json",
        f"agent_runner_{run_id[:8]}.py",
    ]
    return create_bundle_zip(run_id, filenames)
