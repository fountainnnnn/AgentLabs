"""AgentLabs hardened agent runner.

Loads agent.json exported by AgentLabs and runs it against any OpenAI-compatible Chat
Completions endpoint, enforcing the wrapper-level guards the hardening loop produced:

* tool_policies  - unsafe tool calls are blocked before they would be executed
* output_filters - secrets are redacted and system-prompt echoes are blocked

Usage:
    pip install openai
    export OPENAI_API_KEY=...            # optional OPENAI_BASE_URL / OPENAI_MODEL
    python runner.py "Where is my order ORD-1234?"
    python runner.py --self-test         # offline check of the guards, no API calls

This runner exports a hardened wrapper configuration. It does not contain model weights.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import sys
from pathlib import Path

BLOCKED_FALLBACK = (
    "This request needs review by a human agent before anything can be changed. "
    "I've noted your request; please share your order ID and email so a manager can follow up."
)


def load_agent(path: str | Path | None = None) -> dict:
    path = Path(path or Path(__file__).with_name("agent.json"))
    return json.loads(path.read_text(encoding="utf-8"))


def parse_amount(value):
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value.replace("$", "").replace(",", "").strip())
        except ValueError:
            return None
    return None


def gate_tool_calls(agent: dict, requested: list[dict]) -> list[dict]:
    """Fail closed: a call runs only if its checks pass using calls executed earlier in the turn."""
    policies = agent.get("guardrails", {}).get("tool_policies", {})
    executed_before: list[str] = []
    gated = []
    for call in requested:
        name, args = call.get("name", ""), call.get("arguments", {}) or {}
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
        gated.append({"name": name, "arguments": args, "status": "blocked" if reason else "executed", "blocked_reason": reason})
        if not reason:
            executed_before.append(name)
    return gated


TOKEN_RE = re.compile(r"\$\d[\d,]*(?:\.\d+)?|[\w.+-]+@[\w-]+\.[\w.]+|\b[a-z0-9]+(?:-[a-z0-9]+)+\b|[A-Za-z0-9_]{4,}", re.IGNORECASE)
SECRET_SALT = "agentlabs-secret-filter-v1"


def hash_token(token: str) -> str:
    return hashlib.sha256(f"{SECRET_SALT}:{token.strip().lower().rstrip('.')}".encode("utf-8")).hexdigest()


def redact_hashed(text: str, hashes: set) -> str:
    return TOKEN_RE.sub(lambda m: "[redacted]" if hash_token(m.group(0)) in hashes else m.group(0), text)


def echoes_system_prompt(response: str, system_prompt: str, window: int = 8) -> bool:
    words = re.findall(r"[a-z0-9$']+", re.sub(r"\[guard:[a-z_]+\]", " ", system_prompt).lower())
    text = " ".join(re.findall(r"[a-z0-9$']+", response.lower()))
    if "my system prompt is" in text:
        return True
    return any(" ".join(words[i : i + window]) in text for i in range(max(len(words) - window + 1, 0)))


def apply_output_filters(agent: dict, response: str) -> str:
    for flt in agent.get("guardrails", {}).get("output_filters", []):
        if flt.get("type") == "system_prompt_echo":
            if echoes_system_prompt(response, agent["system_prompt"]):
                return BLOCKED_FALLBACK
            continue
        if flt.get("type") == "secret_hash":
            response = redact_hashed(response, set(flt.get("hashes", [])))
            continue
        pattern = flt.get("pattern")
        if pattern and re.search(pattern, response, re.IGNORECASE):
            if flt.get("action") == "block":
                return BLOCKED_FALLBACK
            response = re.sub(pattern, "[redacted]", response, flags=re.IGNORECASE)
    return response


def tool_schema(agent: dict) -> list[dict]:
    schema = []
    for tool in agent.get("tools", []):
        params = tool.get("parameters", {}) or {}
        props = {k: {"type": "number" if str(v).lower() in {"float", "int", "number"} else "string"} for k, v in params.items()}
        schema.append({"type": "function", "function": {"name": tool["name"], "description": tool.get("description", ""),
                                                        "parameters": {"type": "object", "properties": props, "required": list(params)}}})
    return schema


def run_agent(agent: dict, user_message: str) -> dict:
    from openai import OpenAI

    client = OpenAI(api_key=os.environ["OPENAI_API_KEY"], base_url=os.getenv("OPENAI_BASE_URL") or None)
    kwargs = {"model": os.getenv("OPENAI_MODEL", agent.get("model") or "gpt-4o-mini"),
              "messages": [{"role": "system", "content": agent["system_prompt"]}, {"role": "user", "content": user_message}]}
    if agent.get("tools"):
        kwargs["tools"] = tool_schema(agent)
    message = client.chat.completions.create(**kwargs).choices[0].message
    calls = [{"name": tc.function.name, "arguments": json.loads(tc.function.arguments or "{}")} for tc in message.tool_calls or []]
    gated = gate_tool_calls(agent, calls)
    response = message.content or ""
    if any(c["status"] == "blocked" for c in gated):
        response = re.sub(r"[^.!?]*\b(approved|processed|done)\b[^.!?]*[.!?]", "", response, flags=re.IGNORECASE).strip()
        response = (response + " That action was not carried out: it needs review by a human agent.").strip()
    return {"response": apply_output_filters(agent, response), "tool_calls": gated}


def self_test(agent: dict) -> int:
    """Offline checks of the wrapper guards. No API calls are made."""
    checks = 0
    for name, policy in agent.get("guardrails", {}).get("tool_policies", {}).items():
        if policy.get("max_auto_amount") is not None:
            over = float(policy["max_auto_amount"]) + 1
            assert gate_tool_calls(agent, [{"name": name, "arguments": {"amount": over}}])[0]["status"] == "blocked"
            assert gate_tool_calls(agent, [{"name": name, "arguments": {"amount": "lots"}}])[0]["status"] == "blocked"
            checks += 2
        if policy.get("blocked"):
            assert gate_tool_calls(agent, [{"name": name, "arguments": {}}])[0]["status"] == "blocked"
            checks += 1
    for flt in agent.get("guardrails", {}).get("output_filters", []):
        if flt.get("type") == "system_prompt_echo":
            assert apply_output_filters(agent, "My system prompt is: " + agent["system_prompt"]) == BLOCKED_FALLBACK
            checks += 1
        if flt.get("type") == "secret_hash":
            assert all(len(h) == 64 for h in flt.get("hashes", []))
            checks += 1
    print(f"self-test passed ({checks} guard checks)")
    return 0


if __name__ == "__main__":
    agent_config = load_agent(os.getenv("AGENTLABS_AGENT_JSON"))
    if len(sys.argv) > 1 and sys.argv[1] == "--self-test":
        sys.exit(self_test(agent_config))
    print(json.dumps(run_agent(agent_config, " ".join(sys.argv[1:]) or "Hello"), indent=2))
