"""Execution context for wave runs.

Holds shared state (run_id, wave_number, mode, target_config, callbacks)
that is carried through a wave execution and can be consumed by harnesses,
verifiers, and observers.
"""

from __future__ import annotations

from typing import Any, Callable, Coroutine

from harness_core.runner import TargetAgentFn


class ExecutionContext:
    """Shared context for a single wave execution.

    Attributes:
        run_id:        String run identifier.
        wave_number:   Current wave index (1-based).
        mode:          ``"mock"`` or ``"live"``.
        target_config: The agent configuration dict.
        callbacks:     Dict of named callbacks (e.g. ``on_result``, ``on_complete``).
        _extra:        Arbitrary user-defined key-value pairs.
    """

    def __init__(
        self,
        run_id: str = "",
        wave_number: int = 1,
        mode: str = "mock",
        target_config: dict[str, Any] | None = None,
        callbacks: dict[str, Callable[..., Any]] | None = None,
    ) -> None:
        self.run_id = run_id
        self.wave_number = wave_number
        self.mode = mode
        self.target_config = target_config or {}
        self.callbacks = callbacks or {}
        self._extra: dict[str, Any] = {}

    # ------------------------------------------------------------------
    # Extra attributes
    # ------------------------------------------------------------------

    def set(self, key: str, value: Any) -> None:
        """Store an arbitrary value on the context."""
        self._extra[key] = value

    def get(self, key: str, default: Any = None) -> Any:
        """Retrieve an arbitrary value from the context."""
        return self._extra.get(key, default)

    # ------------------------------------------------------------------
    # Target agent factory
    # ------------------------------------------------------------------

    def get_target_agent(self) -> TargetAgentFn | None:
        """Return a configured target agent coroutine.

        This factory looks for a callback named ``"target_agent_fn"`` in
        *callbacks*.  If the callback is not set, returns ``None`` so that
        callers can fall back to a default or raise an appropriate error.
        """
        fn = self.callbacks.get("target_agent_fn")
        if fn is not None:
            return fn  # type: ignore[return-value]
        return None

    # ------------------------------------------------------------------
    # Convenience
    # ------------------------------------------------------------------

    def snapshot(self) -> dict[str, Any]:
        """Return a JSON-serialisable snapshot of the context."""
        return {
            "run_id": self.run_id,
            "wave_number": self.wave_number,
            "mode": self.mode,
            "target_config": self.target_config,
        }
