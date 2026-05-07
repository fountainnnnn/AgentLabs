"""Uploaded model store - save, validate, and manage uploaded model files."""

from __future__ import annotations

import json
import os
import shutil
from pathlib import Path


class UploadedModelStore:
    """Manages storage and validation of uploaded model weight files.

    Files are stored under ``artifacts/models/<run_id>/``.
    Validation checks for expected model files (config.json, weight files,
    tokenizer files) and estimates parameter count from file sizes.
    """

    STORE_DIR: Path = Path("artifacts") / "models"

    def __init__(self, base_dir: str | Path | None = None) -> None:
        self.store_dir = Path(base_dir) if base_dir else self.STORE_DIR
        self.store_dir.mkdir(parents=True, exist_ok=True)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def store_upload(self, run_id: str, files: list) -> str:
        """Persist uploaded model files under ``<store_dir>/<run_id>/``.

        Args:
            run_id: Unique identifier for this upload session.
            files: Iterable of objects with a ``.filename`` attribute and a
                   ``.file`` (file-like) attribute.

        Returns:
            The absolute path to the stored model directory.
        """
        model_dir = self.store_dir / run_id
        model_dir.mkdir(parents=True, exist_ok=True)

        for uploaded_file in files:
            dest = model_dir / uploaded_file.filename
            with open(dest, "wb") as f:
                shutil.copyfileobj(uploaded_file.file, f)

        return str(model_dir.resolve())

    def validate_upload(self, files: list) -> dict:
        """Inspect uploaded files and report what the model directory contains.

        Checks for the presence of a config file, weight files, and tokenizer
        files, and estimates parameter count from file sizes.

        Args:
            files: Iterable of objects with ``.filename`` and ``.size``.

        Returns:
            Dict with keys: valid, has_config, has_weights, has_tokenizer,
            estimated_params, filenames.
        """
        filenames = [f.filename for f in files]
        lower_names = [fn.lower() for fn in filenames]

        has_config = any("config.json" in fn for fn in lower_names)
        has_weights = any(
            fn.endswith((".bin", ".safetensors", ".pt", ".pth"))
            for fn in lower_names
        )
        tokenizer_keywords = {"tokenizer", "vocab", "merges", "spm", "sentencepiece"}
        has_tokenizer = any(
            any(kw in fn for kw in tokenizer_keywords) for fn in lower_names
        )

        return {
            "valid": has_config and has_weights,
            "has_config": has_config,
            "has_weights": has_weights,
            "has_tokenizer": has_tokenizer,
            "estimated_params": self._estimate_params(files),
            "filenames": filenames,
        }

    def list_models(self) -> list[dict]:
        """List all stored model directories and their metadata."""
        if not self.store_dir.is_dir():
            return []

        models = []
        for entry in sorted(self.store_dir.iterdir()):
            if not entry.is_dir():
                continue
            config_path = entry / "config.json"
            model_info = {
                "run_id": entry.name,
                "path": str(entry),
                "files": [f.name for f in entry.iterdir() if f.is_file()],
                "has_config": config_path.exists(),
            }
            if config_path.exists():
                try:
                    with open(config_path) as f:
                        cfg = json.load(f)
                    model_info["model_type"] = cfg.get("model_type", "unknown")
                except Exception:
                    model_info["model_type"] = "unknown"
            models.append(model_info)

        return models

    def delete_model(self, run_id: str) -> bool:
        """Remove a stored model directory and all its contents."""
        model_dir = self.store_dir / run_id
        if model_dir.is_dir():
            shutil.rmtree(model_dir)
            return True
        return False

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _estimate_params(self, files: list) -> str:
        """Rough parameter count estimate from weight file sizes.

        Assumes fp16 storage (2 bytes per parameter).
        """
        total_bytes = sum(
            f.size
            for f in files
            if f.filename.endswith((".bin", ".safetensors", ".pt", ".pth"))
        )
        params = total_bytes / 2.0  # 2 bytes/fp16 param

        if params >= 1e9:
            return f"{params / 1e9:.1f}B"
        if params >= 1e6:
            return f"{params / 1e6:.1f}M"
        if params >= 1e3:
            return f"{params / 1e3:.1f}K"
        return f"{params:.0f}"
