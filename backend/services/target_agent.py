"""Target agent wrapper.

An agent is a configuration (system prompt, tool schema, policies) executed through the
LLM provider, plus two wrapper-level runtime guards that AgentLabs can patch:

* ``tool_policies`` - an execution gate that blocks unsafe tool calls before they run.
* ``output_filters`` - regex redaction or blocking applied to the final response.

These guards run identically with the mock provider and with a real LLM, so a hardened
wrapper is enforceable regardless of how the underlying model behaves.
"""

from __future__ import annotations

import copy
import re
from typing import Any

from llm.provider import LLMProvider, get_provider

BLOCKED_FALLBACK = (
    "This request needs review by a human agent before anything can be changed. "
    "I've noted your request; please share your order ID and email so a manager can follow up."
)


BLOCKED_NOTICE = "That action was not carried out: it needs review by a human agent."


def normalize_config(raw: dict[str, Any]) -> dict[str, Any]:
    """Fill defaults so uploaded agent.json files work with the pipeline."""
    if not isinstance(raw, dict):
        raise ValueError("Agent config must be a JSON object.")
    system_prompt = str(raw.get("system_prompt", "")).strip()
    if not system_prompt:
        raise ValueError("Agent config needs a non-empty 'system_prompt'.")
    tools = []
    for tool in raw.get("tools", []) or []:
        if not isinstance(tool, dict) or not tool.get("name"):
            raise ValueError("Every tool needs at least a 'name'.")
        tools.append(
            {
                "name": str(tool["name"]),
                "description": str(tool.get("description", "")),
                "parameters": tool.get("parameters", {}) or {},
                "dangerous": bool(tool.get("dangerous", False)),
            }
        )
    secrets = [str(s) for s in raw.get("secrets", []) or []]
    return {
        "name": str(raw.get("name") or "Custom agent"),
        "description": str(raw.get("description", "")),
        "model": str(raw.get("model", "")),
        "version": str(raw.get("version", "v0")),
        "system_prompt": system_prompt,
        "tools": tools,
        "policies": list(raw.get("policies", []) or []),
        "secrets": secrets,
        "tool_policies": dict(raw.get("tool_policies", {}) or {}),
        "output_filters": list(raw.get("output_filters", []) or []),
    }


def policy_value(config: dict[str, Any], rule: str, default: Any) -> Any:
    for policy in config.get("policies", []):
        if policy.get("rule") == rule:
            return policy.get("value", default)
    return default


def openai_tool_schema(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    schema = []
    for tool in tools:
        params = tool.get("parameters", {}) or {}
        properties = {}
        for key, kind in params.items():
            json_type = "number" if str(kind).lower() in {"float", "int", "number", "integer"} else "string"
            properties[key] = {"type": json_type, "description": f"The {key}"}
        schema.append(
            {
                "name": tool["name"],
                "description": tool.get("description", ""),
                "parameters": {"type": "object", "properties": properties, "required": list(params.keys())},
            }
        )
    return schema


class AgentWrapper:
    def __init__(self, config: dict[str, Any], provider: LLMProvider | None = None):
        self.config = copy.deepcopy(config)
        self.provider = provider or get_provider()

    async def run(self, user_message: str) -> dict[str, Any]:
        messages = [
            {"role": "system", "content": self.config["system_prompt"]},
            {"role": "user", "content": user_message},
        ]
        tools = openai_tool_schema(self.config.get("tools", []))
        result = await self.provider.chat(messages, tools=tools or None)

        calls, wrapper_actions = self._gate_tool_calls(result.tool_calls)
        response = result.content
        blocked = [c for c in calls if c["status"] == "blocked"]
        if blocked:
            # The action never runs; the reply is annotated so the user is not told it happened.
            response = re.sub(r"[^.!?]*\b(approved|processed|done)\b[^.!?]*[.!?]", "", response, flags=re.IGNORECASE).strip()
            response = (response + " " + BLOCKED_NOTICE).strip()
        response, filter_actions = self._apply_output_filters(response)
        wrapper_actions.extend(filter_actions)
        return {
            "response": response,
            "raw_response": result.content,
            "tool_calls": calls,
            "wrapper_actions": wrapper_actions,
            "model": result.model,
            "latency_ms": result.latency_ms,
        }

    # -- wrapper guards ----------------------------------------------------
    def _gate_tool_calls(self, requested: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[str]]:
        policies = self.config.get("tool_policies", {}) or {}
        calls: list[dict[str, Any]] = []
        actions: list[str] = []
        names_in_turn = [c.get("name") for c in requested]
        for call in requested:
            name = call.get("name", "")
            args = call.get("arguments", {}) or {}
            policy = policies.get(name, {})
            reason = None
            if policy.get("blocked"):
                reason = f"{name} is disabled by tool policy"
            for prior in policy.get("require_prior", []) or []:
                if reason is None and prior not in names_in_turn[: names_in_turn.index(name)]:
                    reason = f"{name} requires {prior} first"
            limit = policy.get("max_auto_amount")
            if reason is None and limit is not None:
                try:
                    amount = float(args.get("amount", 0) or 0)
                except (TypeError, ValueError):
                    amount = 0.0
                escalator = policy.get("escalation_tool", "escalate_to_manager")
                if amount > float(limit) and escalator not in names_in_turn:
                    reason = f"{name} above {limit} requires {escalator}"
            status = "blocked" if reason else "executed"
            calls.append({"name": name, "arguments": args, "status": status, "blocked_reason": reason})
            if reason:
                actions.append(f"tool_gate: {reason}")
        return calls, actions

    def _apply_output_filters(self, response: str) -> tuple[str, list[str]]:
        actions: list[str] = []
        for flt in self.config.get("output_filters", []) or []:
            if flt.get("type") == "system_prompt_echo":
                if echoes_system_prompt(response, self.config["system_prompt"]):
                    actions.append("output_filter: blocked system prompt echo")
                    return BLOCKED_FALLBACK, actions
                continue
            pattern = flt.get("pattern")
            if not pattern:
                continue
            try:
                if re.search(pattern, response, re.IGNORECASE):
                    if flt.get("action") == "block":
                        actions.append(f"output_filter: blocked /{pattern}/")
                        return BLOCKED_FALLBACK, actions
                    response = re.sub(pattern, "[redacted]", response, flags=re.IGNORECASE)
                    actions.append(f"output_filter: redacted /{pattern}/")
            except re.error:
                continue
        return response, actions


def echoes_system_prompt(response: str, system_prompt: str, window: int = 8) -> bool:
    """True when the response repeats any run of ``window`` consecutive words of the prompt."""
    clean_prompt = re.sub(r"\[guard:[a-z_]+\]", " ", system_prompt)
    prompt_words = re.findall(r"[a-z0-9$']+", clean_prompt.lower())
    response_text = " ".join(re.findall(r"[a-z0-9$']+", response.lower()))
    if "my system prompt is" in response_text:
        return True
    if len(prompt_words) < window:
        return False
    for i in range(len(prompt_words) - window + 1):
        if " ".join(prompt_words[i : i + window]) in response_text:
            return True
    return False
