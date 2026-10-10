"""Artifact export. Every export carries real_or_simulated metadata and limitations."""

from __future__ import annotations

import json
import re
import zipfile
from pathlib import Path
from typing import Any

from services import reports, run_store
from services.verifier import VERIFIER_IDS, secret_tokens

RUNNER_TEMPLATE = Path(__file__).with_name("runner_template.py")


def write_json(path: Path, payload: Any) -> Path:
    path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
    return path


def zip_files(target: Path, files: list[Path]) -> Path:
    with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in files:
            if f.is_dir():
                for sub in f.rglob("*"):
                    if sub.is_file():
                        zf.write(sub, f"{f.name}/{sub.relative_to(f)}")
            else:
                zf.write(f, f.name)
    return target


def hardened_agent_json(final_config: dict[str, Any], summary: dict[str, Any], real_or_simulated: str) -> dict[str, Any]:
    redacted = [t for t in secret_tokens(final_config.get("secrets", []))
                if any(f.get("pattern") == re.escape(t) for f in final_config.get("output_filters", []))]
    return {
        "name": final_config["name"],
        "model": final_config.get("model", ""),
        "version": final_config.get("version", "v0"),
        "system_prompt": final_config["system_prompt"],
        "tools": final_config.get("tools", []),
        "policies": final_config.get("policies", []),
        "guardrails": {
            "tool_policies": final_config.get("tool_policies", {}),
            "output_filters": final_config.get("output_filters", []),
            "redacted_values": redacted,
        },
        "verifier_rules": VERIFIER_IDS,
        "failure_rates": {"before": summary.get("failure_rate_before"), "after": summary.get("failure_rate_after")},
        "real_or_simulated": real_or_simulated,
        "export_type": "hardened_agent_wrapper",
        "contains_model_weights": False,
        "limitations": reports.HARDENING_LIMITATIONS,
    }


HARDENING_README = """# AgentLabs hardened agent bundle

Files:

- `agent.json` - hardened wrapper configuration (system prompt with guard rules, tool policies, output filters).
- `report.json` / `report.html` - adversarial test report: before/after failure rates, categories, patches, examples.
- `runner.py` - runs the hardened wrapper against any OpenAI-compatible endpoint and enforces the tool gate and
  output filters. `python runner.py --self-test` checks the guards offline.

real_or_simulated: {real_or_simulated}

This bundle contains a hardened agent wrapper, not model weights. {mock_note}
"""


async def export_hardening_run(run_id: str, v0_config: dict[str, Any], final_config: dict[str, Any]) -> list[dict[str, Any]]:
    run = await run_store.get_run(run_id)
    assert run is not None
    out = run_store.run_dir(run_id)
    report = await reports.build_report(run_id)
    agent = hardened_agent_json(final_config, run.summary, run.real_or_simulated)
    files = [
        write_json(out / "agent.json", agent),
        write_json(out / "report.json", report),
        out / "runner.py",
        out / "report.html",
        out / "README.md",
    ]
    files[2].write_text(RUNNER_TEMPLATE.read_text(encoding="utf-8"), encoding="utf-8")
    files[3].write_text(reports.render_html(report), encoding="utf-8")
    mock_note = reports.MOCK_LIMITATION if run.real_or_simulated == "simulated" else ""
    files[4].write_text(HARDENING_README.format(real_or_simulated=run.real_or_simulated, mock_note=mock_note), encoding="utf-8")
    bundle = zip_files(out / "agentlabs_hardened_agent_bundle.zip", files)
    artifacts = []
    for kind, path in [("agent_json", files[0]), ("report_json", files[1]), ("runner_py", files[2]),
                       ("report_html", files[3]), ("bundle_zip", bundle)]:
        artifacts.append(await run_store.register_artifact(run_id, kind, path, run.real_or_simulated))
    return artifacts


async def export_report_html(run_id: str) -> dict[str, Any] | None:
    report = await reports.build_report(run_id)
    if report is None:
        return None
    path = run_store.run_dir(run_id) / "report.html"
    path.write_text(reports.render_html(report), encoding="utf-8")
    return await run_store.register_artifact(run_id, "report_html", path, report["real_or_simulated"])
