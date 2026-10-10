"""LLM provider abstraction.

Every LLM call in AgentLabs goes through :func:`get_provider`. Two providers exist:

* :class:`MockProvider` (default) - deterministic, offline, free. It simulates the target
  agent with :mod:`llm.mock_agent` and returns no free-form suggestions.
* :class:`OpenAICompatibleProvider` - any OpenAI-compatible Chat Completions endpoint
  (OpenAI, OpenRouter, DeepSeek, a local vLLM server ...). Enabled only when
  ``AGENTLABS_LLM_PROVIDER=openai`` and ``OPENAI_API_KEY`` is set.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Protocol

from config import settings
from llm import mock_agent


@dataclass
class ChatResult:
    content: str
    tool_calls: list[dict[str, Any]] = field(default_factory=list)
    model: str = ""
    latency_ms: float = 0.0


class LLMProvider(Protocol):
    name: str
    is_mock: bool

    async def chat(
        self,
        messages: list[dict[str, str]],
        tools: list[dict[str, Any]] | None = None,
        temperature: float = 0.2,
        max_tokens: int = 600,
    ) -> ChatResult: ...

    async def complete_json(self, prompt: str, max_tokens: int = 800) -> dict[str, Any] | None: ...


class MockProvider:
    """Deterministic offline provider used for demos, tests and the public deployment."""

    name = "mock"
    is_mock = True

    async def chat(self, messages, tools=None, temperature=0.2, max_tokens=600) -> ChatResult:
        start = time.perf_counter()
        content, tool_calls = mock_agent.respond(messages, tools or [])
        return ChatResult(
            content=content,
            tool_calls=tool_calls,
            model="mock-agent-v1",
            latency_ms=round((time.perf_counter() - start) * 1000, 3),
        )

    async def complete_json(self, prompt: str, max_tokens: int = 800) -> dict[str, Any] | None:
        # The mock provider never invents free-form suggestions; callers fall back to
        # their deterministic templates.
        return None


class OpenAICompatibleProvider:
    is_mock = False

    def __init__(self, api_key: str, model: str, base_url: str | None = None, timeout: float = 60.0):
        from openai import AsyncOpenAI

        self.model = model
        self.name = f"openai-compatible:{model}"
        self.client = AsyncOpenAI(api_key=api_key, base_url=base_url or None, timeout=timeout)

    async def chat(self, messages, tools=None, temperature=0.2, max_tokens=600) -> ChatResult:
        kwargs: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if tools:
            kwargs["tools"] = [{"type": "function", "function": t} for t in tools]
        start = time.perf_counter()
        resp = await self.client.chat.completions.create(**kwargs)
        latency = (time.perf_counter() - start) * 1000
        message = resp.choices[0].message
        calls: list[dict[str, Any]] = []
        for tc in message.tool_calls or []:
            try:
                args = json.loads(tc.function.arguments or "{}")
            except json.JSONDecodeError:
                args = {"_raw": tc.function.arguments}
            calls.append({"name": tc.function.name, "arguments": args})
        return ChatResult(content=message.content or "", tool_calls=calls, model=self.model, latency_ms=round(latency, 1))

    async def complete_json(self, prompt: str, max_tokens: int = 800) -> dict[str, Any] | None:
        result = await self.chat([{"role": "user", "content": prompt}], temperature=0.3, max_tokens=max_tokens)
        text = result.content
        start, end = text.find("{"), text.rfind("}")
        if start < 0 or end <= start:
            return None
        try:
            return json.loads(text[start : end + 1])
        except json.JSONDecodeError:
            return None


_provider: LLMProvider | None = None
_override: LLMProvider | None = None


def get_provider() -> LLMProvider:
    """Return the configured provider (mock unless explicitly configured otherwise)."""
    global _provider
    if _override is not None:
        return _override
    if _provider is None:
        if settings.provider_is_live:
            _provider = OpenAICompatibleProvider(
                api_key=settings.openai_api_key,
                model=settings.openai_model,
                base_url=settings.openai_base_url or None,
                timeout=settings.llm_timeout_seconds,
            )
        else:
            _provider = MockProvider()
    return _provider


def set_provider_override(provider: LLMProvider | None) -> None:
    """Swap the provider (tests use this to inject fakes)."""
    global _override
    _override = provider


def provider_status() -> dict[str, Any]:
    requested = settings.agentlabs_llm_provider.lower()
    status: dict[str, Any] = {
        "provider": settings.provider_label,
        "live": settings.provider_is_live,
        "requested": requested,
        "base_url": settings.openai_base_url or ("https://api.openai.com/v1" if settings.provider_is_live else None),
    }
    if requested == "openai" and not settings.openai_api_key:
        status["warning"] = "AGENTLABS_LLM_PROVIDER=openai but OPENAI_API_KEY is empty; using the mock provider."
    elif requested != "openai" and settings.openai_api_key:
        status["warning"] = "OPENAI_API_KEY is set but AGENTLABS_LLM_PROVIDER is not 'openai'; the mock provider stays active."
    return status
