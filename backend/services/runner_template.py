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


SECRET_SALT = "agentlabs-secret-filter-v1"
MAX_HASH_ENTRIES, MAX_SECRET_LEN, MAX_DISTINCT_LENGTHS, MAX_SCAN_CHARS = 64, 128, 16, 20_000


def lower_same_length(text: str) -> str:
    return "".join(c.lower() if len(c.lower()) == 1 else c for c in text)


def redact_hashed(text: str, entries) -> str | None:
    """Bounded salted-hash substring redaction. Returns None (fail closed) on invalid input."""
    if not isinstance(entries, list) or not entries or len(entries) > MAX_HASH_ENTRIES or len(text) > MAX_SCAN_CHARS:
        return None
    by_len: dict = {}
    for e in entries:
        if not isinstance(e, dict) or not isinstance(e.get("len"), int) or not 0 < e["len"] <= MAX_SECRET_LEN:
            return None
        by_len.setdefault(e["len"], set()).add(e.get("sha256"))
    if len(by_len) > MAX_DISTINCT_LENGTHS:
        return None
    lowered = lower_same_length(text)
    spans = []
    for length, hashes in by_len.items():
        for start in range(0, len(lowered) - length + 1):
            if hashlib.sha256(f"{SECRET_SALT}:{lowered[start:start + length]}".encode("utf-8")).hexdigest() in hashes:
                spans.append((start, start + length))
    out, last = [], 0
    for a, b in sorted(spans):
        if a < last:
            last = max(last, b)
            continue
        out.append(text[last:a])
        out.append("[redacted]")
        last = b
    out.append(text[last:])
    return "".join(out)


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
            redacted = redact_hashed(response, flt.get("entries"))
            if redacted is None:
                return BLOCKED_FALLBACK  # legacy or malformed filter: fail closed
            response = redacted
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
            assert flt.get("entries") and all(len(e["sha256"]) == 64 for e in flt["entries"])
            checks += 1
    print(f"self-test passed ({checks} guard checks)")
    return 0


if __name__ == "__main__":
    agent_config = load_agent(os.getenv("AGENTLABS_AGENT_JSON"))
    if len(sys.argv) > 1 and sys.argv[1] == "--self-test":
        sys.exit(self_test(agent_config))
    print(json.dumps(run_agent(agent_config, " ".join(sys.argv[1:]) or "Hello"), indent=2))
