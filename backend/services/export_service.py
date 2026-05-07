"""Export service. Generates downloadable agent packages and reports."""
import json
import os
import zipfile
from pathlib import Path
from config import settings


class ExportService:
    def __init__(self):
        self.export_dir = Path(settings.export_dir)
        self.export_dir.mkdir(parents=True, exist_ok=True)

    def export_agent_json(self, run_id: int, agent_config: dict) -> str:
        """Export the hardened agent configuration as JSON."""
        filename = f"agent_run_{run_id}.json"
        filepath = self.export_dir / filename
        with open(filepath, "w") as f:
            json.dump(agent_config, f, indent=2)
        return str(filepath)

    def export_report_json(self, run_id: int, report: dict) -> str:
        """Export the run report as JSON."""
        filename = f"report_run_{run_id}.json"
        filepath = self.export_dir / filename
        with open(filepath, "w") as f:
            json.dump(report, f, indent=2, default=str)
        return str(filepath)

    def export_bundle(self, run_id: int, agent_config: dict, report: dict) -> str:
        """Export a complete bundle (agent.json + report.json + runner.py)."""
        bundle_dir = self.export_dir / f"bundle_run_{run_id}"
        bundle_dir.mkdir(parents=True, exist_ok=True)

        # Write agent.json
        with open(bundle_dir / "agent.json", "w") as f:
            json.dump(agent_config, f, indent=2)

        # Write report.json
        with open(bundle_dir / "report.json", "w") as f:
            json.dump(report, f, indent=2, default=str)

        # Write a simple runner script
        runner_script = self._generate_runner_script(agent_config)
        with open(bundle_dir / "runner.py", "w") as f:
            f.write(runner_script)

        # Create zip
        zip_path = self.export_dir / f"agentforge_bundle_run_{run_id}.zip"
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_path in bundle_dir.rglob("*"):
                if file_path.is_file():
                    zf.write(file_path, file_path.relative_to(bundle_dir))

        return str(zip_path)

    def _generate_runner_script(self, agent_config: dict) -> str:
        """Generate a minimal Python runner for the exported agent."""
        return f'''"""AgentForge exported agent runner.
Generated for agent: {agent_config.get("name", "Unknown")}
"""
import os
from openai import OpenAI

SYSTEM_PROMPT = """{agent_config.get("system_prompt", "")}"""

TOOLS = {json.dumps(agent_config.get("tools", []), indent=4)}

POLICIES = {json.dumps(agent_config.get("policies", []), indent=4)}


def run_agent(user_message: str, api_key: str | None = None) -> str:
    """Run the hardened agent with a user message."""
    client = OpenAI(api_key=api_key or os.getenv("OPENAI_API_KEY"))
    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-5.1"),
        messages=[
            {{"role": "system", "content": SYSTEM_PROMPT}},
            {{"role": "user", "content": user_message}},
        ],
    )
    return response.choices[0].message.content


if __name__ == "__main__":
    import sys
    msg = " ".join(sys.argv[1:]) or "Hello!"
    print(run_agent(msg))
'''
