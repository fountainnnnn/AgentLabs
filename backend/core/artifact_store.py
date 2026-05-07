"""File-based artifact storage for run exports.

Artifacts are stored under ``exports/{run_id}/`` on the filesystem.
"""

import json
import os
import zipfile
from pathlib import Path
from typing import Sequence

from config import settings


def _run_dir(run_id: str) -> Path:
    """Return the artifact directory for *run_id*."""
    base = Path(settings.export_dir)
    path = base / run_id
    path.mkdir(parents=True, exist_ok=True)
    return path


def save_artifact(
    run_id: str,
    filename: str,
    content: str | bytes,
) -> str:
    """Write an artifact to the run's export directory.

    Args:
        run_id:   Run identifier (string UUID or human-readable id).
        filename: Desired file name (e.g. ``"report.json"``).
        content:  String or bytes content.

    Returns:
        The absolute path to the written file.
    """
    dest = _run_dir(run_id) / filename
    mode = "wb" if isinstance(content, bytes) else "w"
    with open(dest, mode) as fh:
        fh.write(content)  # type: ignore[arg-type]
    return str(dest.resolve())


def get_artifact_path(run_id: str, filename: str) -> str | None:
    """Return the absolute path of *filename* under *run_id* or ``None``."""
    candidate = _run_dir(run_id) / filename
    return str(candidate.resolve()) if candidate.exists() else None


def list_artifacts(run_id: str) -> list[dict[str, object]]:
    """List every artifact stored for a given run.

    Returns:
        A list of dicts with ``filename``, ``size_bytes``, and
        ``modified_at`` keys.
    """
    directory = _run_dir(run_id)
    artifacts: list[dict[str, object]] = []
    for entry in sorted(directory.iterdir(), key=lambda p: p.stat().st_mtime, reverse=True):
        if entry.is_file():
            stat = entry.stat()
            artifacts.append({
                "filename": entry.name,
                "path": str(entry.resolve()),
                "size_bytes": stat.st_size,
                "modified_at": stat.st_mtime,
            })
    return artifacts


def create_bundle_zip(
    run_id: str,
    files: Sequence[str] | None = None,
) -> str:
    """Create a ZIP bundle of artifacts for a run.

    Args:
        run_id: Run identifier.
        files:  Subset of filenames to include.  If ``None``, all artifacts
                in the directory are included.

    Returns:
        Absolute path of the created ZIP file.
    """
    directory = _run_dir(run_id)
    zip_path = directory / "bundle.zip"

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for entry in directory.iterdir():
            if entry.is_file() and entry.suffix != ".zip":
                if files is None or entry.name in files:
                    zf.write(entry, arcname=entry.name)

    return str(zip_path.resolve())


def read_artifact(run_id: str, filename: str) -> str | None:
    """Read an artifact's text content, returning ``None`` if missing."""
    path = get_artifact_path(run_id, filename)
    if path is None:
        return None
    with open(path) as fh:
        return fh.read()


def save_json_artifact(
    run_id: str,
    filename: str,
    data: object,
    indent: int = 2,
) -> str:
    """Serialize *data* as pretty-printed JSON and save it."""
    content = json.dumps(data, indent=indent, default=str)
    return save_artifact(run_id, filename, content)
