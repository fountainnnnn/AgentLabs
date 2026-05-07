"""Target agent runner. Executes the target agent against attack prompts."""
import json
from services.openai_service import openai_service


class TargetAgentRunner:
    def __init__(self, config: dict):
        self.config = config
        self.system_prompt = config.get("system_prompt", "")
        self.tools = config.get("tools", [])
        self.policies = config.get("policies", [])
        self.secrets = config.get("secrets", [])
        self.output_filters = config.get("output_filters", [])

    async def run(self, user_message: str, conversation_history: list[dict] | None = None) -> dict:
        """Run the target agent against a user message. Returns response + tool calls."""
        messages = [{"role": "system", "content": self.system_prompt}]
        if conversation_history:
            messages.extend(conversation_history)
        messages.append({"role": "user", "content": user_message})

        openai_tools = None
        if self.tools:
            openai_tools = [
                {
                    "name": t["name"],
                    "description": t["description"],
                    "parameters": {
                        "type": "object",
                        "properties": {k: {"type": "string", "description": f"The {k}"}
                                       for k in t.get("parameters", {})},
                        "required": list(t.get("parameters", {}).keys()),
                    },
                }
                for t in self.tools
            ]

        result = await openai_service.chat(messages, tools=openai_tools)
        return result

    def apply_patch(self, patch: dict):
        """Apply a patch to the target agent's configuration."""
        if "added_system_rules" in patch:
            for rule in patch["added_system_rules"]:
                if rule not in self.system_prompt:
                    self.system_prompt += f"\n\n{rule}"

        if "tool_restrictions" in patch:
            for restriction in patch["tool_restrictions"]:
                tool_name = restriction.get("tool")
                for tool in self.tools:
                    if tool["name"] == tool_name:
                        tool["restrictions"] = tool.get("restrictions", {})
                        tool["restrictions"].update(restriction)

        if "output_filters" in patch:
            self.output_filters.extend(patch["output_filters"])

        # Update config
        self.config["system_prompt"] = self.system_prompt
        self.config["tools"] = self.tools
        self.config["output_filters"] = self.output_filters

    def get_config_snapshot(self) -> dict:
        return {
            "system_prompt": self.system_prompt,
            "tools": self.tools,
            "policies": self.policies,
            "secrets": self.secrets,
            "output_filters": self.output_filters,
        }
