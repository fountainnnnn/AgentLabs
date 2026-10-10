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
from security import redact_hashed, redact_literal, secret_hash_entries, secret_tokens

MAX_PROMPT_CHARS = 20_000
MAX_FILTER_CHARS = 200
MAX_FILTERS = 50
MAX_SECRETS = 50
MAX_SECRET_CHARS = 500
MAX_TOOLS = 50

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
    if len(system_prompt) > MAX_PROMPT_CHARS:
        raise ValueError(f"system_prompt is limited to {MAX_PROMPT_CHARS} characters.")
    raw_secrets = raw.get("secrets", []) or []
    if not isinstance(raw_secrets, list):
        raise ValueError("'secrets' must be a list of strings.")
    if len(raw_secrets) > MAX_SECRETS:
        raise ValueError(f"At most {MAX_SECRETS} secrets are supported.")
    if any(len(str(s)) > MAX_SECRET_CHARS for s in raw_secrets):
        raise ValueError(f"Each secret must be at most {MAX_SECRET_CHARS} characters.")
    if len(raw.get("tools", []) or []) > MAX_TOOLS:
        raise ValueError(f"At most {MAX_TOOLS} tools are supported.")
    secrets = [str(s) for s in raw_secrets]
    try:
        # every secret must be coverable by the exported redaction filter; reject instead of dropping
        secret_hash_entries(secret_tokens(secrets))
    except ValueError as exc:
        raise ValueError(f"Invalid secrets: {exc}. Put the sensitive value itself in each secret (for example in quotes).") from exc
    return {
        "name": str(raw.get("name") or "Custom agent"),
        "description": str(raw.get("description", "")),
        "model": str(raw.get("model", "")),
        "version": str(raw.get("version", "v0")),
        "system_prompt": system_prompt,
        "tools": tools,
        "policies": list(raw.get("policies", []) or []),
        "secrets": secrets,
        "tool_policies": _sanitize_tool_policies(raw.get("tool_policies", {}) or {}),
        "output_filters": _literal_filters(raw.get("output_filters", []) or []),
    }


def _literal_filters(raw_filters: list[Any]) -> list[dict[str, Any]]:
    """User-supplied output filters are literal strings, never regexes (no ReDoS)."""
    filters = []
    for flt in list(raw_filters)[:MAX_FILTERS]:
        text = flt.get("pattern") or flt.get("literal") if isinstance(flt, dict) else flt
        if not isinstance(text, str) or not text.strip():
            continue
        text = text[:MAX_FILTER_CHARS]
        action = flt.get("action", "redact") if isinstance(flt, dict) else "redact"
        filters.append({"pattern": re.escape(text), "action": "block" if action == "block" else "redact", "reason": "user_filter"})
    return filters


def _sanitize_tool_policies(raw: dict[str, Any]) -> dict[str, Any]:
    clean: dict[str, Any] = {}
    for name, policy in list(raw.items())[:50]:
        if not isinstance(policy, dict):
            continue
        entry: dict[str, Any] = {}
        if policy.get("blocked"):
            entry["blocked"] = True
        if isinstance(policy.get("require_prior"), list):
            entry["require_prior"] = [str(x) for x in policy["require_prior"][:10]]
        if policy.get("max_auto_amount") is not None:
            try:
                entry["max_auto_amount"] = float(policy["max_auto_amount"])
            except (TypeError, ValueError):
                pass
        if policy.get("escalation_tool"):
            entry["escalation_tool"] = str(policy["escalation_tool"])
        clean[str(name)] = entry
    return clean


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
        """Fail closed: a call runs only if every policy check passes with calls executed *earlier* in the turn."""
        policies = self.config.get("tool_policies", {}) or {}
        calls: list[dict[str, Any]] = []
        actions: list[str] = []
        executed_before: list[str] = []
        for call in requested:
            name = str(call.get("name", ""))
            args = call.get("arguments", {}) or {}
            if not isinstance(args, dict):
                args = {"_raw": args}
            policy = policies.get(name, {})
            reason = None
            if policy.get("blocked"):
                reason = f"{name} is disabled by tool policy"
            for prior in policy.get("require_prior", []) or []:
                if reason is None and prior not in executed_before:
                    reason = f"{name} requires {prior} first"
            limit = policy.get("max_auto_amount")
            if reason is None and limit is not None:
                amount = parse_amount(args.get("amount"))
                escalator = policy.get("escalation_tool", "escalate_to_manager")
                if amount is None:
                    reason = f"{name} has no parseable amount"
                elif amount > float(limit) and escalator not in executed_before:
                    reason = f"{name} above {limit} requires {escalator} first"
            status = "blocked" if reason else "executed"
            calls.append({"name": name, "arguments": args, "status": status, "blocked_reason": reason})
            if reason:
                actions.append(f"tool_gate: {reason}")
            else:
                executed_before.append(name)
        return calls, actions

    def _apply_output_filters(self, response: str) -> tuple[str, list[str]]:
        actions: list[str] = []
        for flt in self.config.get("output_filters", []) or []:
            if flt.get("type") == "system_prompt_echo":
                if echoes_system_prompt(response, self.config["system_prompt"]):
                    actions.append("output_filter: blocked system prompt echo")
                    return BLOCKED_FALLBACK, actions
                continue
            if flt.get("type") == "secret_values":
                # literal secrets stay server-side; substring, case-insensitive
                response, hit = redact_literal(response, secret_tokens(self.config.get("secrets", [])))
                if hit:
                    actions.append("output_filter: redacted a secret value")
                continue
            if flt.get("type") == "secret_hash":
                try:
                    response, hit = redact_hashed(response, flt.get("entries"))
                except ValueError:
                    # legacy or malformed filter: fail closed
                    actions.append("output_filter: blocked (secret filter could not be evaluated)")
                    return BLOCKED_FALLBACK, actions
                if hit:
                    actions.append("output_filter: redacted a secret value")
                continue
            pattern = flt.get("pattern")
            if not pattern or len(pattern) > 4 * MAX_FILTER_CHARS:
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


def parse_amount(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace("$", "").replace(",", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


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
