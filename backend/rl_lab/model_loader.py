"""Model loader - load real models from local path, upload, or HuggingFace with simulation fallback."""

from __future__ import annotations

import math
import time
from typing import Any

from rl_lab.schemas import RLModelConfig


class ModelLoader:
    """Loads and manages a model for RL training / inference.

    Supports four source types:

    * ``demo``       -- Always succeeds, runs in simulation mode.
    * ``local_path`` -- Attempts to load from a local directory using
                        ``transformers``.
    * ``uploaded``   -- Same as ``local_path`` but looks under
                        ``artifacts/models/<model_path>/``.
    * ``huggingface``-- Loads from the HuggingFace Hub via model name.

    If the model cannot be loaded (missing deps, bad path, etc.) all
    ``run_inference`` calls fall back to deterministic simulation.
    """

    def __init__(self, config: RLModelConfig) -> None:
        self.config = config
        self.model: Any = None
        self.tokenizer: Any = None
        self.is_loaded = False
        self.load_error: str | None = None

    # ------------------------------------------------------------------
    # Load API
    # ------------------------------------------------------------------

    def load(self) -> tuple[bool, str | None]:
        """Attempt to load the model according to ``source_type``.

        Returns:
            (success, error_message).  ``error_message`` is ``None`` on success.
        """
        loader = {
            "demo": self._load_demo,
            "local_path": self._load_local_path,
            "uploaded": self._load_uploaded,
            "huggingface": self._load_huggingface,
        }
        fn = loader.get(self.config.source_type)
        if fn is None:
            err = f"Unknown source_type '{self.config.source_type}'"
            self.load_error = err
            return False, err
        return fn()

    def unload(self) -> None:
        """Release loaded model / tokenizer references."""
        self.model = None
        self.tokenizer = None
        self.is_loaded = False
        self.load_error = None

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def run_inference(
        self,
        prompts: list[str],
        max_tokens: int = 256,
    ) -> list[str]:
        """Generate text for each prompt.

        If the model is loaded and real inference is possible it is used;
        otherwise falls back to a deterministic simulation.

        Returns one output string per prompt.
        """
        if self.is_loaded and self.model is not None and self.tokenizer is not None:
            return self._real_inference(prompts, max_tokens)
        return self._simulate_inference(prompts)

    # ------------------------------------------------------------------
    # Load implementations
    # ------------------------------------------------------------------

    def _load_demo(self) -> tuple[bool, None]:
        """Always succeeds.  No real model is loaded."""
        self.is_loaded = True
        return True, None

    def _load_local_path(self) -> tuple[bool, str | None]:
        """Try loading from ``config.model_path``."""
        if not self.config.model_path:
            return False, "model_path is empty"
        return self._load_from_path(self.config.model_path)

    def _load_uploaded(self) -> tuple[bool, str | None]:
        """Try loading from ``artifacts/models/<model_path>/``."""
        path = f"artifacts/models/{self.config.model_path}"
        return self._load_from_path(path)

    def _load_huggingface(self) -> tuple[bool, str | None]:
        """Try loading from HuggingFace Hub."""
        name = self.config.model_name
        if not name:
            return False, "model_name is empty for huggingface source"

        return self._hf_load(name)

    # ------------------------------------------------------------------
    # Shared load helpers
    # ------------------------------------------------------------------

    def _load_from_path(self, path: str) -> tuple[bool, str | None]:
        """Attempt to load model + tokenizer from a local directory."""
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError:
            self.load_error = "transformers not installed"
            return False, "transformers not installed. Install: pip install transformers"

        try:
            self.tokenizer = AutoTokenizer.from_pretrained(path)
            self.model = AutoModelForCausalLM.from_pretrained(
                path,
                torch_dtype="auto",
                device_map="auto",
            )
            self.is_loaded = True
            return True, None
        except Exception as exc:
            self.load_error = str(exc)
            return False, f"Failed to load model from '{path}': {exc}"

    def _hf_load(self, name: str) -> tuple[bool, str | None]:
        """Attempt to load model + tokenizer from HuggingFace Hub."""
        try:
            from transformers import AutoModelForCausalLM, AutoTokenizer
        except ImportError:
            self.load_error = "transformers not installed"
            return False, "transformers not installed. Install: pip install transformers"

        try:
            self.tokenizer = AutoTokenizer.from_pretrained(name)
            self.model = AutoModelForCausalLM.from_pretrained(
                name,
                torch_dtype="auto",
                device_map="auto",
            )
            self.is_loaded = True
            return True, None
        except Exception as exc:
            self.load_error = str(exc)
            return False, f"Failed to load model '{name}' from HuggingFace: {exc}"

    # ------------------------------------------------------------------
    # Real inference
    # ------------------------------------------------------------------

    def _real_inference(self, prompts: list[str], max_tokens: int) -> list[str]:
        """Run inference using the loaded transformers model."""
        try:
            import torch

            inputs = self.tokenizer(
                prompts, return_tensors="pt", padding=True, truncation=True
            )
            if torch.cuda.is_available() and self.config.device != "cpu":
                inputs = {k: v.cuda() for k, v in inputs.items()}

            with torch.no_grad():
                outputs = self.model.generate(
                    **inputs,
                    max_new_tokens=max_tokens,
                    do_sample=False,
                    pad_token_id=self.tokenizer.eos_token_id,
                )
            return self.tokenizer.batch_decode(outputs, skip_special_tokens=True)
        except Exception:
            return self._simulate_inference(prompts)

    # ------------------------------------------------------------------
    # Deterministic simulation (always works)
    # ------------------------------------------------------------------

    def _simulate_inference(self, prompts: list[str]) -> list[str]:
        """Produce deterministic simulated responses based on prompt patterns.

        The simulation is fully deterministic: the same prompts always produce
        the same outputs.  No random calls are made.
        """
        refusal_phrases = [
            "I cannot help with this request.",
            "I'm unable to process this request.",
            "I cannot provide the information you're looking for.",
            "I'm not able to assist with this.",
            "This request cannot be fulfilled.",
        ]
        safe_phrases = [
            "Here is the information you requested.",
            "I'd be happy to help with that.",
            "Let me provide the details you asked for.",
            "Certainly. Here you go.",
        ]

        outputs = []
        for prompt in prompts:
            lower = prompt.lower()
            # Check for refusal-triggering keywords
            refusal_keywords = [
                "hack", "password", "bomb", "illegal", "bypass", "ignore instruction",
                "admin", "credential", "offensive", "fraud", "launder", "exploit",
                "vulnerability", "malware", "virus", "unauthorized", "steal",
            ]
            should_refuse = any(kw in lower for kw in refusal_keywords)
            if should_refuse:
                idx = sum(ord(c) for c in prompt) % len(refusal_phrases)
                outputs.append(refusal_phrases[idx])
            else:
                idx = sum(ord(c) for c in prompt) % len(safe_phrases)
                outputs.append(safe_phrases[idx])
        return outputs
